"use strict";

import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, ComponentType } from "discord.js";
import Command from "../../utils/Command";
import { BaseContext } from "../../utils/Context";

export default class Botinfo extends Command {
    constructor() {
        super({
            type: ApplicationCommandType.ChatInput,
            name: "endpoint",
            category: "utils",
            description: "Fetch info of the Hyperion API.",
            options: [{
                name: "endpoint",
                type: ApplicationCommandOptionType.String,
                description: "The endpoint to fetch.",
                required: true,
                autocomplete: true,
            }],
            testCmd: true,
        });
    }

    async run(ctx: BaseContext<ChatInputCommandInteraction>) {
        console.debug(ctx.client.config.hyperionUrl);
        const res = await fetch(`${ctx.client.config.hyperionUrl}/openapi.json`);
        const data = await res.json();

        const endpointQuery = ctx.args.getString("endpoint");
        
        console.debug(data.paths[endpointQuery]);
        
        await ctx.reply({
            embeds: [{
                title: `Endpoint: ${endpointQuery}`,
            }],
            components: [{
                type: ComponentType.ActionRow,
                components: [{
                    type: ComponentType.StringSelect,
                    customId: "endpoint_methods_select",
                    placeholder: "Select a method",
                    options: Object.keys(data.paths[endpointQuery]).map((method: string) => ({
                        label: method.toUpperCase(),
                        value: method,
                    })),
                }],
            }]
        });
    }
}