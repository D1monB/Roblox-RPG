// Derived stats are calculated on the fly and never saved, so changing a formula
// cannot break old saves (docs/stats-and-leveling.md).
import { StatPoints, classUsesMana, startingStats } from "./class-definitions";
import { ClassId } from "./ids";

const BASE_HEALTH = 100;
const HEALTH_PER_VITALITY = 10;
const BASE_MANA = 50;
const MANA_PER_MIND = 8;
const FIXED_ENERGY = 100;

export interface DerivedStats {
	maxHealth: number;
	// Only the mage has mana, the others have energy. The unused one is undefined, not 0,
	// so callers cannot accidentally treat "no resource" as "empty resource".
	maxMana: number | undefined;
	maxEnergy: number | undefined;
}

/** Total stat value = class starting value + points the player has spent. */
export function totalStats(classId: ClassId, allocated: StatPoints): StatPoints {
	const start = startingStats(classId);
	return {
		vitality: start.vitality + allocated.vitality,
		mind: start.mind + allocated.mind,
		strength: start.strength + allocated.strength,
		dexterity: start.dexterity + allocated.dexterity,
		intelligence: start.intelligence + allocated.intelligence,
	};
}

export function calculateDerivedStats(classId: ClassId, allocated: StatPoints): DerivedStats {
	const total = totalStats(classId, allocated);
	const usesMana = classUsesMana(classId);
	return {
		maxHealth: BASE_HEALTH + total.vitality * HEALTH_PER_VITALITY,
		maxMana: usesMana ? BASE_MANA + total.mind * MANA_PER_MIND : undefined,
		maxEnergy: usesMana ? undefined : FIXED_ENERGY,
	};
}
