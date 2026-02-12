import { ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import Command from "../../utils/Command";
import { BaseContext } from "../../utils/Context";

export default class Ping extends Command {
	constructor() {
		super({
			type: ApplicationCommandType.ChatInput,
			name: "ping",
			category: "utils",
			description: "Test the latency of the bot to Discord."
		});
	}

	async run(ctx: BaseContext<ChatInputCommandInteraction>) {
		ctx.reply(`${ctx.client.ws.ping} ms`);
	}
}
