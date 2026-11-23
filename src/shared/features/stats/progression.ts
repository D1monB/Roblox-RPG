// Pure leveling and point-spending rules. Every function returns a NEW state, or undefined
// when the request is illegal. Inputs may come from the network, so nothing here throws.
import { StatPoints } from "./class-definitions";
import { MAX_LEVEL, xpToNextLevel } from "./formulas";
import { isStatId } from "./ids";
import { MAX_STAT_POINTS, MAX_UNSPENT_POINTS } from "./limits";

export const POINTS_PER_LEVEL = 1;

// One reward is never close to this. The cap only stops a corrupted or abused number
// from looping the level-up code millions of times.
export const MAX_XP_PER_GRANT = 1_000_000;

export interface Progression {
	level: number;
	// Progress inside the current level, not total XP.
	xp: number;
	unspentPoints: number;
}

export interface XpResult {
	progression: Progression;
	levelsGained: number;
}

function isWholeNumber(value: unknown): value is number {
	// NaN fails the self-comparison, infinities fail the range check, floor rejects fractions.
	return typeIs(value, "number") && value === value && math.abs(value) < math.huge && math.floor(value) === value;
}

/**
 * Adds XP and applies as many level-ups as it pays for. At MAX_LEVEL the XP is dropped
 * (stored xp stays 0) so a maxed player cannot overflow the counter.
 */
export function applyXp(current: Progression, gained: number): XpResult | undefined {
	if (!isWholeNumber(gained) || gained <= 0 || gained > MAX_XP_PER_GRANT) {
		return undefined;
	}
	if (current.level < 1 || current.level > MAX_LEVEL) {
		return undefined;
	}

	let level = current.level;
	let xp = current.xp + gained;
	let unspentPoints = current.unspentPoints;
	let levelsGained = 0;

	while (level < MAX_LEVEL) {
		const needed = xpToNextLevel(level);
		if (needed === undefined || xp < needed) {
			break;
		}
		// The reward point would not fit in the saved counter (loading would cut it off). Keep the XP
		// and the level for now: the level-up happens once the player has spent points. Nothing is lost.
		if (unspentPoints + POINTS_PER_LEVEL > MAX_UNSPENT_POINTS) {
			break;
		}
		xp -= needed;
		level += 1;
		levelsGained += 1;
		unspentPoints += POINTS_PER_LEVEL;
	}
	if (level === MAX_LEVEL) {
		xp = 0;
	}

	return { progression: { level, xp, unspentPoints }, levelsGained };
}

export interface Allocation {
	allocated: StatPoints;
	unspentPoints: number;
}

/**
 * Spends one point on `statId`. Returns undefined for an unknown stat, when no points are left, or when the
 * stat is already at its saved maximum (the point would be cut off on the next load, so it stays unspent).
 */
export function allocatePoint(current: Allocation, statId: unknown): Allocation | undefined {
	if (!isStatId(statId)) {
		return undefined;
	}
	if (!isWholeNumber(current.unspentPoints) || current.unspentPoints < 1) {
		return undefined;
	}
	if (current.allocated[statId] >= MAX_STAT_POINTS) {
		return undefined;
	}
	const allocated: StatPoints = { ...current.allocated };
	allocated[statId] += 1;
	return { allocated, unspentPoints: current.unspentPoints - 1 };
}
