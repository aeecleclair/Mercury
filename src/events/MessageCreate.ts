"use strict";

import { Events, Message } from "discord.js";
import CommandService from "../services/CommandService";
import DiscordEvent from "../utils/DiscordEvent";
import Bot from "../../main";

/*
L'évent interactionCreate n'est pas long car en faites les tâches sont répartis dans le dossier services prenez exemple sur CommandService ;)
*/

export default class MessageCreate extends DiscordEvent<Events.MessageCreate> {
	commands: CommandService;
	constructor(client: Bot) {
		super(client, Events.MessageCreate);
		this.client = client;
		this.commands = new CommandService(this.client);
	}

	async run(message: Message) {
		if (!message.author.bot) {
			const channel = message.channel;
			if (channel.isSendable()) {
				//channel.send("test");
			}
		}
	}
}
