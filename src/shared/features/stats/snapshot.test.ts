import { Assert, Test } from "@rbxts/lunit";
import { emptyStatPoints } from "./class-definitions";
import { MAX_LEVEL } from "./formulas";
import { buildStatsSnapshot } from "./snapshot";

class SnapshotTests {
	@Test
	public includesProgressAndDerivedStats() {
		const snapshot = buildStatsSnapshot({
			level: 4,
			xp: 20,
			unspentPoints: 2,
			allocatedStats: emptyStatPoints(),
			classId: "warrior",
		});
		Assert.equal(snapshot.level, 4);
		Assert.equal(snapshot.xpToNext, 800);
		Assert.equal(snapshot.unspentPoints, 2);
		Assert.equal(snapshot.derived?.maxHealth, 180);
	}

	@Test
	public noDerivedStatsWithoutAClass() {
		const snapshot = buildStatsSnapshot({ level: 1, xp: 0, unspentPoints: 0, allocatedStats: emptyStatPoints() });
		Assert.undefined(snapshot.derived);
	}

	@Test
	public maxLevelHasNoXpTarget() {
		const snapshot = buildStatsSnapshot({
			level: MAX_LEVEL,
			xp: 0,
			unspentPoints: 0,
			allocatedStats: emptyStatPoints(),
		});
		Assert.undefined(snapshot.xpToNext);
	}

	@Test
	public snapshotIsACopyNotTheLiveSaveTable() {
		const live = emptyStatPoints();
		const snapshot = buildStatsSnapshot({ level: 1, xp: 0, unspentPoints: 0, allocatedStats: live });
		live.strength = 99;
		Assert.equal(snapshot.allocated.strength, 0);
	}
}

export = SnapshotTests;
