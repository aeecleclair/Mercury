"use strict";

import Bot from "../../main";
import prisma from "../utils/PrismaClient";
import { EmbedBuilder, TextChannel, User } from "discord.js";
import cron from "node-cron";

function shuffle(array: any[]) {
	// Fisher-Yates shuffle algorithm
	let currentIndex = array.length;

	// While there remain elements to shuffle...
	while (currentIndex != 0) {
		// Pick a remaining element...
		let randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}
}

function getRandomIndex(probabilities: number[]) {
	var random = Math.random() * probabilities.reduce((a, v) => a + v, 0);

	for (let i = 0; i < probabilities.length; i++) {
		if (random < probabilities[i]) return i;
		random -= probabilities[i];
	}
	return probabilities.length - 1;
}

function elementWiseMultiplication(a: number[], b: number[]) {
	if (a.length !== b.length) throw new Error("Arrays must be of the same length");
	return a.map((val, index) => val * b[index]);
}

class CommandService {
	client: Bot;
	constructor(client: Bot) {
		this.client = client;
	}

	async handle() {
		console.log("Scheduling permanence messages...");
		// Schedule a task to run every Saturday at midnight as well
		cron.schedule(
			"0 0 * * 6",
			async () => {
				await this.handleRemindMessage();
			},
			{ timezone: "Europe/Paris" }
		);
		// Schedule a task to run every Sunday at midnight
		cron.schedule(
			"* * * * *",
			async () => {
				await this.handlePermsMessage();
			},
			{ timezone: "Europe/Paris" }
		);
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
		await channel.send(
			"N'oubliez pas de définir votre disponibilité pour la semaine à venir en utilisant la commande `/permanence availability` !"
		);
	}

	async handlePermsMessage() {
		console.log("Allez ça part");
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
		const userIds = availabilities.reduce((a: string[], v) => [...a, v.userId], []);

		const dayToAvailableUsers: string[][] = [[], [], [], [], []];
		for (const a of availabilities) {
			dayToAvailableUsers[a.day].push(a.userId.toString());
		}

		const userToNumberOfAvailableDays: { [userId: string]: number } = availabilities.reduce(
			(a, v) => ({ ...a, [v.userId]: 0 }),
			{}
		);
		for (const a of availabilities) {
			userToNumberOfAvailableDays[a.userId]++;
		}
		const numberOfAvailableDaysToUsers: string[][] = [[], [], [], [], []];
		for (const userId in userToNumberOfAvailableDays) {
			numberOfAvailableDaysToUsers[userToNumberOfAvailableDays[userId] - 1].push(userId);
		}

		for (let users of numberOfAvailableDaysToUsers) shuffle(users);

		const userToBinaryAvailability = userIds.reduce(
			(a: { [userId: string]: number[] }, v) => ({ ...a, [v]: [0, 0, 0, 0, 0] }),
			{}
		);
		availabilities.map(a => (userToBinaryAvailability[a.userId][a.day] = 1));

		let maxUsersPerDay = 1;
		const daysToProba = dayToAvailableUsers.map(user => 1 / user.length);
		const dayToAssignedUsers: string[][] = [[], [], [], [], []];
		for (const users of numberOfAvailableDaysToUsers) {
			for (const userId of users) {
				const availableSlotsPerDays = dayToAssignedUsers.map(users => maxUsersPerDay - users.length);
				let userPossibleDays = elementWiseMultiplication(
					userToBinaryAvailability[userId],
					availableSlotsPerDays
				);
				if (userPossibleDays.reduce((a, v) => a + v, 0) === 0) {
					maxUsersPerDay++;
					userPossibleDays = userToBinaryAvailability[userId];
				}
				dayToAssignedUsers[
					getRandomIndex(elementWiseMultiplication(userToBinaryAvailability[userId], userPossibleDays))
				].push(userId);
			}
		}

		// Créer l'embed
		const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
		const embed = new EmbedBuilder().setTitle("📅 Planning des permanences").setColor(0x5865f2).setTimestamp();

		for (let i = 0; i < 5; i++) {
			const assigned = dayToAssignedUsers[i];

			let fieldValue = "";
			if (assigned.length === 0) {
				fieldValue = "*Personne...*";
			} else {
				fieldValue = assigned.map(userId => `<@${userId}>`).join("\n");
			}

			embed.addFields({
				name: `${dayNames[i]}`,
				value: fieldValue,
				inline: true
			});
			console.log(`${dayNames[i]}: ${fieldValue}`);
		}

		await channel.send({ embeds: [embed] });
	}
}

export default CommandService;
