"use strict";

import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, ComponentType } from "discord.js";
import Command from "../../utils/Command";
import { BaseContext } from "../../utils/Context";
import { inspect } from "util";

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
        const res = await fetch(`${process.env.HYPERION_URL}/openapi.json`);
        const data = await res.json();

        const endpointQuery = ctx.args.getString("endpoint");
        
        const msg = await ctx.reply({
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

        msg.createMessageComponentCollector({
            filter: (i) => i.user.id === ctx.author.id,
            time: 15*60000,
        }).on("collect", async (interaction) => {
            if (!interaction.isStringSelectMenu() || interaction.customId !== "endpoint_methods_select") return;
            const selectedMethod = interaction.values[0];
            const methodData = data.paths[endpointQuery][selectedMethod];

            const formattedMethodData = inspect(methodData, {
                depth: 4,
                colors: false,
                maxArrayLength: null,
            });
            
            await interaction.update({
                embeds: [{
                    author: {
                        name: `Endpoint: ${endpointQuery} [${selectedMethod.toUpperCase()}] - (Click to go to the swagger)`,
                        url: `${process.env.HYPERION_URL}/docs#/${methodData.tags[0]}/${methodData.operationId}`,
                    },
                    description: `\`\`\`js\n${formattedMethodData.slice(0, 3600)}\n\`\`\``,
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
                            default: method === selectedMethod,
                        })),
                    }],
                }]
            });
        });
        
    }
}