import Bot from "../../main";

import cron from "node-cron";
import { fetchPlaneModuleSnapshots } from "../utils/project_management/PlaneModuleSnapshots";
import prisma from "../utils/PrismaClient";
import { getProjectsDataFromDb } from "../utils/project_management/getFromDb";
import { renderProjectsDashboard } from "../utils/project_management/ProjectsCanvas";
import { Message } from "discord.js";

class ManagementService {

    private _client: Bot;

    constructor(private client: Bot) {
        this._client = client;
    }

    async fetchPlaneAndSaveInDb() {
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
                },
            });
        });
    }

    async postToChannel(message: Message) {
        const channelId = process.env.PROJECTS_DASHBOARD_CHANNEL_ID;
        if (!channelId) {
            console.error("PROJECTS_DASHBOARD_CHANNEL_ID is not set in the environment variables.");
            return;
        }
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !channel.isSendable()) {
            console.error("The channel ID provided is not a text-based/sendable channel.");
            return;
        }
        const projectsData = await getProjectsDataFromDb();
        const dashboardBuffer = await renderProjectsDashboard(projectsData);
        const attachment = {
            name: "projects_dashboard.png",
            attachment: dashboardBuffer,
        };
        if (message && message.editable) {
            await message.edit({ files: [ attachment ] });
        } else {
            await channel.send({ files: [attachment] });
        }
    }

    async handle() {
        console.log("Scheduling management messages...");

        const channelId = process.env.PROJECTS_DASHBOARD_CHANNEL_ID;
        if (!channelId) {
            console.error("PROJECTS_DASHBOARD_CHANNEL_ID is not set in the environment variables.");
            return;
        }
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased() || !channel.isSendable()) {
            console.error("The channel ID provided is not a text-based/sendable channel.");
            return;
        }
        const message = await channel.send(`## 📋 Projects Dashboard\nLe bot a été redémarré et est maintenant opérationnel. Le dashboard sera actualisé toutes les ${process.env.DASHBOARD_REFRESH_INTERVAL_HOURS || "6"} heures.`);

        cron.schedule(
			`0 */${parseInt(process.env.DASHBOARD_REFRESH_INTERVAL_HOURS || "6")} * * *`,
			async () => {
				await this.fetchPlaneAndSaveInDb();
                await this.postToChannel(message);
			},
			{ timezone: "Europe/Paris" }
		);
    }

}

export default ManagementService;