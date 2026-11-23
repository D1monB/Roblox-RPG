import { Assert, Test } from "@rbxts/lunit";
import { normalizeRollDirection } from "./roll-direction";

class RollDirectionTests {
	@Test
	public acceptsAUnitGroundVector() {
		const result = normalizeRollDirection(0, 0, -1);
		Assert.equal(result?.x, 0);
		Assert.equal(result?.z, -1);
	}

	@Test
	public dropsTheVerticalPart() {
		const result = normalizeRollDirection(0.6, 0.0, 0.8);
		Assert.notUndefined(result);
		const tilted = normalizeRollDirection(0.8, 0.6, 0);
		Assert.equal(tilted?.x, 1);
		Assert.equal(tilted?.z, 0);
	}

	@Test
	public rejectsZeroAndLongVectors() {
		Assert.undefined(normalizeRollDirection(0, 0, 0));
		// A longer vector must not turn into a longer roll.
		Assert.undefined(normalizeRollDirection(0, 0, 50));
		Assert.undefined(normalizeRollDirection(0.1, 0, 0.1));
	}

	@Test
	public rejectsStraightUp() {
		Assert.undefined(normalizeRollDirection(0, 1, 0));
	}

	@Test
	public rejectsBrokenNumbers() {
		const nan = 0 / 0;
		Assert.undefined(normalizeRollDirection(nan, 0, 1));
		Assert.undefined(normalizeRollDirection(0, nan, 1));
		Assert.undefined(normalizeRollDirection(math.huge, 0, 0));
		Assert.undefined(normalizeRollDirection(0, 0, -math.huge));
	}
}

export = RollDirectionTests;
