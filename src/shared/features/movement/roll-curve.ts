// Shape of a roll over time, Dark Souls style: a burst of speed at the start that fades out, and one
// full somersault. Pure functions of progress (0 = start, 1 = end) so they are unit tested without Roblox.
import { ROLL } from "./tuning";

// Speed decays as (1 - p)^2, whose area is 1/3 of the start speed * duration, so this start speed
// makes the roll travel exactly ROLL.distance.
export const ROLL_START_SPEED = (3 * ROLL.distance) / ROLL.duration;

/** Keeps progress in 0..1. NaN and negative numbers count as 0. */
function clamp01(progress: number): number {
	if (!(progress > 0)) {
		return 0;
	}
	return progress > 1 ? 1 : progress;
}

/** How far into the roll we are, 0..1, from the seconds since it started. */
export function rollProgress(elapsedSeconds: number): number {
	return clamp01(elapsedSeconds / ROLL.duration);
}

/** Ground speed in studs/s at this point of the roll: fast at the start, zero at the end. */
export function rollSpeedAt(progress: number): number {
	const remaining = 1 - clamp01(progress);
	return ROLL_START_SPEED * remaining * remaining;
}

// How long the character takes to curl up and to straighten out, as a share of the roll.
const TUCK_RAMP = 0.2;

/**
 * How curled up the body is, 0 (standing) .. 1 (fully tucked): curls up quickly, stays tucked while
 * rolling over, then straightens out so the landing is upright. Smooth at both ends.
 */
export function rollTuckAt(progress: number): number {
	const t = clamp01(progress);
	const edge = math.min(t, 1 - t) / TUCK_RAMP;
	const x = edge >= 1 ? 1 : edge;
	// Smoothstep: no sudden jump when the pose starts or ends.
	return x * x * (3 - 2 * x);
}

/**
 * Forward pitch of the body in radians (negative = forward flip): eased in and out, one full turn.
 * It starts and ends at exactly 0 so the character lands upright.
 */
export function rollAngleAt(progress: number): number {
	const t = clamp01(progress);
	let eased: number;
	if (t < 0.5) {
		eased = 2 * t * t;
	} else {
		const rest = -2 * t + 2;
		eased = 1 - (rest * rest) / 2;
	}
	return -2 * math.pi * eased;
}
