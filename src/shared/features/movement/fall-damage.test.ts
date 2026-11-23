import { Assert, Test } from "@rbxts/lunit";
import { fallDamage } from "./fall-damage";
import { FALL } from "./tuning";

class FallDamageTests {
	@Test
	public noDamageUpToTheSafeHeight() {
		Assert.equal(fallDamage(10, 100, 100), 0);
		Assert.equal(fallDamage(FALL.safeHeight, 100, 100), 0);
	}

	@Test
	public damageGrowsAboveTheSafeHeight() {
		Assert.equal(fallDamage(FALL.safeHeight + 10, 100, 100), 10 * FALL.damagePercentPerStud * 100);
	}

	@Test
	public cappedAtMaxPercent() {
		Assert.equal(fallDamage(10000, 100, 100), 100 * FALL.maxDamagePercent);
	}

	@Test
	public neverKills() {
		Assert.equal(fallDamage(10000, 100, 30), 29);
		Assert.equal(fallDamage(10000, 100, 1), 0);
	}

	@Test
	public badInputDealsNothing() {
		const nan = 0 / 0;
		Assert.equal(fallDamage(nan, 100, 100), 0);
		Assert.equal(fallDamage(-50, 100, 100), 0);
		Assert.equal(fallDamage(math.huge, 100, 100), 0);
		Assert.equal(fallDamage(100, 0, 100), 0);
		Assert.equal(fallDamage(100, nan, 100), 0);
		Assert.equal(fallDamage(100, 100, nan), 0);
	}
}

export = FallDamageTests;
