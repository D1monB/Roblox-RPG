import { ClassId, StatId } from "./ids";

// Game content as DATA (CLAUDE.md rule 4): balance changes touch this file, not the logic.
// Every class gets the same 16-point budget so no class starts stronger (docs/decisions.md #17).
// Stats not listed here start at 0.
export type StatPoints = { [K in StatId]: number };

const START_STATS: { [K in ClassId]: Partial<StatPoints> } = {
	warrior: { vitality: 8, strength: 8 },
	mage: { mind: 8, intelligence: 8 },
	archer: { vitality: 8, dexterity: 8 },
};

// Mana is for the mage only. Warrior and archer use a fixed energy pool (docs/decisions.md #9).
const USES_MANA: { [K in ClassId]: boolean } = {
	warrior: false,
	mage: true,
	archer: false,
};

export function emptyStatPoints(): StatPoints {
	return { vitality: 0, mind: 0, strength: 0, dexterity: 0, intelligence: 0 };
}

export function startingStats(classId: ClassId): StatPoints {
	const base = emptyStatPoints();
	const start = START_STATS[classId];
	return {
		vitality: start.vitality ?? base.vitality,
		mind: start.mind ?? base.mind,
		strength: start.strength ?? base.strength,
		dexterity: start.dexterity ?? base.dexterity,
		intelligence: start.intelligence ?? base.intelligence,
	};
}

export function classUsesMana(classId: ClassId): boolean {
	return USES_MANA[classId];
}
