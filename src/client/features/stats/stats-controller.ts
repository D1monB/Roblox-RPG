import { ReplicatedStorage } from "@rbxts/services";
import { STATS_REMOTES, STATS_REMOTE_FOLDER, StatId, StatsSnapshot } from "shared/features/stats";

// The client only displays what the server says and sends intent ("spend a point on X").
// It never computes results itself.
let latest: StatsSnapshot | undefined;
let allocateRemote: RemoteEvent | undefined;
const snapshotListeners: Array<(snapshot: StatsSnapshot) => void> = [];
const levelUpListeners: Array<(level: number) => void> = [];

/** The last snapshot received, or undefined before the first one arrives. */
export function getStatsSnapshot(): StatsSnapshot | undefined {
	return latest;
}

/** UI subscribes here. The listener is called on every change from the server. */
export function onStatsChanged(listener: (snapshot: StatsSnapshot) => void): void {
	snapshotListeners.push(listener);
	if (latest !== undefined) {
		listener(latest);
	}
}

export function onLevelUp(listener: (level: number) => void): void {
	levelUpListeners.push(listener);
}

/** Asks the server to spend one point. The server may refuse; the UI waits for the new snapshot. */
export function requestAllocate(statId: StatId): void {
	allocateRemote?.FireServer(statId);
}

export function startStatsController(): void {
	if (allocateRemote !== undefined) {
		return;
	}
	const folder = ReplicatedStorage.WaitForChild(STATS_REMOTE_FOLDER) as Folder;
	allocateRemote = folder.WaitForChild(STATS_REMOTES.allocateStat) as RemoteEvent;
	const requestRemote = folder.WaitForChild(STATS_REMOTES.requestStats) as RemoteEvent;
	const changedRemote = folder.WaitForChild(STATS_REMOTES.statsChanged) as RemoteEvent;
	const levelUpRemote = folder.WaitForChild(STATS_REMOTES.levelUp) as RemoteEvent;

	changedRemote.OnClientEvent.Connect((snapshot: StatsSnapshot) => {
		latest = snapshot;
		for (const listener of snapshotListeners) {
			listener(snapshot);
		}
	});
	levelUpRemote.OnClientEvent.Connect((level: number) => {
		for (const listener of levelUpListeners) {
			listener(level);
		}
	});

	// We may have started after the server's first push, so ask once.
	requestRemote.FireServer();
}
