"use strict";

import { ClientEvents } from "discord.js";
import Bot from "../../main";

abstract class DiscordEvent<Event extends keyof ClientEvents> {
	client: Bot;
	name: Event;
	// eslint-disable-next-line no-unused-vars
	public abstract run(...args: ClientEvents[Event]): Promise<void> | void;
	constructor(client: Bot, name: Event) {
		if (this.constructor === DiscordEvent) throw new Error("Event class is an abstract class");
		this.client = client;
		this.name = name;
	}
}

export default DiscordEvent;
