"use strict";

import { ApplicationCommandOptionType, ApplicationCommandType, ChannelType, ChatInputCommandInteraction, ComponentType } from "discord.js";
import Command from "../../utils/Command";
import { CachedGuildContext } from "../../utils/Context";
import prisma from "../../utils/PrismaClient";

export default class SetLogsChannel extends Command {
    constructor() {
        super({
            type: ApplicationCommandType.ChatInput,
            name: "permanence",
            category: "utils",
            description: "Configure the permanence settings and your availability.",
            options: [{
                type: ApplicationCommandOptionType.Subcommand,
                name: "channel",
                description: "Channel where permanence messages will be sent.",
                options: [{
                    type: ApplicationCommandOptionType.Channel,
                    name: "channel",
                    description: "Permanence channel",
                    required: true,
                    channelTypes: [ChannelType.GuildText]
                }]
            }, {
                type: ApplicationCommandOptionType.Subcommand,
                name: "availability",
                description: "Set your availability status for permanence.",
            }]
        });
    }

    async run(ctx: CachedGuildContext<ChatInputCommandInteraction<"cached">>) {

        if (ctx.args.getSubcommand() === "channel") {
            const channel = ctx.interaction.channel;
            if (!channel || !channel.isSendable()) {
                return ctx.reply("The specified channel is not valid or I don't have permission to send messages there.");
            }

            await ctx.updateGuildSettings({
                permanenceChannelId: channel.id
            });

            return ctx.reply(`Permanence channel has been set to ${channel}.`);

        } else if (ctx.args.getSubcommand() === "availability") {

            const currentAvailability = await getAvailability(ctx.author.id);
            const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
            const formattedDays = days.map((day, index) => {
                const isAvailable = currentAvailability.includes(index);
                const emoji = isAvailable ? "✅" : "❌";
                return `${emoji} ${day}`;
            }).join("\n");

            const messageEmbedMenu = await ctx.reply({
                embeds: [{
                    title: "Définissez votre disponibilité",
                    description: `Votre disponibilité actuelle:\n\n${formattedDays}\n\nSélectionnez les jours où vous êtes disponible pour la permanence.`,
                }],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.StringSelect,
                                customId: "availability_select",
                                placeholder: "Sélectionnez vos jours disponibles",
                                minValues: 0,
                                maxValues: 5,
                                options: days.map((day, index) => ({
                                    label: day,
                                    value: index.toString(),
                                    default: currentAvailability.includes(index)
                                }))
                            }
                        ]
                    }
                ]
            });

            const collector = messageEmbedMenu.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 120000
            });
            collector.on("collect", async (interaction) => {
                if (interaction.user.id !== ctx.author.id) {
                    return interaction.reply({ content: "Vous ne pouvez pas interagir avec ce menu.", ephemeral: true });
                }
                const selectedDays = interaction.values.map(v => parseInt(v));
                await prisma.availability.deleteMany({
                    where: {
                        userId: ctx.author.id
                    }
                });

                for (const day of selectedDays) {
                    await prisma.availability.create({
                        data: {
                            userId: ctx.author.id,
                            day: day
                        }
                    });
                }

                await interaction.update({
                    content: "Vos disponibilités ont été mises à jour avec succès !",
                    embeds: [],
                    components: []
                });
            });


        }


    }
}

export async function getAvailability(userId: string) {
    const availabilityFromDb = await prisma.availability.findMany({
        where: {
            userId: userId
        }
    });
    return availabilityFromDb.map(a => a.day);
}