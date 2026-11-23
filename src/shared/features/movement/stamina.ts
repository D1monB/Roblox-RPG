// Stamina math. Pure: the caller passes the time, so it runs in unit tests without Roblox.
import { STAMINA } from "./tuning";

export interface Stamina {
	current: number;
	// Time of the last spend, for the regen delay. undefined = never spent.
	lastSpentAt: number | undefined;
}

export function fullStamina(): Stamina {
	return { current: STAMINA.max, lastSpentAt: undefined };
}

/** Bad time steps (negative, NaN, infinite) count as no time passing, instead of breaking the value. */
function safeStep(dt: number): number {
	return dt > 0 && dt < math.huge ? dt : 0;
}

/** All-or-nothing spend (a roll). Returns undefined if there is not enough stamina or the cost is invalid. */
export function trySpend(stamina: Stamina, cost: number, now: number): Stamina | undefined {
	if (!(cost > 0 && cost < math.huge) || stamina.current < cost) {
		return undefined;
	}
	return { current: stamina.current - cost, lastSpentAt: now };
}

/** Continuous drain (sprint). Never goes below 0. */
export function drain(stamina: Stamina, perSecond: number, dt: number, now: number): Stamina {
	const step = safeStep(dt);
	if (step === 0) {
		return stamina;
	}
	return { current: math.max(0, stamina.current - perSecond * step), lastSpentAt: now };
}

/** Regeneration after the delay. Never goes above max. */
export function regenerate(stamina: Stamina, dt: number, now: number): Stamina {
	const step = safeStep(dt);
	const waited = stamina.lastSpentAt === undefined || now - stamina.lastSpentAt >= STAMINA.regenDelay;
	if (step === 0 || !waited || stamina.current >= STAMINA.max) {
		return stamina;
	}
	return {
		current: math.min(STAMINA.max, stamina.current + STAMINA.regenPerSecond * step),
		lastSpentAt: stamina.lastSpentAt,
	};
}
