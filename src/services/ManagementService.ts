import Bot from "../../main";

import cron from "node-cron";
import { fetchPlaneModuleSnapshots } from "../utils/PlaneModuleSnapshots";
import prisma from "../utils/PrismaClient";

class ManagementService {

    private _client: Bot;

    constructor(private client: Bot) {
        this._client = client;
    }

    async getAndSaveInDb() {
        const result = await fetchPlaneModuleSnapshots({
            apiKey: process.env.PLANE_API_KEY as string,
            projectId: process.env.PLANE_PROJECT_ID,
            workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
        });
        result.forEach(async (snapshot) => {
            await prisma.projectModuleProgressMeasurement.create({
                data: {
                    moduleId: snapshot.planeModuleId,
                    progress: Math.round(snapshot.progress*100),
                    date: new Date(snapshot.measuredAt),
                    startDate: new Date(snapshot.startDate),
                    targetDate: new Date(snapshot.endDate),
                    totalWorkItems: snapshot.totalWorkItems,
                    name: snapshot.name,
                    description: snapshot.description,
                },
            });
        });
    }

    async handle() {
        console.log("Scheduling management messages...");

        cron.schedule(
			"0 0 * * *",
			async () => {
				await this.getAndSaveInDb();
			},
			{ timezone: "Europe/Paris" }
		);
    }

}

export default ManagementService;