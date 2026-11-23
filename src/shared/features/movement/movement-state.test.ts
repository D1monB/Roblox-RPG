import { Assert, Test } from "@rbxts/lunit";
import {
	MovementState,
	canTransition,
	die,
	initialMovementState,
	isInvulnerable,
	requestRoll,
	setSprintHeld,
	stun,
	tick,
	walkSpeedFor,
} from "./movement-state";
import { ROLL, SPEEDS, STAMINA } from "./tuning";

function withStamina(state: MovementState, current: number): MovementState {
	return { ...state, stamina: { current, lastSpentAt: undefined } };
}

class MovementStateTests {
	// --- transitions ---

	@Test
	public deadCanOnlyRespawn() {
		Assert.false(canTransition("dead", "sprinting"));
		Assert.false(canTransition("dead", "rolling"));
		Assert.false(canTransition("dead", "stunned"));
		Assert.true(canTransition("dead", "normal"));
	}

	@Test
	public rollCannotBeStunnedButCanDie() {
		Assert.false(canTransition("rolling", "stunned"));
		Assert.true(canTransition("rolling", "dead"));
	}

	// --- sprint ---

	@Test
	public holdingSprintStartsAndReleasingStops() {
		const sprinting = setSprintHeld(initialMovementState(), true);
		Assert.equal(sprinting.mode, "sprinting");
		Assert.equal(setSprintHeld(sprinting, false).mode, "normal");
	}

	@Test
	public sprintDrainsOnlyWhileMoving() {
		const sprinting = setSprintHeld(initialMovementState(), true);
		Assert.equal(tick(sprinting, 1, 1, false).stamina.current, STAMINA.max);
		Assert.equal(tick(sprinting, 1, 1, true).stamina.current, STAMINA.max - STAMINA.sprintDrainPerSecond);
	}

	@Test
	public runningDryStopsSprintUntilRecovered() {
		let state = setSprintHeld(withStamina(initialMovementState(), 5), true);
		state = tick(state, 1, 1, true);
		Assert.equal(state.mode, "normal");
		Assert.true(state.exhausted);

		// Still holding the key, but below the resume threshold: no sprint yet.
		state = tick(state, 0.5, 1 + STAMINA.regenDelay, true);
		Assert.equal(state.mode, "normal");

		// Enough regen: sprint resumes by itself because the key is still held.
		state = tick(state, 1, 2 + STAMINA.regenDelay, true);
		Assert.false(state.exhausted);
		Assert.equal(state.mode, "sprinting");
	}

	@Test
	public cannotSprintWhileStunnedOrDead() {
		Assert.equal(setSprintHeld(stun(initialMovementState(), 5), true).mode, "stunned");
		Assert.equal(setSprintHeld(die(initialMovementState()), true).mode, "dead");
	}

	// --- roll ---

	@Test
	public rollSpendsStaminaAndEndsAfterDuration() {
		const { state, refusal } = requestRoll(initialMovementState(), 10);
		Assert.undefined(refusal);
		Assert.equal(state.mode, "rolling");
		Assert.equal(state.stamina.current, STAMINA.max - STAMINA.rollCost);
		Assert.equal(tick(state, 0.1, 10 + ROLL.duration - 0.1, false).mode, "rolling");
		Assert.equal(tick(state, 0.1, 10 + ROLL.duration, false).mode, "normal");
	}

	@Test
	public rollRespectsCooldownBoundaries() {
		// Starts at time 0 so the boundary is exact (10 + 1.2 - 10 is not exactly 1.2 in floating point).
		const first = requestRoll(initialMovementState(), 0).state;
		const ended = tick(first, ROLL.duration, ROLL.duration, false);
		Assert.equal(requestRoll(ended, ROLL.cooldown - 0.01).refusal, "cooldown");
		Assert.undefined(requestRoll(ended, ROLL.cooldown).refusal);
	}

	@Test
	public rollNeedsEnoughStamina() {
		const tired = withStamina(initialMovementState(), STAMINA.rollCost - 1);
		const result = requestRoll(tired, 0);
		Assert.equal(result.refusal, "stamina");
		// A refused roll changes nothing.
		Assert.equal(result.state.stamina.current, STAMINA.rollCost - 1);
	}

	@Test
	public cannotRollWhileRollingStunnedOrDead() {
		const rolling = requestRoll(initialMovementState(), 0).state;
		Assert.equal(requestRoll(rolling, 0.1).refusal, "state");
		Assert.equal(requestRoll(stun(initialMovementState(), 5), 0).refusal, "state");
		Assert.equal(requestRoll(die(initialMovementState()), 0).refusal, "state");
	}

	@Test
	public spammingRollsOnlyLetsOneThrough() {
		let state = initialMovementState();
		let accepted = 0;
		for (let i = 0; i < 20; i++) {
			const result = requestRoll(state, i * 0.05);
			state = result.state;
			if (result.refusal === undefined) {
				accepted += 1;
			}
		}
		Assert.equal(accepted, 1);
	}

	@Test
	public sprintResumesAfterRollWhenKeyHeld() {
		const sprinting = setSprintHeld(initialMovementState(), true);
		const rolling = requestRoll(sprinting, 0).state;
		Assert.equal(tick(rolling, ROLL.duration, ROLL.duration, true).mode, "sprinting");
	}

	@Test
	public invulnerableOnlyDuringIFrames() {
		const rolling = requestRoll(initialMovementState(), 10).state;
		Assert.true(isInvulnerable(rolling, 10));
		Assert.true(isInvulnerable(rolling, 10 + ROLL.invulnerableFor - 0.01));
		Assert.false(isInvulnerable(rolling, 10 + ROLL.invulnerableFor));
		Assert.false(isInvulnerable(initialMovementState(), 10));
	}

	// --- stun and death ---

	@Test
	public stunEndsOnTimeAndLongerStunWins() {
		let state = stun(initialMovementState(), 5);
		state = stun(state, 3);
		Assert.equal(state.stunnedUntil, 5);
		Assert.equal(tick(state, 0.1, 4.9, false).mode, "stunned");
		Assert.equal(tick(state, 0.1, 5, false).mode, "normal");
	}

	@Test
	public stunIsIgnoredWhileRollingOrDead() {
		const rolling = requestRoll(initialMovementState(), 0).state;
		Assert.equal(stun(rolling, 5).mode, "rolling");
		Assert.equal(stun(die(initialMovementState()), 5).mode, "dead");
	}

	@Test
	public deadDoesNotRegenerate() {
		const dead = die(withStamina(initialMovementState(), 10));
		Assert.equal(tick(dead, 5, 100, false).stamina.current, 10);
	}

	// --- speeds ---

	@Test
	public walkSpeedFollowsMode() {
		const normal = initialMovementState();
		Assert.equal(walkSpeedFor(normal, false), SPEEDS.run);
		Assert.equal(walkSpeedFor(setSprintHeld(normal, true), false), SPEEDS.sprint);
		Assert.equal(walkSpeedFor(stun(normal, 5), false), SPEEDS.none);
		Assert.equal(walkSpeedFor(die(normal), false), SPEEDS.none);
	}

	@Test
	public noSprintInWater() {
		Assert.equal(walkSpeedFor(setSprintHeld(initialMovementState(), true), true), SPEEDS.swim);
	}
}

export = MovementStateTests;
