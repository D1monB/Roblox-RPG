import { Assert, Test } from "@rbxts/lunit";
import { CLASS_IDS, STAT_IDS, isClassId } from "./ids";

class IdsTests {
	@Test
	public acceptsKnownClasses() {
		for (const id of CLASS_IDS) {
			Assert.true(isClassId(id));
		}
	}

	@Test
	public rejectsUnknownOrWrongTypes() {
		Assert.false(isClassId("paladin"));
		Assert.false(isClassId(""));
		Assert.false(isClassId(5));
		Assert.false(isClassId(undefined));
		Assert.false(isClassId({}));
	}

	@Test
	public statListMatchesDesignDoc() {
		// docs/stats-and-leveling.md defines exactly these five stats.
		Assert.deepEqual([...STAT_IDS], ["vitality", "mind", "strength", "dexterity", "intelligence"]);
	}
}

export = IdsTests;
