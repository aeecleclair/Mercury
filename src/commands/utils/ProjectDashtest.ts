import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
    ApplicationCommandType,
    AttachmentBuilder,
    ChatInputCommandInteraction,
} from "discord.js";

import Command from "../../utils/Command";
import { BaseContext } from "../../utils/Context";

const DAY = 24 * 60 * 60 * 1000;
const MAX_PROJECTS = 10;

interface ProjectData {
    name: string;
    progress: number;
    startDate: number;
    endDate: number;
    progressMeasurements: number[];
    progressDateMeasurements: number[];
}

type ProjectStatus =
    | "planned"
    | "on-track"
    | "ahead"
    | "late"
    | "stalled"
    | "overdue"
    | "completed";

interface ProjectMetrics {
    progress: number;
    expectedProgress: number;
    status: ProjectStatus;
    lastMeasurement?: { value: number; date: number };
    dailyDelta?: number;
    daysWithoutProgress?: number;
}

const STATUS_STYLE: Record<
    ProjectStatus,
    { label: string; color: string; gradientStart: string }
> = {
    planned: {
        label: "PLANIFIE",
        color: "#94a3b8",
        gradientStart: "#64748b",
    },
    "on-track": {
        label: "EN BONNE VOIE",
        color: "#22c55e",
        gradientStart: "#14b8a6",
    },
    ahead: {
        label: "EN AVANCE",
        color: "#38bdf8",
        gradientStart: "#6366f1",
    },
    late: {
        label: "EN RETARD",
        color: "#f59e0b",
        gradientStart: "#f97316",
    },
    stalled: {
        label: "STAGNE",
        color: "#ef4444",
        gradientStart: "#f97316",
    },
    overdue: {
        label: "ECHEANCE DEPASSEE",
        color: "#fb7185",
        gradientStart: "#dc2626",
    },
    completed: {
        label: "TERMINE",
        color: "#10b981",
        gradientStart: "#22c55e",
    },
};

function clamp(value: number, min = 0, max = 1): number {
    return Math.min(max, Math.max(min, value));
}

function getMetrics(project: ProjectData, now: number): ProjectMetrics {
    const progress = clamp(project.progress);
    const duration = Math.max(project.endDate - project.startDate, 1);
    const expectedProgress = clamp((now - project.startDate) / duration);

    const measurements = project.progressMeasurements
        .slice(0, project.progressDateMeasurements.length)
        .map((value, index) => ({
            value: clamp(value),
            date: project.progressDateMeasurements[index],
        }))
        .filter((measurement) => Number.isFinite(measurement.date))
        .sort((a, b) => a.date - b.date);

    const lastMeasurement = measurements.at(-1);
    const previousMeasurement = measurements.at(-2);

    let dailyDelta: number | undefined;
    if (lastMeasurement && previousMeasurement) {
        const elapsedDays = Math.max(
            (lastMeasurement.date - previousMeasurement.date) / DAY,
            1 / 24,
        );
        dailyDelta =
            (lastMeasurement.value - previousMeasurement.value) / elapsedDays;
    }

    let lastProgressDate: number | undefined;
    for (let index = measurements.length - 1; index > 0; index -= 1) {
        if (measurements[index].value - measurements[index - 1].value > 0.001) {
            lastProgressDate = measurements[index].date;
            break;
        }
    }

    if (!lastProgressDate && measurements.length > 0) {
        lastProgressDate = measurements[0].date;
    }

    const daysWithoutProgress = lastProgressDate
        ? Math.max(0, (now - lastProgressDate) / DAY)
        : undefined;
    const lastMeasurementAge = lastMeasurement
        ? Math.max(0, (now - lastMeasurement.date) / DAY)
        : undefined;

    let status: ProjectStatus;
    if (progress >= 0.999) {
        status = "completed";
    } else if (now < project.startDate) {
        status = "planned";
    } else if (now > project.endDate) {
        status = "overdue";
    } else if (
        (daysWithoutProgress !== undefined && daysWithoutProgress >= 3) ||
        (lastMeasurementAge !== undefined && lastMeasurementAge >= 3)
    ) {
        status = "stalled";
    } else if (progress < expectedProgress - 0.08) {
        status = "late";
    } else if (progress > expectedProgress + 0.08) {
        status = "ahead";
    } else {
        status = "on-track";
    }

    return {
        progress,
        expectedProgress,
        status,
        lastMeasurement,
        dailyDelta,
        daysWithoutProgress,
    };
}

function roundedRect(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function truncateText(
    ctx: SKRSContext2D,
    text: string,
    maxWidth: number,
): string {
    if (ctx.measureText(text).width <= maxWidth) return text;

    let result = text;
    while (result.length > 0 && ctx.measureText(`${result}...`).width > maxWidth) {
        result = result.slice(0, -1);
    }
    return `${result}...`;
}

function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(timestamp);
}

function formatAge(timestamp: number, now: number): string {
    const days = Math.max(0, Math.floor((now - timestamp) / DAY));
    if (days === 0) return "aujourd'hui";
    if (days === 1) return "hier";
    return `il y a ${days} j`;
}

async function renderProjectsDashboard(projects: ProjectData[]): Promise<Buffer> {
    const now = Date.now();
    const visibleProjects = [...projects]
        .sort((a, b) => b.startDate - a.startDate)
        .slice(0, MAX_PROJECTS);

    const width = 1200;
    const headerHeight = 142;
    const rowHeight = 126;
    const bottomPadding = 38;
    const height = Math.max(
        310,
        headerHeight + visibleProjects.length * rowHeight + bottomPadding,
    );

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#0b1120");
    background.addColorStop(1, "#172033");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 34px sans-serif";
    ctx.fillText("Tableau de bord des projets", 42, 53);

    const metrics = visibleProjects.map((project) => getMetrics(project, now));
    const warnings = metrics.filter(
        ({ status }) =>
            status === "stalled" || status === "late" || status === "overdue",
    ).length;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 17px sans-serif";
    ctx.fillText(
        `${visibleProjects.length} projet${visibleProjects.length > 1 ? "s" : ""} affiche${visibleProjects.length > 1 ? "s" : ""}`,
        43,
        84,
    );

    ctx.textAlign = "right";
    ctx.fillStyle = warnings > 0 ? "#fca5a5" : "#86efac";
    ctx.font = "600 17px sans-serif";
    ctx.fillText(
        warnings > 0
            ? `${warnings} projet${warnings > 1 ? "s" : ""} a surveiller`
            : "Tous les projets progressent normalement",
        width - 42,
        53,
    );
    ctx.textAlign = "left";

    if (visibleProjects.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Aucun projet a afficher", width / 2, 205);
        return canvas.encode("png");
    }

    visibleProjects.forEach((project, index) => {
        const metric = metrics[index];
        const style = STATUS_STYLE[metric.status];
        const y = headerHeight + index * rowHeight;
        const cardX = 40;
        const cardY = y;
        const cardWidth = width - 80;
        const cardHeight = 108;

        roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16);
        ctx.fillStyle = "#1e293b";
        ctx.fill();

        ctx.fillStyle = style.color;
        roundedRect(ctx, cardX, cardY, 6, cardHeight, 3);
        ctx.fill();

        ctx.font = "700 21px sans-serif";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(truncateText(ctx, project.name, 250), 68, cardY + 34);

        ctx.font = "500 14px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(
            `${formatDate(project.startDate)}  -  ${formatDate(project.endDate)}`,
            68,
            cardY + 63,
        );

        const barX = 352;
        const barY = cardY + 27;
        const barWidth = 510;
        const barHeight = 25;

        roundedRect(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
        ctx.fillStyle = "#334155";
        ctx.fill();

        const filledWidth = barWidth * metric.progress;
        if (filledWidth > 0) {
            const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
            gradient.addColorStop(0, style.gradientStart);
            gradient.addColorStop(1, style.color);
            roundedRect(
                ctx,
                barX,
                barY,
                Math.max(filledWidth, barHeight),
                barHeight,
                barHeight / 2,
            );
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // The small line indicates where progress should be today.
        if (metric.status !== "planned" && metric.status !== "completed") {
            const expectedX = barX + barWidth * metric.expectedProgress;
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.fillRect(expectedX - 1, barY - 4, 2, barHeight + 8);
        }

        const deltaText =
            metric.dailyDelta === undefined
                ? "variation indisponible"
                : `${metric.dailyDelta >= 0 ? "+" : ""}${(
                      metric.dailyDelta * 100
                  ).toFixed(1)} pt/j`;
        const measurementText = metric.lastMeasurement
            ? `derniere mesure ${formatAge(metric.lastMeasurement.date, now)} (${formatDate(metric.lastMeasurement.date)})`
            : "aucune mesure disponible";

        ctx.font = "500 14px sans-serif";
        ctx.fillStyle = metric.status === "stalled" ? "#fca5a5" : "#94a3b8";
        ctx.fillText(`${deltaText}  |  ${measurementText}`, barX, cardY + 80);

        ctx.textAlign = "right";
        ctx.font = "800 28px sans-serif";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(`${Math.round(metric.progress * 100)} %`, 1090, cardY + 38);

        ctx.font = "700 13px sans-serif";
        const badgeWidth = Math.max(112, ctx.measureText(style.label).width + 28);
        roundedRect(ctx, 1090 - badgeWidth, cardY + 56, badgeWidth, 27, 14);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = style.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = style.color;
        ctx.fillText(style.label, 1076, cardY + 75);
        ctx.textAlign = "left";
    });

    return canvas.encode("png");
}

export default class ProjectDashtest extends Command {
    constructor() {
        super({
            type: ApplicationCommandType.ChatInput,
            name: "projectsdashtest",
            category: "utils",
            description:
                "Test the creation of a project dashboard and its progress.",
        });
    }

    async run(ctx: BaseContext<ChatInputCommandInteraction>) {
        const now = Date.now();
        const testdata: ProjectData[] = [
            {
                // Expected progress: 50%, actual progress: 50%.
                name: "Refonte du site - En bonne voie",
                progress: 0.5,
                startDate: now - 5 * DAY,
                endDate: now + 5 * DAY,
                progressMeasurements: [0.15, 0.25, 0.38, 0.5],
                progressDateMeasurements: [4, 3, 2, 1].map(
                    (daysAgo) => now - daysAgo * DAY,
                ),
            },
            {
                // Expected progress: 50%, actual progress: 78%.
                name: "Application mobile - En avance",
                progress: 0.78,
                startDate: now - 10 * DAY,
                endDate: now + 10 * DAY,
                progressMeasurements: [0.3, 0.48, 0.62, 0.78],
                progressDateMeasurements: [7, 5, 3, 1].map(
                    (daysAgo) => now - daysAgo * DAY,
                ),
            },
            {
                // Expected progress: 80%, actual progress: 35%.
                name: "Migration de la base de donnees - En retard",
                progress: 0.35,
                startDate: now - 8 * DAY,
                endDate: now + 2 * DAY,
                progressMeasurements: [0.1, 0.18, 0.27, 0.35],
                progressDateMeasurements: [7, 5, 3, 1].map(
                    (daysAgo) => now - daysAgo * DAY,
                ),
            },
            {
                // The last increase was six days ago: this project is stalled.
                name: "Documentation de l'API - Stagne",
                progress: 0.3,
                startDate: now - 8 * DAY,
                endDate: now + 8 * DAY,
                progressMeasurements: [0.1, 0.3, 0.3, 0.3],
                progressDateMeasurements: [8, 6, 3, 1].map(
                    (daysAgo) => now - daysAgo * DAY,
                ),
            },
            {
                name: "Mise en production v2 - Termine",
                progress: 1,
                startDate: now - 15 * DAY,
                endDate: now - 1 * DAY,
                progressMeasurements: [0.4, 0.7, 0.9, 1],
                progressDateMeasurements: [10, 6, 3, 1].map(
                    (daysAgo) => now - daysAgo * DAY,
                ),
            },
            {
                name: "Audit de securite - Planifie",
                progress: 0,
                startDate: now + 3 * DAY,
                endDate: now + 17 * DAY,
                progressMeasurements: [],
                progressDateMeasurements: [],
            },
            {
                // Its deadline has passed, but it is still only 80% complete.
                name: "Import des anciennes donnees - Echeance depassee",
                progress: 0.8,
                startDate: now - 14 * DAY,
                endDate: now - 2 * DAY,
                progressMeasurements: [0.5, 0.65, 0.72, 0.8],
                progressDateMeasurements: [6, 4, 2, 1].map(
                    (daysAgo) => now - daysAgo * DAY,
                ),
            },
            {
                // Useful for checking the fallback when no history exists.
                name: "Prototype du bot - Sans mesures",
                progress: 0.2,
                startDate: now - 2 * DAY,
                endDate: now + 8 * DAY,
                progressMeasurements: [],
                progressDateMeasurements: [],
            },
        ];

        const image = await renderProjectsDashboard(testdata);
        const attachment = new AttachmentBuilder(image, {
            name: "projects-dashboard.png",
            description: "Dashboard showing project progress and warnings",
        });

        await ctx.reply({ files: [attachment] });
    }
}
