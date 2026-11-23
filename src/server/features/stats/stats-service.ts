import { Players, ReplicatedStorage } from "@rbxts/services";
import { getProfileData, onProfileLoaded } from "server/features/profile";
import { STATS_REMOTES, STATS_REMOTE_FOLDER, allocatePoint, applyXp, buildStatsSnapshot } from "shared/features/stats";
import { RateLimiter } from "shared/lib/rate-limiter";

// Allocating is a deliberate click, so a short burst (e.g. spending several points in a row) is fine,
// but sustained spam is not.
const ALLOCATE_LIMIT = new RateLimiter(6, 3);
// Separate bucket, so spamming snapshot requests cannot use up the player's own allocations.
const REQUEST_LIMIT = new RateLimiter(2, 0.5);
// Limits how often we LOG abuse, so an attacker cannot flood our output either.
const LOG_LIMIT = new RateLimiter(2, 0.1);

let allocateRemote: RemoteEvent | undefined;
let requestRemote: RemoteEvent | undefined;
let changedRemote: RemoteEvent | undefined;
let levelUpRemote: RemoteEvent | undefined;

function createRemote(folder: Folder, name: string): RemoteEvent {
	const remote = new Instance("RemoteEvent");
	remote.Name = name;
	remote.Parent = folder;
	return remote;
}

function logAbuse(player: Player, reason: string): void {
	if (LOG_LIMIT.tryTake(player.UserId, os.clock())) {
		// UserId only: no names or other personal data in logs (CLAUDE.md).
		warn(`[stats] dropped request from ${player.UserId}: ${reason}`);
	}
}

/** Sends the player their own current stats. Does nothing if their data is not loaded. */
function sendSnapshot(player: Player): void {
	const data = getProfileData(player);
	if (data === undefined || changedRemote === undefined) {
		return;
	}
	changedRemote.FireClient(player, buildStatsSnapshot(data));
}

function handleAllocate(player: Player, args: Array<unknown>): void {
	const data = getProfileData(player);
	if (data === undefined) {
		// Not loaded or already leaving. Dropped before the limiter, so no bucket is created for a gone player.
		return;
	}
	if (!ALLOCATE_LIMIT.tryTake(player.UserId, os.clock())) {
		logAbuse(player, "rate limit");
		return;
	}
	if (args.size() !== 1) {
		logAbuse(player, "wrong argument count");
		return;
	}
	// allocatePoint checks the stat id type and value, and that the player has a point to spend.
	const result = allocatePoint({ allocated: data.allocatedStats, unspentPoints: data.unspentPoints }, args[0]);
	if (result === undefined) {
		logAbuse(player, "illegal allocation");
		return;
	}
	// No yield between the check and the write, so two fast requests cannot spend the same point twice.
	data.allocatedStats = result.allocated;
	data.unspentPoints = result.unspentPoints;
	sendSnapshot(player);
}

function handleRequest(player: Player, args: Array<unknown>): void {
	if (getProfileData(player) === undefined) {
		return;
	}
	if (!REQUEST_LIMIT.tryTake(player.UserId, os.clock())) {
		logAbuse(player, "rate limit");
		return;
	}
	if (args.size() !== 0) {
		logAbuse(player, "wrong argument count");
		return;
	}
	sendSnapshot(player);
}

/**
 * Gives XP to a player. SERVER-SIDE API only: combat calls it after a kill. No remote ever reaches it.
 * Returns true if the XP was applied. Handles level-ups and the points they give.
 */
export function grantXp(player: Player, amount: number): boolean {
	const data = getProfileData(player);
	if (data === undefined) {
		return false;
	}
	const result = applyXp({ level: data.level, xp: data.xp, unspentPoints: data.unspentPoints }, amount);
	if (result === undefined) {
		return false;
	}
	data.level = result.progression.level;
	data.xp = result.progression.xp;
	data.unspentPoints = result.progression.unspentPoints;

	sendSnapshot(player);
	if (result.levelsGained > 0) {
		levelUpRemote?.FireClient(player, data.level);
	}
	return true;
}

/** Creates the remotes and starts listening. Call once, after startProfileService(). */
export function startStatsService(): void {
	if (allocateRemote !== undefined) {
		return;
	}
	const folder = new Instance("Folder");
	folder.Name = STATS_REMOTE_FOLDER;
	allocateRemote = createRemote(folder, STATS_REMOTES.allocateStat);
	requestRemote = createRemote(folder, STATS_REMOTES.requestStats);
	changedRemote = createRemote(folder, STATS_REMOTES.statsChanged);
	levelUpRemote = createRemote(folder, STATS_REMOTES.levelUp);
	// Parent last, so the client never sees a half-built folder.
	folder.Parent = ReplicatedStorage;

	// Handlers take `...args` and check them by hand: TypeScript types do not exist at runtime,
	// and a client can send anything. A bad request is dropped, never thrown on.
	allocateRemote.OnServerEvent.Connect((player, ...args: Array<unknown>) => handleAllocate(player, args));
	requestRemote.OnServerEvent.Connect((player, ...args: Array<unknown>) => handleRequest(player, args));

	onProfileLoaded((player) => sendSnapshot(player));
	Players.PlayerRemoving.Connect((player) => {
		ALLOCATE_LIMIT.forget(player.UserId);
		REQUEST_LIMIT.forget(player.UserId);
		LOG_LIMIT.forget(player.UserId);
	});
}
