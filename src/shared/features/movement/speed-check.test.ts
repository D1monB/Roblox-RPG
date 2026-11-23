import { Assert, Test } from "@rbxts/lunit";
import { SpeedBudget, checkMove, fullSpeedBudget } from "./speed-check";
import { SPEED_CHECK } from "./tuning";

const MAX = 24;
const DT = 0.5;

function empty(): SpeedBudget {
	return { flat: 0, rise: 0 };
}

class SpeedCheckTests {
	@Test
	public sustainedLegalSpeedPasses() {
		let budget = empty();
		for (let i = 0; i < 40; i++) {
			const verdict = checkMove(budget, { dx: MAX * DT, dy: 0, dz: 0, dt: DT }, MAX);
			Assert.true(verdict.plausible);
			budget = verdict.budget;
		}
	}

	@Test
	public sustainedDoubleSpeedFails() {
		// Regression: a per-window slack once allowed a standing 48 studs/s.
		let budget = fullSpeedBudget(MAX);
		let failed = false;
		for (let i = 0; i < 10; i++) {
			const verdict = checkMove(budget, { dx: MAX * 2 * DT, dy: 0, dz: 0, dt: DT }, MAX);
			failed = failed || !verdict.plausible;
			budget = verdict.budget;
		}
		Assert.true(failed);
	}

	@Test
	public lagBurstUpToOneSecondPasses() {
		// No updates for a while, then 1 s of sprinting arrives at once.
		const verdict = checkMove(empty(), { dx: MAX * SPEED_CHECK.burstSeconds, dy: 0, dz: 0, dt: 1 }, MAX);
		Assert.true(verdict.plausible);
	}

	@Test
	public burstIsCapped() {
		// A long pause does not bank more than one burst.
		const verdict = checkMove(empty(), { dx: MAX * 3, dy: 0, dz: 0, dt: 60 }, MAX);
		Assert.false(verdict.plausible);
	}

	@Test
	public teleportIsNotPlausible() {
		Assert.false(checkMove(fullSpeedBudget(MAX), { dx: 300, dy: 0, dz: 400, dt: DT }, MAX).plausible);
	}

	@Test
	public failedMoveSpendsNothing() {
		const verdict = checkMove(fullSpeedBudget(MAX), { dx: 1000, dy: 0, dz: 0, dt: 0 }, MAX);
		Assert.false(verdict.plausible);
		Assert.equal(verdict.budget.flat, fullSpeedBudget(MAX).flat);
	}

	@Test
	public fallingIsAlwaysAllowed() {
		Assert.true(checkMove(empty(), { dx: 0, dy: -500, dz: 0, dt: DT }, MAX).plausible);
	}

	@Test
	public jumpPassesButFlyingUpFails() {
		Assert.true(checkMove(empty(), { dx: 0, dy: 7, dz: 0, dt: DT }, MAX).plausible);
		let budget = fullSpeedBudget(MAX);
		let failed = false;
		for (let i = 0; i < 10; i++) {
			const verdict = checkMove(budget, { dx: 0, dy: 20, dz: 0, dt: DT }, MAX);
			failed = failed || !verdict.plausible;
			budget = verdict.budget;
		}
		Assert.true(failed);
	}

	@Test
	public brokenNumbersAreNeverPlausible() {
		const nan = 0 / 0;
		const full = fullSpeedBudget(MAX);
		Assert.false(checkMove(full, { dx: nan, dy: 0, dz: 0, dt: DT }, MAX).plausible);
		Assert.false(checkMove(full, { dx: 0, dy: math.huge, dz: 0, dt: DT }, MAX).plausible);
		Assert.false(checkMove(full, { dx: 0, dy: 0, dz: 0, dt: nan }, MAX).plausible);
	}

	@Test
	public negativeTimeRefillsNothing() {
		const verdict = checkMove(empty(), { dx: 1, dy: 0, dz: 0, dt: -5 }, MAX);
		Assert.false(verdict.plausible);
	}
}

export = SpeedCheckTests;
