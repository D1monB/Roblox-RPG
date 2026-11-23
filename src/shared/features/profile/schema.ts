import { t } from "@rbxts/t";
import { CLASS_IDS, ClassId, StatId } from "shared/features/stats";

/**
 * Bump this ONLY for changes that old saves cannot survive on their own
 * (renaming, removing, re-interpreting a field). Every bump needs a migration and a test:
 * see docs/profile-and-saving.md. Adding a new field with a default does NOT need a bump.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export type AllocatedStats = { [K in StatId]: number };

/**
 * What we save per player. Derived values (HP, mana, damage) are NOT stored: they are
 * calculated from this data, so changing a formula never breaks old saves.
 */
export interface ProfileData {
	schemaVersion: number;
	level: number;
	// Progress inside the current level (not total XP), see docs/stats-and-leveling.md.
	xp: number;
	// Chosen once at the start and never changed (docs/decisions.md #4). Undefined until chosen.
	classId?: ClassId;
	// Points the player has spent. Class starting values are added on top when stats are calculated.
	allocatedStats: AllocatedStats;
	unspentPoints: number;
	gold: number;
}

export function createDefaultProfileData(): ProfileData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		level: 1,
		xp: 0,
		allocatedStats: { vitality: 0, mind: 0, strength: 0, dexterity: 0, intelligence: 0 },
		unspentPoints: 0,
		gold: 0,
	};
}

// Structure check only. Value ranges are enforced by sanitize.ts before this runs.
// `interface` (not strictInterface) allows extra keys, so data from a newer feature is not rejected.
const profileDataShape = t.interface({
	schemaVersion: t.integer,
	level: t.integer,
	xp: t.integer,
	classId: t.optional(t.literalList([...CLASS_IDS])),
	allocatedStats: t.interface({
		vitality: t.integer,
		mind: t.integer,
		strength: t.integer,
		dexterity: t.integer,
		intelligence: t.integer,
	}),
	unspentPoints: t.integer,
	gold: t.integer,
});

export function isProfileData(value: unknown): value is ProfileData {
	return profileDataShape(value);
}
