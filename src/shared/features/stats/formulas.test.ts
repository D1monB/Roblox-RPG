import { Assert, Test } from "@rbxts/lunit";
import { MAX_LEVEL, xpToNextLevel } from "./formulas";

class XpToNextLevelTests {
	@Test
	public levelOneNeedsBaseXp() {
		Assert.equal(xpToNextLevel(1), 100);
	}

	@Test
	public growsWithLevel() {
		Assert.equal(xpToNextLevel(4), 800);
		Assert.greaterThan(xpToNextLevel(10) ?? 0, xpToNextLevel(9) ?? 0);
	}

	@Test
	public maxLevelHasNoNextLevel() {
		Assert.undefined(xpToNextLevel(MAX_LEVEL));
	}

	// Bad input: values like these can arrive from an exploiting client.
	@Test
	public rejectsOutOfRange() {
		Assert.undefined(xpToNextLevel(0));
		Assert.undefined(xpToNextLevel(-5));
		Assert.undefined(xpToNextLevel(MAX_LEVEL + 1));
	}

	@Test
	public rejectsNonIntegers() {
		Assert.undefined(xpToNextLevel(1.5));
		Assert.undefined(xpToNextLevel(0 / 0));
		Assert.undefined(xpToNextLevel(math.huge));
	}
}

export = XpToNextLevelTests;
