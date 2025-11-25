"use strict";

import { Events, Message } from "discord.js";
import DiscordEvent from "../utils/DiscordEvent";
import Bot from "../../main";
import ParsingService from "../services/ParsingService";

/*
L'évent messageCreate n'est pas long car en faites les tâches sont répartis dans le dossier services prenez exemple sur CommandService ;)
*/

export default class MessageCreate extends DiscordEvent<Events.MessageCreate> {
	parsings: ParsingService;
	constructor(client: Bot) {
		super(client, Events.MessageCreate);
		this.client = client;
		this.parsings = new ParsingService(this.client);
	}

	async run(message: Message) {
		await this.parsings.handle(message);
	}
}
