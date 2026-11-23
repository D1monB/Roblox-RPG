import { Assert, Test } from "@rbxts/lunit";
import { drain, fullStamina, regenerate, trySpend } from "./stamina";
import { STAMINA } from "./tuning";

class StaminaTests {
	@Test
	public startsFull() {
		Assert.equal(fullStamina().current, STAMINA.max);
	}

	@Test
	public spendTakesTheCostAndRemembersTheTime() {
		const result = trySpend(fullStamina(), 25, 10);
		Assert.equal(result?.current, STAMINA.max - 25);
		Assert.equal(result?.lastSpentAt, 10);
	}

	@Test
	public spendIsAllOrNothing() {
		Assert.undefined(trySpend({ current: 24, lastSpentAt: undefined }, 25, 0));
		Assert.equal(trySpend({ current: 25, lastSpentAt: undefined }, 25, 0)?.current, 0);
	}

	@Test
	public spendRejectsBadCosts() {
		const full = fullStamina();
		Assert.undefined(trySpend(full, 0, 0));
		Assert.undefined(trySpend(full, -5, 0));
		Assert.undefined(trySpend(full, 0 / 0, 0));
		Assert.undefined(trySpend(full, math.huge, 0));
	}

	@Test
	public drainNeverGoesBelowZero() {
		const result = drain({ current: 3, lastSpentAt: undefined }, 10, 1, 5);
		Assert.equal(result.current, 0);
		Assert.equal(result.lastSpentAt, 5);
	}

	@Test
	public drainIgnoresBadTimeSteps() {
		const full = fullStamina();
		Assert.equal(drain(full, 10, -1, 0).current, STAMINA.max);
		Assert.equal(drain(full, 10, 0 / 0, 0).current, STAMINA.max);
		Assert.equal(drain(full, 10, math.huge, 0).current, STAMINA.max);
	}

	@Test
	public regenWaitsForTheDelay() {
		const spent = { current: 50, lastSpentAt: 10 };
		Assert.equal(regenerate(spent, 0.5, 10 + STAMINA.regenDelay - 0.1).current, 50);
		Assert.equal(regenerate(spent, 0.5, 10 + STAMINA.regenDelay).current, 50 + STAMINA.regenPerSecond * 0.5);
	}

	@Test
	public regenNeverGoesAboveMax() {
		const almost = { current: STAMINA.max - 1, lastSpentAt: undefined };
		Assert.equal(regenerate(almost, 10, 100).current, STAMINA.max);
	}

	@Test
	public regenIgnoresBadTimeSteps() {
		const spent = { current: 50, lastSpentAt: undefined };
		Assert.equal(regenerate(spent, -1, 0).current, 50);
		Assert.equal(regenerate(spent, 0 / 0, 0).current, 50);
	}
}

export = StaminaTests;
