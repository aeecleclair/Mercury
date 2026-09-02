const DEFAULT_PLANE_BASE_URL = "https://plane.myecl.fr";
const DEFAULT_CONCURRENCY = 5;
const MAX_PAGE_COUNT = 10_000;

export interface PlaneApiConfig {
    apiKey: string;
    workspaceSlug: string;
    projectId: string;
    /** For a self-hosted instance, for example https://plane.example.com. */
    baseUrl?: string;
    /** Number of modules whose work items are fetched simultaneously. */
    concurrency?: number;
    timeoutMs?: number;
}

/**
 * One point-in-time measurement, ready to be persisted in your database.
 * Store one row per module and per measuredAt value.
 */
export interface PlaneModuleSnapshot {
    planeProjectId: string;
    planeModuleId: string;
    name: string;
    description: string | null;
    moduleStatus: string | null;
    startDate: number | null;
    endDate: number | null;
    progress: number;
    completedWorkItems: number;
    trackedWorkItems: number;
    cancelledWorkItems: number;
    totalWorkItems: number;
    measuredAt: number;
}

interface PlaneModule {
    id: string;
    name: string;
    description?: string | null;
    start_date?: string | null;
    target_date?: string | null;
    status?: string | null;
}

interface PlaneState {
    id: string;
    group: "backlog" | "unstarted" | "started" | "completed" | "cancelled" | string;
}

interface PlaneWorkItem {
    id: string;
    state?: string | { id?: string | null } | null;
    state_id?: string | null;
    state_detail?: { id?: string | null } | null;
}

interface PlanePaginatedResponse<T> {
    results: T[];
    next_cursor?: string | null;
    next_page_results?: boolean;
}

class PlaneApiError extends Error {
    readonly status: number;
    readonly path: string;

    constructor(
        message: string,
        status: number,
        path: string,
    ) {
        super(message);
        this.name = "PlaneApiError";
        this.status = status;
        this.path = path;
    }
}

function trimTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, "");
}

function encodePathPart(value: string): string {
    return encodeURIComponent(value);
}

function parsePlaneDate(value?: string | null): number | null {
    if (!value) return null;

    const timestamp = Date.parse(
        value.includes("T") ? value : `${value}T00:00:00.000Z`,
    );
    return Number.isFinite(timestamp) ? timestamp : null;
}

function getWorkItemStateId(workItem: PlaneWorkItem): string | null {
    if (typeof workItem.state === "string") return workItem.state;
    if (workItem.state && typeof workItem.state.id === "string") {
        return workItem.state.id;
    }
    if (typeof workItem.state_id === "string") return workItem.state_id;
    if (typeof workItem.state_detail?.id === "string") {
        return workItem.state_detail.id;
    }
    return null;
}

async function readErrorBody(response: Response): Promise<string> {
    const body = await response.text().catch(() => "");
    if (!body) return response.statusText || "Unknown Plane API error";

    try {
        const parsed = JSON.parse(body) as {
            detail?: unknown;
            error?: unknown;
            message?: unknown;
        };
        const message = parsed.detail ?? parsed.error ?? parsed.message;
        return typeof message === "string" ? message : body;
    } catch {
        return body;
    }
}

function createPlaneClient(config: PlaneApiConfig) {
    if (!config.apiKey) throw new Error("Plane API key is required");
    if (!config.workspaceSlug) throw new Error("Plane workspace slug is required");
    if (!config.projectId) throw new Error("Plane project ID is required");

    const baseUrl = trimTrailingSlashes(
        config.baseUrl ?? DEFAULT_PLANE_BASE_URL,
    );
    const timeoutMs = config.timeoutMs ?? 15_000;

    async function requestPage<T>(
        path: string,
        cursor?: string,
    ): Promise<T[] | PlanePaginatedResponse<T>> {
        const url = new URL(`${baseUrl}${path}`);
        url.searchParams.set("per_page", "100");
        if (cursor) url.searchParams.set("cursor", cursor);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-API-Key": config.apiKey,
            },
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            const details = await readErrorBody(response);
            throw new PlaneApiError(
                `Plane API returned ${response.status}: ${details}`,
                response.status,
                path,
            );
        }

        return (await response.json()) as T[] | PlanePaginatedResponse<T>;
    }

    async function getAllPages<T>(path: string): Promise<T[]> {
        const allResults: T[] = [];
        let cursor: string | undefined;

        for (let page = 0; page < MAX_PAGE_COUNT; page += 1) {
            const response = await requestPage<T>(path, cursor);

            // Some Plane/self-hosted versions return an array for small lists.
            if (Array.isArray(response)) {
                allResults.push(...response);
                return allResults;
            }

            allResults.push(...response.results);

            const nextCursor = response.next_cursor ?? undefined;
            const hasNextPage =
                response.next_page_results === true ||
                (response.next_page_results === undefined && Boolean(nextCursor));

            if (!hasNextPage || !nextCursor) return allResults;
            if (nextCursor === cursor) {
                throw new Error(`Plane returned the same cursor twice for ${path}`);
            }
            cursor = nextCursor;
        }

        throw new Error(`Plane pagination limit reached for ${path}`);
    }

    return { getAllPages };
}

async function mapWithConcurrency<T, R>(
    values: T[],
    concurrency: number,
    mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(values.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= values.length) return;
            results[index] = await mapper(values[index], index);
        }
    }

    const workerCount = Math.min(
        values.length,
        Math.max(1, Math.floor(concurrency)),
    );
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

/**
 * Fetches every active module of one Plane project and computes its progress.
 *
 * Progress = completed work items / non-cancelled work items.
 * Cancelled work items are returned separately and excluded from the divisor.
 * This function does not write anything to a database and does not schedule
 * itself: call it from your own cron job, then persist the returned snapshots.
 */
export async function fetchPlaneModuleSnapshots(
    config: PlaneApiConfig,
): Promise<PlaneModuleSnapshot[]> {
    const client = createPlaneClient(config);
    const workspace = encodePathPart(config.workspaceSlug);
    const project = encodePathPart(config.projectId);
    const projectPath = `/api/v1/workspaces/${workspace}/projects/${project}`;

    const [modules, states] = await Promise.all([
        client.getAllPages<PlaneModule>(`${projectPath}/modules/`),
        client.getAllPages<PlaneState>(`${projectPath}/states/`),
    ]);

    const completedStateIds = new Set(
        states.filter((state) => state.group === "completed").map((state) => state.id),
    );
    const cancelledStateIds = new Set(
        states.filter((state) => state.group === "cancelled").map((state) => state.id),
    );
    const measuredAt = Date.now();

    return mapWithConcurrency(
        modules,
        config.concurrency ?? DEFAULT_CONCURRENCY,
        async (module): Promise<PlaneModuleSnapshot> => {
            const moduleId = encodePathPart(module.id);
            const workItems = await client.getAllPages<PlaneWorkItem>(
                `${projectPath}/modules/${moduleId}/module-issues/`,
            );

            let completedWorkItems = 0;
            let cancelledWorkItems = 0;

            for (const workItem of workItems) {
                const stateId = getWorkItemStateId(workItem);
                if (stateId && completedStateIds.has(stateId)) {
                    completedWorkItems += 1;
                } else if (stateId && cancelledStateIds.has(stateId)) {
                    cancelledWorkItems += 1;
                }
            }

            const trackedWorkItems = workItems.length - cancelledWorkItems;
            const progress =
                trackedWorkItems === 0
                    ? 0
                    : completedWorkItems / trackedWorkItems;

            return {
                planeProjectId: config.projectId,
                planeModuleId: module.id,
                name: module.name,
                description: module.description ?? null,
                moduleStatus: module.status ?? null,
                startDate: parsePlaneDate(module.start_date),
                endDate: parsePlaneDate(module.target_date),
                progress,
                completedWorkItems,
                trackedWorkItems,
                cancelledWorkItems,
                totalWorkItems: workItems.length,
                measuredAt,
            };
        },
    );
}
