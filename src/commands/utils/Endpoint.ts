"use strict";

import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
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
        
        if (!data.paths) {
            await ctx.reply("❌ Impossible de récupérer les endpoints de l'API.");
            return;
        }

        // Rechercher les endpoints qui correspondent à la requête
        const allPaths = Object.keys(data.paths);
        const matchingPaths = allPaths.filter(path => 
            path.toLowerCase().includes(endpointQuery.toLowerCase())
        );

        if (matchingPaths.length === 0) {
            await ctx.reply(`❌ Aucun endpoint trouvé pour la recherche: "${endpointQuery}"`);
            return;
        }

        if (matchingPaths.length > 10) {
            await ctx.reply(`🔍 **${matchingPaths.length} endpoints trouvés** pour "${endpointQuery}":\n\n` +
                `${matchingPaths.slice(0, 10).map((path, i) => `${i + 1}. \`${path}\``).join("\n")}\n\n` +
                `... et ${matchingPaths.length - 10} autres..`);
            return;
        }

        // Afficher les endpoints correspondants avec leurs détails
        let response = `🔍 **${matchingPaths.length} endpoint(s) trouvé(s)** pour "${endpointQuery}":\n\n`;

        for (const path of matchingPaths.slice(0, 5)) { // Limiter à 5 pour éviter les messages trop longs
            const pathInfo = data.paths[path];
            const methods = Object.keys(pathInfo).filter(method => 
                ["get", "post", "put", "patch", "delete"].includes(method)
            );

            response += `**\`${path}\`**\n`;
            
            for (const method of methods) {
                const methodInfo = pathInfo[method];
                const summary = methodInfo.summary || "Pas de description";
                response += `  • \`${method.toUpperCase()}\`: ${summary}\n`;
            }
            response += "\n";
        }

        if (matchingPaths.length > 5) {
            response += `... et ${matchingPaths.length - 5} autres endpoints.`;
        }

        await ctx.reply(response);
    }
}