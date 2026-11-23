import { Assert, Test } from "@rbxts/lunit";
import { SpeedBudget, checkMove, fullSpeedBudget, grantRollCredit } from "./speed-check";
import { ROLL, SPEED_CHECK } from "./tuning";

const MAX = 24;
const DT = 0.5;

function empty(): SpeedBudget {
	return { flat: 0, rise: 0, credit: 0 };
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
	public rollWhileSprintingNeedsTheRollCredit() {
		// Regression: sprinting (24 studs/s) plus a 12 stud roll in one window used to be rubber-banded.
		let budget = fullSpeedBudget(MAX);
		for (let i = 0; i < 20; i++) {
			budget = checkMove(budget, { dx: MAX * DT, dy: 0, dz: 0, dt: DT }, MAX).budget;
		}
		// Sprint + roll fits the limit with ZERO margin (24 vs 24), so one stud of network jitter breaks it.
		const rollWindow = { dx: MAX * DT + ROLL.distance + 1, dy: 0, dz: 0, dt: DT };
		Assert.false(checkMove(budget, rollWindow, MAX).plausible);
		Assert.true(checkMove(grantRollCredit(budget), rollWindow, MAX).plausible);
	}

	@Test
	public rollCreditDoesNotStackAndIsSpentOnce() {
		const once = grantRollCredit(grantRollCredit(fullSpeedBudget(MAX)));
		Assert.equal(once.credit, ROLL.distance);
		const spent = checkMove(
			{ flat: 0, rise: 0, credit: ROLL.distance },
			{ dx: ROLL.distance, dy: 0, dz: 0, dt: 0 },
			MAX,
		);
		Assert.true(spent.plausible);
		Assert.equal(spent.budget.credit, 0);
		// With the credit used up, the same move is no longer allowed.
		Assert.false(checkMove(spent.budget, { dx: ROLL.distance, dy: 0, dz: 0, dt: 0 }, MAX).plausible);
	}

	@Test
	public creditDoesNotCoverATeleport() {
		Assert.false(
			checkMove(grantRollCredit(fullSpeedBudget(MAX)), { dx: 300, dy: 0, dz: 0, dt: DT }, MAX).plausible,
		);
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
