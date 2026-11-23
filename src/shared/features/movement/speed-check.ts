// Anti-speedhack plausibility check. Roblox lets the client move its own character (network ownership),
// so the server cannot prevent movement, only judge whether it was possible. Pure numbers for unit tests.
//
// Works like a token bucket of DISTANCE: the budget refills at the fastest legal speed (with a small
// tolerance) and is capped at a short burst. A lag spike that delivers 1 s of movement at once fits in
// the burst; sustained movement faster than the legal speed drains the budget and fails.
// (A fixed slack added to every window would instead become a standing speed bonus.)
import { ROLL, SPEED_CHECK } from "./tuning";

export interface MoveSample {
	// Position change between two server samples, in studs.
	dx: number;
	dy: number;
	dz: number;
	// Seconds between the samples.
	dt: number;
}

export interface SpeedBudget {
	// Horizontal studs the player may still move right now.
	flat: number;
	// Upward studs the player may still rise right now.
	rise: number;
	// Extra horizontal studs earned by a roll the server ACCEPTED. Not capped by the burst limit, because
	// a roll on top of a sprint is legal; the caller expires it shortly after the roll.
	credit: number;
}

export interface SpeedVerdict {
	plausible: boolean;
	budget: SpeedBudget;
}

function isFiniteNumber(value: number): boolean {
	// NaN fails every comparison, so this also rejects NaN.
	return value > -math.huge && value < math.huge;
}

/** A full budget: a freshly (re)anchored player may use one full burst. */
export function fullSpeedBudget(maxSpeed: number): SpeedBudget {
	return {
		flat: maxSpeed * SPEED_CHECK.burstSeconds,
		rise: SPEED_CHECK.maxRiseSpeed * SPEED_CHECK.burstSeconds,
		credit: 0,
	};
}

/** The server accepted a roll: allow its distance on top of normal movement. Set, not added, so rolls do not stack. */
export function grantRollCredit(budget: SpeedBudget): SpeedBudget {
	return { ...budget, credit: ROLL.distance };
}

/** Takes the roll credit away again (the roll is over). */
export function clearRollCredit(budget: SpeedBudget): SpeedBudget {
	return { ...budget, credit: 0 };
}

/**
 * Judges one move and returns the new budget. Falling is never limited (gravity is legal); rising is,
 * so fly-up hacks fail. Broken numbers (NaN, infinity) are never plausible.
 * On a failed move nothing is spent: the server returns the player to the last valid position.
 */
export function checkMove(budget: SpeedBudget, sample: MoveSample, maxSpeed: number): SpeedVerdict {
	const { dx, dy, dz, dt } = sample;
	if (!isFiniteNumber(dx) || !isFiniteNumber(dy) || !isFiniteNumber(dz) || !isFiniteNumber(dt)) {
		return { plausible: false, budget };
	}
	const step = math.max(0, dt);
	const cap = fullSpeedBudget(maxSpeed);
	const refilled: SpeedBudget = {
		flat: math.min(cap.flat, budget.flat + maxSpeed * SPEED_CHECK.tolerance * step),
		rise: math.min(cap.rise, budget.rise + SPEED_CHECK.maxRiseSpeed * SPEED_CHECK.tolerance * step),
		credit: budget.credit,
	};
	const flat = math.sqrt(dx * dx + dz * dz);
	const rise = math.max(0, dy);
	if (flat > refilled.flat + refilled.credit || rise > refilled.rise) {
		return { plausible: false, budget: refilled };
	}
	// The normal budget pays first; the roll credit only covers what is left over.
	const fromBudget = math.min(refilled.flat, flat);
	return {
		plausible: true,
		budget: {
			flat: refilled.flat - fromBudget,
			rise: refilled.rise - rise,
			credit: refilled.credit - (flat - fromBudget),
		},
	};
}
