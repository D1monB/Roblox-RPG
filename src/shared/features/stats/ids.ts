// Stable identifiers shared by profile, stats and (later) abilities.
// They are saved in player data, so they must never be renamed after release (see docs/classes-and-skills.md).

export const STAT_IDS = ["vitality", "mind", "strength", "dexterity", "intelligence"] as const;
export type StatId = (typeof STAT_IDS)[number];

export const CLASS_IDS = ["warrior", "mage", "archer"] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export function isStatId(value: unknown): value is StatId {
	return typeIs(value, "string") && (STAT_IDS as ReadonlyArray<string>).includes(value);
}

export function isClassId(value: unknown): value is ClassId {
	return typeIs(value, "string") && (CLASS_IDS as ReadonlyArray<string>).includes(value);
}
