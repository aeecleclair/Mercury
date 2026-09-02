"use strict";

import { Events } from "discord.js";
import DiscordEvent from "../utils/DiscordEvent";
import Bot from "../../main";
import PermanenceService from "../services/PermanenceService";
import ManagementService from "../services/ManagementService";

/*
L'évent interactionCreate n'est pas long car en faites les tâches sont répartis dans le dossier services prenez exemple sur CommandService ;)
*/

export default class ClientReady extends DiscordEvent<Events.ClientReady> {
	management: ManagementService;
	permanence: PermanenceService;
	constructor(client: Bot) {
		super(client, Events.ClientReady);
		this.client = client;
		this.management = new ManagementService(this.client);
		this.permanence = new PermanenceService(this.client);
	}

	async run() {
		console.log("Client is ready!");
		this.client.user.setActivity("Code 24/7");

		this.management.handle();
		this.permanence.handle();
	}
}
