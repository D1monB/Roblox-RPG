import { Assert, Test } from "@rbxts/lunit";
import { ROLL_START_SPEED, rollAngleAt, rollProgress, rollSpeedAt } from "./roll-curve";
import { ROLL } from "./tuning";

class RollCurveTests {
	@Test
	public progressRunsFromZeroToOneAndStaysClamped() {
		Assert.equal(rollProgress(0), 0);
		Assert.equal(rollProgress(ROLL.duration / 2), 0.5);
		Assert.equal(rollProgress(ROLL.duration), 1);
		Assert.equal(rollProgress(ROLL.duration * 10), 1);
		Assert.equal(rollProgress(-3), 0);
	}

	@Test
	public speedStartsFastAndEndsAtZero() {
		Assert.equal(rollSpeedAt(0), ROLL_START_SPEED);
		Assert.equal(rollSpeedAt(1), 0);
		Assert.greaterThan(rollSpeedAt(0.2), rollSpeedAt(0.6));
	}

	@Test
	public speedNeverIncreasesDuringTheRoll() {
		let previous = rollSpeedAt(0);
		for (let i = 1; i <= 100; i++) {
			const speed = rollSpeedAt(i / 100);
			Assert.true(speed <= previous);
			previous = speed;
		}
	}

	@Test
	public theRollTravelsTheConfiguredDistance() {
		// Numerical integral of speed over time must equal ROLL.distance (tuning stays the single truth).
		const steps = 10000;
		let distance = 0;
		for (let i = 0; i < steps; i++) {
			distance += rollSpeedAt((i + 0.5) / steps) * (ROLL.duration / steps);
		}
		Assert.true(math.abs(distance - ROLL.distance) < 0.01);
	}

	@Test
	public somersaultIsOneFullForwardTurn() {
		Assert.equal(rollAngleAt(0), 0);
		Assert.true(math.abs(rollAngleAt(1) + 2 * math.pi) < 1e-9);
		// Half way through the roll the body is upside down.
		Assert.true(math.abs(rollAngleAt(0.5) + math.pi) < 1e-9);
	}

	@Test
	public somersaultNeverSpinsBackwards() {
		let previous = rollAngleAt(0);
		for (let i = 1; i <= 100; i++) {
			const angle = rollAngleAt(i / 100);
			Assert.true(angle <= previous);
			previous = angle;
		}
	}

	@Test
	public badProgressIsSafe() {
		const nan = 0 / 0;
		Assert.equal(rollSpeedAt(nan), ROLL_START_SPEED);
		Assert.equal(rollAngleAt(nan), 0);
		Assert.equal(rollSpeedAt(5), 0);
		Assert.equal(rollSpeedAt(-5), ROLL_START_SPEED);
		Assert.equal(rollProgress(nan), 0);
	}
}

export = RollCurveTests;
