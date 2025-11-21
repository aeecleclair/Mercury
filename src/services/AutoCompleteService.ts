"use strict";

import Bot from "../../main";
import { AutocompleteInteraction } from "discord.js";

interface CacheEntry {
	data: {paths?: []};
	timestamp: number;
}

class AutoCompleteService {
    private _client: Bot;
	private apiResponseCache: Map<string, CacheEntry>;
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	constructor(client: Bot) {
		this._client = client;
		this.apiResponseCache = new Map();
	}

	private isCacheValid(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp < this.CACHE_DURATION;
	}

	private async getCachedOrFetch(url: string): Promise<{paths?: []}> {
		const cached = this.apiResponseCache.get(url);
		
		if (cached && this.isCacheValid(cached)) {
			return cached.data;
		}

		const res = await fetch(url);
		const data = await res.json();
		
		this.apiResponseCache.set(url, {
			data,
			timestamp: Date.now()
		});

		return data;
	}

	async handle(interaction: AutocompleteInteraction) {
		const command = this._client.commands.findCommand(interaction.commandName);

		if (!command) return;

		const focusedValue = interaction.options.getFocused();

		if (!focusedValue) return;

		if (command.name === "endpoint") {
			const apiUrl = `${this._client.config.hyperionUrl}/openapi.json`;
			const data = await this.getCachedOrFetch(apiUrl);

			const allPaths = Object.keys(data.paths);
			const matchingPaths = allPaths.filter(path => 
				path.toLowerCase().includes(focusedValue.toLowerCase())
			);

			interaction.respond(
				matchingPaths.slice(0, 20).map(path => ({ name: path, value: path }))
			);
			return;
		}
	}
}

export default AutoCompleteService;
