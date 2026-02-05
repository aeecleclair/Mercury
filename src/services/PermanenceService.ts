"use strict";

import Bot from "../../main";
import prisma from "../utils/PrismaClient";
import { EmbedBuilder, TextChannel } from "discord.js";
import cron from "node-cron";

class CommandService {
	client: Bot;
	constructor(client: Bot) {
		this.client = client;
	}

    async handle() {
        console.log("Scheduling permanence messages...");
        // Schedule a task to run every Saturday at midnight as well
		cron.schedule("0 0 * * 6", async () => {
			await this.handleRemindMessage();
		}, {timezone: "Europe/Paris"});
        // Schedule a task to run every Sunday at midnight
		cron.schedule("0 0 * * 0", async () => {
			await this.handlePermsMessage();
		}, {timezone: "Europe/Paris"});
    }

    async handleRemindMessage() {
        const guild = await prisma.guild.findFirst({
            where: {
                id: "1071821884531945543"
            }
        });
        if (!guild || !guild.permanenceChannelId) return;

        const discordGuild = this.client.guilds.cache.get(guild.id);
        if (!discordGuild) return;
        const channel = discordGuild.channels.cache.get(guild.permanenceChannelId) as TextChannel;
        if (!channel || !channel.isSendable()) return;
        await channel.send("N'oubliez pas de définir votre disponibilité pour la semaine à venir en utilisant la commande `/permanence availability` !");
    }

	async handlePermsMessage() {
        const guild = await prisma.guild.findFirst({
            where: {
                id: "1071821884531945543"
            }
        });

        if (!guild || !guild.permanenceChannelId) return;

        const discordGuild = this.client.guilds.cache.get(guild.id);
        if (!discordGuild) return;
        const channel = discordGuild.channels.cache.get(guild.permanenceChannelId) as TextChannel;
        if (!channel || !channel.isSendable()) return;

        // Récupérer toutes les disponibilités
        const availabilities = await prisma.availability.findMany();

        // Grouper par jour
        const dayAssignments: { [key: number]: string[] } = {
            0: [], 1: [], 2: [], 3: [], 4: []
        };

        const usersByDay: { [key: number]: string[] } = {};
        
        // Regrouper les utilisateurs par jour
        for (const availability of availabilities) {
            if (!usersByDay[availability.day]) {
                usersByDay[availability.day] = [];
            }
            usersByDay[availability.day].push(availability.userId);
        }

        // Suivre le nombre d'affectations par utilisateur
        const userAssignmentCount: { [userId: string]: number } = {};
        
        const days = [0, 1, 2, 3, 4];
        
        for (const day of days) {
            const availableUsers = usersByDay[day] || [];
            if (availableUsers.length > 0) {
                // Trier les utilisateurs par nombre d'affectations (priorité aux moins assignés)
                const sortedUsers = availableUsers.sort((a, b) => {
                    const countA = userAssignmentCount[a] || 0;
                    const countB = userAssignmentCount[b] || 0;
                    // Si même nombre d'affectations, ordre aléatoire
                    if (countA === countB) return Math.random() - 0.5;
                    return countA - countB;
                });

                // Sélectionner 1-2 personnes parmi les moins assignées
                const numToAssign = Math.min(2, sortedUsers.length);
                const assigned = sortedUsers.slice(0, numToAssign);
                
                dayAssignments[day] = assigned;
                
                // Incrémenter le compteur pour chaque personne assignée
                for (const userId of assigned) {
                    userAssignmentCount[userId] = (userAssignmentCount[userId] || 0) + 1;
                }
            }
        }

        // Créer l'embed
        const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
        const embed = new EmbedBuilder()
            .setTitle("📅 Planning des permanences")
            .setColor(0x5865F2)
            .setTimestamp();

        for (let i = 0; i < days.length; i++) {
            const day = days[i];
            const assigned = dayAssignments[day];
            
            let fieldValue = "";
            if (assigned.length === 0) {
                fieldValue = "*Personne assignée*";
            } else {
                fieldValue = assigned.map(userId => `<@${userId}>`).join("\n");
            }

            embed.addFields({
                name: `${dayNames[i]}`,
                value: fieldValue,
                inline: true
            });
        }

        await channel.send({ embeds: [embed] });
    }
}

export default CommandService;
