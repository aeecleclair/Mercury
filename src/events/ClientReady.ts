"use strict";

import { Events } from "discord.js";
import DiscordEvent from "../utils/DiscordEvent";
import Bot from "../../main";
import PermanenceService from "../services/PermanenceService";
import ManagementService from "../services/ManagementService";
import path from "path";
import { GlobalFonts } from "@napi-rs/canvas";

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

	loadFonts() {
		GlobalFonts.registerFromPath(path.resolve(process.cwd(), "assets/fonts/dejavu-sans.book.ttf"), "DejaVu Sans");

		GlobalFonts.registerFromPath(path.resolve(process.cwd(), "assets/fonts/dejavu-sans.bold.ttf"), "DejaVu Sans Bold");
		console.log("Fonts loaded successfully.");
	}

	async run() {
		console.log("Client is ready!");
		this.client.user.setActivity("Code 24/7");

		this.loadFonts();
		
		this.management.handle();
		this.permanence.handle();
	}
}
