// stats feature (shared): stat definitions and pure stat/XP math.
// Public API of this feature. Other code imports only from this file.
export { classUsesMana, emptyStatPoints, startingStats } from "./class-definitions";
export type { StatPoints } from "./class-definitions";
export { calculateDerivedStats, totalStats } from "./derived-stats";
export type { DerivedStats } from "./derived-stats";
export { MAX_STAT_POINTS, MAX_UNSPENT_POINTS } from "./limits";
export { MAX_LEVEL, xpToNextLevel } from "./formulas";
export { CLASS_IDS, STAT_IDS, isClassId, isStatId } from "./ids";
export type { ClassId, StatId } from "./ids";
export { STATS_REMOTES, STATS_REMOTE_FOLDER } from "./network";
export { buildStatsSnapshot } from "./snapshot";
export type { SnapshotSource, StatsSnapshot } from "./snapshot";
export { MAX_XP_PER_GRANT, POINTS_PER_LEVEL, allocatePoint, applyXp } from "./progression";
export type { Allocation, Progression, XpResult } from "./progression";
