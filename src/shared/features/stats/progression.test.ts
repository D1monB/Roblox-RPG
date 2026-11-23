import { Assert, Test } from "@rbxts/lunit";
import { emptyStatPoints } from "./class-definitions";
import { MAX_LEVEL } from "./formulas";
import { MAX_XP_PER_GRANT, allocatePoint, applyXp } from "./progression";

const fresh = { level: 1, xp: 0, unspentPoints: 0 };

class ProgressionTests {
	@Test
	public smallGrantOnlyAddsXp() {
		const result = applyXp(fresh, 40);
		Assert.equal(result?.progression.xp, 40);
		Assert.equal(result?.progression.level, 1);
		Assert.equal(result?.levelsGained, 0);
	}

	@Test
	public exactGrantLevelsUpAndGivesAPoint() {
		const result = applyXp(fresh, 100);
		Assert.equal(result?.progression.level, 2);
		Assert.equal(result?.progression.xp, 0);
		Assert.equal(result?.progression.unspentPoints, 1);
		Assert.equal(result?.levelsGained, 1);
	}

	@Test
	public leftoverXpCarriesOver() {
		const result = applyXp(fresh, 130);
		Assert.equal(result?.progression.level, 2);
		Assert.equal(result?.progression.xp, 30);
	}

	@Test
	public bigGrantGivesSeveralLevels() {
		// 100 (lvl 1) + 282 (lvl 2) = 382 -> level 3 with 18 left over.
		const result = applyXp(fresh, 400);
		Assert.equal(result?.progression.level, 3);
		Assert.equal(result?.progression.xp, 18);
		Assert.equal(result?.progression.unspentPoints, 2);
		Assert.equal(result?.levelsGained, 2);
	}

	@Test
	public stopsAtMaxLevelAndDropsExtraXp() {
		const result = applyXp({ level: MAX_LEVEL - 1, xp: 0, unspentPoints: 0 }, MAX_XP_PER_GRANT);
		Assert.equal(result?.progression.level, MAX_LEVEL);
		Assert.equal(result?.progression.xp, 0);
		Assert.equal(result?.levelsGained, 1);
	}

	@Test
	public maxLevelPlayerKeepsZeroXp() {
		const result = applyXp({ level: MAX_LEVEL, xp: 0, unspentPoints: 3 }, 500);
		Assert.equal(result?.progression.level, MAX_LEVEL);
		Assert.equal(result?.progression.xp, 0);
		Assert.equal(result?.progression.unspentPoints, 3);
		Assert.equal(result?.levelsGained, 0);
	}

	@Test
	public doesNotChangeTheInput() {
		applyXp(fresh, 500);
		Assert.equal(fresh.level, 1);
		Assert.equal(fresh.xp, 0);
	}

	// Bad input for XP.
	@Test
	public rejectsBadXpAmounts() {
		Assert.undefined(applyXp(fresh, 0));
		Assert.undefined(applyXp(fresh, -50));
		Assert.undefined(applyXp(fresh, 1.5));
		Assert.undefined(applyXp(fresh, 0 / 0));
		Assert.undefined(applyXp(fresh, math.huge));
		Assert.undefined(applyXp(fresh, MAX_XP_PER_GRANT + 1));
		Assert.undefined(applyXp(fresh, "100" as unknown as number));
	}

	@Test
	public rejectsCorruptedLevel() {
		Assert.undefined(applyXp({ level: 0, xp: 0, unspentPoints: 0 }, 10));
		Assert.undefined(applyXp({ level: MAX_LEVEL + 1, xp: 0, unspentPoints: 0 }, 10));
	}

	@Test
	public allocatesOnePoint() {
		const result = allocatePoint({ allocated: emptyStatPoints(), unspentPoints: 2 }, "strength");
		Assert.equal(result?.allocated.strength, 1);
		Assert.equal(result?.allocated.vitality, 0);
		Assert.equal(result?.unspentPoints, 1);
	}

	@Test
	public allocationDoesNotChangeTheInput() {
		const input = { allocated: emptyStatPoints(), unspentPoints: 1 };
		allocatePoint(input, "mind");
		Assert.equal(input.allocated.mind, 0);
		Assert.equal(input.unspentPoints, 1);
	}

	// Bad input for allocation: the stat id comes straight from a client.
	@Test
	public rejectsAllocationWithoutPoints() {
		Assert.undefined(allocatePoint({ allocated: emptyStatPoints(), unspentPoints: 0 }, "strength"));
		Assert.undefined(allocatePoint({ allocated: emptyStatPoints(), unspentPoints: -1 }, "strength"));
	}

	@Test
	public rejectsUnknownOrWrongTypeStat() {
		const state = { allocated: emptyStatPoints(), unspentPoints: 5 };
		Assert.undefined(allocatePoint(state, "luck"));
		Assert.undefined(allocatePoint(state, ""));
		Assert.undefined(allocatePoint(state, 1));
		Assert.undefined(allocatePoint(state, undefined));
		Assert.undefined(allocatePoint(state, { vitality: 1 }));
	}

	@Test
	public rejectsCorruptedPointCounter() {
		Assert.undefined(allocatePoint({ allocated: emptyStatPoints(), unspentPoints: 0 / 0 }, "mind"));
		Assert.undefined(allocatePoint({ allocated: emptyStatPoints(), unspentPoints: 1.5 }, "mind"));
	}

	@Test
	public spamCannotSpendMoreThanOwned() {
		let state = { allocated: emptyStatPoints(), unspentPoints: 3 };
		let accepted = 0;
		for (let i = 0; i < 20; i++) {
			const result = allocatePoint(state, "vitality");
			if (result !== undefined) {
				state = result;
				accepted += 1;
			}
		}
		Assert.equal(accepted, 3);
		Assert.equal(state.allocated.vitality, 3);
		Assert.equal(state.unspentPoints, 0);
	}
}

export = ProgressionTests;
