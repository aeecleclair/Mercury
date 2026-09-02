import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    ApplicationCommandType,
} from "discord.js";

import Command from "../../utils/Command";
import { BaseContext } from "../../utils/Context";
import { ProjectData, renderProjectsDashboard } from "../../utils/project_management/ProjectsCanvas";

const DAY = 24 * 60 * 60 * 1000; // milliseconds in a day

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
                moduleId: "module-1",
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
                moduleId: "module-2",
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
                moduleId: "3",
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
                moduleId: "module-4",
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
                moduleId: "module-5",
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
                moduleId: "module-6",
                progress: 0,
                startDate: now + 3 * DAY,
                endDate: now + 17 * DAY,
                progressMeasurements: [],
                progressDateMeasurements: [],
            },
            {
                // Its deadline has passed, but it is still only 80% complete.
                name: "Import des anciennes donnees - Echeance depassee",
                moduleId: "module-7",
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
                moduleId: "module-8",
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
