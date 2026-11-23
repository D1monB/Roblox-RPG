// Network contract for the stats feature: names only, no logic.
// The server creates these RemoteEvents inside one folder in ReplicatedStorage; the client waits for them.
export const STATS_REMOTE_FOLDER = "StatsRemotes";

export const STATS_REMOTES = {
	// client -> server: one argument, a stat id (string). Intent only: "spend 1 point on this stat".
	allocateStat: "AllocateStat",
	// client -> server: no arguments. Asks for the current snapshot (the client may start after the first push).
	requestStats: "RequestStats",
	// server -> client: a StatsSnapshot for the receiving player only.
	statsChanged: "StatsChanged",
	// server -> client: the new level (number), for a celebration effect.
	levelUp: "LevelUp",
} as const;
