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
		const s = await linkIssuePR(message);
		if (s) channel.send(s);
	}
}

const linkIssuePR = async (message: Message): Promise<string | null> => {
	const regexIssuePR = new RegExp(/\b([\w-.]+#\d+)\b/, "g");
	const matches = message.content.match(regexIssuePR);
	if (!matches) return null;
	switch (matches.length) {
		case 1:
			return await toGitHubLink(matches[0]);
		default:
			return await Promise.all(matches.map(async match => `* ${await toGitHubLink(match)}`)).then(x =>
				x.join("\n")
			);
	}
};

const toGitHubLink = async (s: string) => {
	const [repository, number] = s.split("#");
	if (!process.env.GITHUB_TOKEN) return `[${s}](https://github.com/aeecleclair/${repository}/pull/${number})`;
	// See https://docs.github.com/en/rest/pulls/pulls?apiVersion=2026-03-10#get-a-pull-request
	const res = await fetch(`https://api.github.com/repos/aeecleclair/${repository}/pulls/${number}`, {
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
			"X-GitHub-Api-Version": "2026-03-10"
		}
	});
	if (res.status >= 400) return `[${s}](https://github.com/aeecleclair/${repository}/pull/${number})`;
	const PR = await res.json();
	return `[${s} - ${PR.title}](${PR.url}) (+${PR.additions} -${PR.deletions}) par ${PR.user.login}`;
};

export default ParsingService;
