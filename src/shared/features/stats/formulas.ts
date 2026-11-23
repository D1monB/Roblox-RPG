// Pure stat math. No Roblox API calls here, so it runs under Lune in unit tests (CLAUDE.md rule 3).

export const MAX_LEVEL = 100;

// Tuning values live in one place so balance changes do not touch logic.
const BASE_XP = 100;
const GROWTH_EXPONENT = 1.5;

function isValidLevel(level: number): boolean {
	// `level === level` is false only for NaN; math.floor check rejects fractions and infinities.
	return level === level && level >= 1 && level <= MAX_LEVEL && math.floor(level) === level;
}

/**
 * XP needed to go from `level` to `level + 1`.
 * Returns undefined for invalid input instead of throwing: callers may pass values
 * that came from the network, and bad input must be dropped, not crash the server.
 */
export function xpToNextLevel(level: number): number | undefined {
	if (!isValidLevel(level) || level === MAX_LEVEL) {
		return undefined;
	}
	return math.floor(BASE_XP * level ** GROWTH_EXPONENT);
}
