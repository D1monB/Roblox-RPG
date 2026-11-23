// Movement state machine for one player. Pure: every function returns a NEW state and takes the time
// as an argument, so the whole movement ruleset is unit tested without Roblox.
// The server owns the real state; the client only predicts its own roll (docs/movement.md).
import { Stamina, drain, fullStamina, regenerate, trySpend } from "./stamina";
import { ROLL, ROLL_SPEED, SPEEDS, STAMINA } from "./tuning";

export type MovementMode = "normal" | "sprinting" | "rolling" | "stunned" | "dead";

export interface MovementState {
	mode: MovementMode;
	stamina: Stamina;
	// What the player WANTS (sprint key held). The mode is what the rules ALLOW.
	sprintHeld: boolean;
	// Set when stamina hits 0 during a sprint; cleared at STAMINA.sprintResumeAt.
	exhausted: boolean;
	rollStartedAt: number | undefined;
	stunnedUntil: number | undefined;
}

export type RollRefusal = "state" | "cooldown" | "stamina";

export interface RollResult {
	state: MovementState;
	// undefined = the roll was accepted.
	refusal: RollRefusal | undefined;
}

// Which mode may follow which. Anything not listed is refused.
// A roll cannot be stunned out of (it is the "get out" button); death always wins.
const TRANSITIONS: { [K in MovementMode]: ReadonlyArray<MovementMode> } = {
	normal: ["sprinting", "rolling", "stunned", "dead"],
	sprinting: ["normal", "rolling", "stunned", "dead"],
	rolling: ["normal", "dead"],
	stunned: ["normal", "dead"],
	dead: ["normal"],
};

export function canTransition(from: MovementMode, to: MovementMode): boolean {
	return TRANSITIONS[from].includes(to);
}

/** State of a freshly spawned character. */
export function initialMovementState(): MovementState {
	return {
		mode: "normal",
		stamina: fullStamina(),
		sprintHeld: false,
		exhausted: false,
		rollStartedAt: undefined,
		stunnedUntil: undefined,
	};
}

function canStartSprint(state: MovementState): boolean {
	return state.mode === "normal" && state.sprintHeld && !state.exhausted && state.stamina.current > 0;
}

/** The player pressed or released the sprint key. */
export function setSprintHeld(state: MovementState, held: boolean): MovementState {
	const updated = { ...state, sprintHeld: held };
	if (canStartSprint(updated)) {
		updated.mode = "sprinting";
	} else if (!held && updated.mode === "sprinting") {
		updated.mode = "normal";
	}
	return updated;
}

/** The player asked to roll. Checks state, cooldown and stamina, in that order. */
export function requestRoll(state: MovementState, now: number): RollResult {
	if (!canTransition(state.mode, "rolling")) {
		return { state, refusal: "state" };
	}
	// The cooldown counts from the start of the previous roll (like WoW/GW2 cooldowns).
	if (state.rollStartedAt !== undefined && now - state.rollStartedAt < ROLL.cooldown) {
		return { state, refusal: "cooldown" };
	}
	const stamina = trySpend(state.stamina, STAMINA.rollCost, now);
	if (stamina === undefined) {
		return { state, refusal: "stamina" };
	}
	return { state: { ...state, mode: "rolling", stamina, rollStartedAt: now }, refusal: undefined };
}

/** Stuns the player until `endsAt`. A longer stun wins over a shorter one; rolling and dead ignore it. */
export function stun(state: MovementState, endsAt: number): MovementState {
	if (!canTransition(state.mode, "stunned") && state.mode !== "stunned") {
		return state;
	}
	const current = state.stunnedUntil ?? endsAt;
	return { ...state, mode: "stunned", stunnedUntil: math.max(current, endsAt) };
}

export function die(state: MovementState): MovementState {
	return { ...state, mode: "dead", sprintHeld: false };
}

/**
 * Advances time by `dt`: ends rolls and stuns, drains or regenerates stamina, starts or stops sprint.
 * `isMoving` = the character actually moves, so standing still with the key held costs nothing.
 */
export function tick(state: MovementState, dt: number, now: number, isMoving: boolean): MovementState {
	const updated = { ...state };

	if (
		updated.mode === "rolling" &&
		updated.rollStartedAt !== undefined &&
		now - updated.rollStartedAt >= ROLL.duration
	) {
		updated.mode = "normal";
	}
	if (updated.mode === "stunned" && updated.stunnedUntil !== undefined && now >= updated.stunnedUntil) {
		updated.mode = "normal";
		updated.stunnedUntil = undefined;
	}

	if (updated.mode === "sprinting" && isMoving) {
		updated.stamina = drain(updated.stamina, STAMINA.sprintDrainPerSecond, dt, now);
		if (updated.stamina.current <= 0) {
			updated.mode = "normal";
			updated.exhausted = true;
		}
	} else if (updated.mode !== "dead") {
		updated.stamina = regenerate(updated.stamina, dt, now);
	}

	if (updated.exhausted && updated.stamina.current >= STAMINA.sprintResumeAt) {
		updated.exhausted = false;
	}
	// Holding the key keeps the intent: sprint resumes by itself after a roll or after recovering.
	if (canStartSprint(updated)) {
		updated.mode = "sprinting";
	}
	return updated;
}

/** True during the roll's i-frames. Combat skips damage while this is true. */
export function isInvulnerable(state: MovementState, now: number): boolean {
	return (
		state.mode === "rolling" &&
		state.rollStartedAt !== undefined &&
		now - state.rollStartedAt >= 0 &&
		now - state.rollStartedAt < ROLL.invulnerableFor
	);
}

/**
 * Humanoid.WalkSpeed the server sets for this state. Sprint does not work in water.
 * Honest clients follow it. A cheating client can override WalkSpeed locally; then only the speed
 * check (MAX_LEGAL_SPEED) limits it. So a stun's speed 0 is a visual lock, not a security guarantee.
 */
export function walkSpeedFor(state: MovementState, swimming: boolean): number {
	switch (state.mode) {
		case "stunned":
		case "dead":
			return SPEEDS.none;
		case "sprinting":
			return swimming ? SPEEDS.swim : SPEEDS.sprint;
		default:
			// During a roll the client's own velocity does the moving; WalkSpeed stays at run.
			return swimming ? SPEEDS.swim : SPEEDS.run;
	}
}

/**
 * Fastest legal horizontal speed, for the anti-speedhack check. Deliberately NOT mode-specific:
 * sprint start/stop and roll reach the server with network delay, and policing those edges would
 * rubber-band honest players. Stamina is enforced by the server-set WalkSpeed instead.
 */
export const MAX_LEGAL_SPEED = math.max(SPEEDS.sprint, ROLL_SPEED);
