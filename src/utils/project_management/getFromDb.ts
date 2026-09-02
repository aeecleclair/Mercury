import prisma from "../PrismaClient";
import { ProjectData } from "./ProjectsCanvas";

// This functions retrives data from db to transform into the ProjectData format for the dashboard rendering
export async function getProjectsDataFromDb(): Promise<ProjectData[]> {
    const result = await prisma.projectModuleProgressMeasurement.findMany({
        orderBy: {
            date: "asc", // Order by date ascending to get the progress measurements in chronological order
        },
    });
    return result.reduce((acc: ProjectData[], curr) => {
        const existingProject = acc.find((project) => project.moduleId === curr.moduleId);
        if (existingProject) {
            existingProject.progressMeasurements.push(curr.progress / 100);
            existingProject.progressDateMeasurements.push(curr.date.getTime());
            existingProject.progress = curr.progress / 100; // Update the latest progress
            // We also update the startDate and endDate in case they have changed in the database
            existingProject.startDate = curr.startDate.getTime();
            existingProject.endDate = curr.targetDate.getTime();
            existingProject.name = curr.name; // Update the name in case it has changed
        } else {
            acc.push({
                name: curr.name,
                moduleId: curr.moduleId,
                progress: curr.progress / 100,
                startDate: curr.startDate.getTime(),
                endDate: curr.targetDate.getTime(),
                progressMeasurements: [curr.progress / 100],
                progressDateMeasurements: [curr.date.getTime()],
            });
        }
        return acc;
    }, []);
}
