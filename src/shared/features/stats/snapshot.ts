// What the server tells a player about their OWN stats. Read-only for the client: it renders this
// and never sends computed values back (CLAUDE.md, Authority).
import { StatPoints } from "./class-definitions";
import { DerivedStats, calculateDerivedStats } from "./derived-stats";
import { xpToNextLevel } from "./formulas";
import { ClassId } from "./ids";

export interface StatsSnapshot {
	level: number;
	xp: number;
	// Undefined at max level: there is no next level to fill the XP bar towards.
	xpToNext: number | undefined;
	unspentPoints: number;
	allocated: StatPoints;
	// Undefined until the player has chosen a class.
	derived: DerivedStats | undefined;
}

export interface SnapshotSource {
	level: number;
	xp: number;
	unspentPoints: number;
	allocatedStats: StatPoints;
	classId?: ClassId;
}

export function buildStatsSnapshot(source: SnapshotSource): StatsSnapshot {
	return {
		level: source.level,
		xp: source.xp,
		xpToNext: xpToNextLevel(source.level),
		unspentPoints: source.unspentPoints,
		allocated: { ...source.allocatedStats },
		derived:
			source.classId === undefined ? undefined : calculateDerivedStats(source.classId, source.allocatedStats),
	};
}
