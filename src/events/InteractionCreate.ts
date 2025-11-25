"use strict";

import { Events, Interaction } from "discord.js";
import CommandService from "../services/CommandService";
import DiscordEvent from "../utils/DiscordEvent";
import Bot from "../../main";
import AutoCompleteService from "../services/AutoCompleteService";

/*
L'évent interactionCreate n'est pas long car en faites les tâches sont répartis dans le dossier services prenez exemple sur CommandService ;)
*/

export default class InteractionCreate extends DiscordEvent<Events.InteractionCreate> {
	commands: CommandService;
	autoComplete: AutoCompleteService;
	constructor(client: Bot) {
		super(client, Events.InteractionCreate);
		this.client = client;
		this.commands = new CommandService(this.client);
		this.autoComplete = new AutoCompleteService(this.client);
	}

	async run(interaction: Interaction) {
		if (interaction.isCommand()) await this.commands.handle(interaction);
		if (interaction.isAutocomplete()) await this.autoComplete.handle(interaction);
	}
}
