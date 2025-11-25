"use strict";

import Bot from "../../main";
import { Message } from "discord.js";

class ParsingService {
	client: Bot;
	constructor(client: Bot) {
		this.client = client;
	}

	async handle(message: Message) {
		if (message.author.bot) return;
		const channel = message.channel;
		if (!channel.isSendable()) return;

		// channel.sendTyping(); // can't stop it manually if no message is to be sent

		// Only 1 parsing for now
		//this.client.logger.info(`Parsing ${parsing} executed by ${ctx.author.username}`);
		const s = linkIssuePR(message);
		if (s) channel.send(s);
	}
}

const linkIssuePR = (message: Message): string | null => {
	const regexIssuePR = new RegExp(/\b(\w+#\d+)\b/, "g");
	const matches = message.content.match(regexIssuePR);
	if (!matches) return null;
	switch (matches.length) {
		case 1:
			return toGitHubLink(matches[0]);
		default:
			return matches.map(match => `* ${toGitHubLink(match)}`).join("\n");
	}
};

const toGitHubLink = (s: string) => {
	const [repository, number] = s.split("#");
	return `[${s}](https://github.com/aeecleclair/${repository}/pull/${number})`;
};

export default ParsingService;
