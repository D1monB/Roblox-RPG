import { MAX_LEVEL, STAT_IDS, isClassId } from "shared/features/stats";
import { PlainTable } from "shared/lib/tables";

// Upper bounds keep a corrupted number from overflowing later math. Real values stay far below them.
const MAX_STAT_POINTS = 1000;
const MAX_UNSPENT_POINTS = 1000;
const MAX_COUNTER = 1_000_000_000_000;

function repairInteger(
	target: PlainTable,
	key: string,
	min: number,
	max: number,
	fallback: number,
	path: string,
	repairs: string[],
): void {
	const value = target[key];
	let fixed: number;
	if (!typeIs(value, "number") || value !== value) {
		// Wrong type or NaN: no meaningful value to keep.
		fixed = fallback;
	} else {
		// Clamping also handles +/- infinity. Floor removes fractions.
		fixed = math.clamp(math.floor(value), min, max);
	}
	if (fixed !== value) {
		target[key] = fixed;
		repairs.push(path);
	}
}

/**
 * Forces known fields into their valid ranges and types. Runs after migration, before the data is used.
 * Returns the paths it had to repair, so the caller can log them (an exploit or a bug may be behind it).
 * Unknown keys are left alone.
 */
export function sanitize(data: PlainTable): string[] {
	const repairs: string[] = [];

	repairInteger(data, "level", 1, MAX_LEVEL, 1, "level", repairs);
	repairInteger(data, "xp", 0, MAX_COUNTER, 0, "xp", repairs);
	repairInteger(data, "unspentPoints", 0, MAX_UNSPENT_POINTS, 0, "unspentPoints", repairs);
	repairInteger(data, "gold", 0, MAX_COUNTER, 0, "gold", repairs);

	let stats = data.allocatedStats;
	if (!typeIs(stats, "table")) {
		stats = {};
		data.allocatedStats = stats;
		repairs.push("allocatedStats");
	}
	for (const statId of STAT_IDS) {
		repairInteger(stats as PlainTable, statId, 0, MAX_STAT_POINTS, 0, `allocatedStats.${statId}`, repairs);
	}

	if (data.classId !== undefined && !isClassId(data.classId)) {
		data.classId = undefined;
		repairs.push("classId");
	}

	return repairs;
}
