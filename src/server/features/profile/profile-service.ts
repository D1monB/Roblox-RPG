import { Players } from "@rbxts/services";
import { ProfileData } from "shared/features/profile";
import { ProfileSessions } from "./profile-sessions";
import { createRobloxBackend } from "./roblox-backend";

let sessions: ProfileSessions | undefined;

function kickPlayer(userId: number, message: string): void {
	Players.GetPlayerByUserId(userId)?.Kick(message);
}

const loadedListeners: Array<(player: Player) => void> = [];

/** Runs `callback` each time a player's data finishes loading. Register before startProfileService(). */
export function onProfileLoaded(callback: (player: Player) => void): void {
	loadedListeners.push(callback);
}

/** Starts loading data for every player who joins. Call once, before any other feature reads player data. */
export function startProfileService(): void {
	if (sessions !== undefined) {
		return;
	}
	const created = new ProfileSessions(createRobloxBackend(), kickPlayer, (message) => warn(`[profile] ${message}`));
	sessions = created;

	created.onLoaded((userId) => {
		const player = Players.GetPlayerByUserId(userId);
		if (player === undefined) {
			return;
		}
		for (const listener of loadedListeners) {
			listener(player);
		}
	});

	Players.PlayerAdded.Connect((player) => created.playerAdded(player.UserId));
	Players.PlayerRemoving.Connect((player) => created.playerRemoving(player.UserId));

	// Players who joined before this script ran (happens in Studio).
	for (const player of Players.GetPlayers()) {
		task.spawn(() => created.playerAdded(player.UserId));
	}
}

/**
 * The player's live data, or undefined if it is not loaded (yet). Server only.
 * Call it fresh for every operation and never keep the result: after the player leaves or the session is
 * lost, a kept table can still be changed but is no longer saved, which makes side effects (e.g. granting
 * an item elsewhere) a duplication risk. Value-moving features must re-check before they write.
 */
export function getProfileData(player: Player): ProfileData | undefined {
	return sessions?.getData(player.UserId);
}
