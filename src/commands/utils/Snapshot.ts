import { ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import Command from "../../utils/Command";
import { BaseContext } from "../../utils/Context";
import { fetchPlaneModuleSnapshots } from "../../utils/PlaneModuleSnapshots";

export default class Snapshot extends Command {
    constructor() {
        super({
            type: ApplicationCommandType.ChatInput,
            name: "snapshot",
            category: "utils",
            description: "Test the latency of the bot to Discord.",
            testCmd: true,
        });
    }

    async run(ctx: BaseContext<ChatInputCommandInteraction>) {

        const result = await fetchPlaneModuleSnapshots({
            apiKey: process.env.PLANE_API_KEY as string,
            projectId: process.env.PLANE_PROJECT_ID,
            workspaceSlug: process.env.WORKSPACE_SLUG,
        });
        console.log(result);

        ctx.reply(`${ctx.client.ws.ping} ms`);
    }
}
