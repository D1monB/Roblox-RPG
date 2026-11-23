import { Assert, Test } from "@rbxts/lunit";
import { CLASS_IDS, STAT_IDS } from "./ids";
import { emptyStatPoints, startingStats } from "./class-definitions";
import { calculateDerivedStats, totalStats } from "./derived-stats";

class DerivedStatsTests {
	@Test
	public everyClassHasTheSameStartingBudget() {
		for (const classId of CLASS_IDS) {
			const start = startingStats(classId);
			let sum = 0;
			for (const statId of STAT_IDS) {
				sum += start[statId];
			}
			Assert.equal(sum, 16);
		}
	}

	@Test
	public totalAddsAllocatedToStart() {
		const allocated = { ...emptyStatPoints(), strength: 3 };
		const total = totalStats("warrior", allocated);
		Assert.equal(total.strength, 11);
		Assert.equal(total.vitality, 8);
	}

	@Test
	public warriorHealthAndEnergy() {
		const derived = calculateDerivedStats("warrior", emptyStatPoints());
		Assert.equal(derived.maxHealth, 180);
		Assert.equal(derived.maxEnergy, 100);
		Assert.undefined(derived.maxMana);
	}

	@Test
	public mageHasManaAndNoEnergy() {
		const derived = calculateDerivedStats("mage", emptyStatPoints());
		Assert.equal(derived.maxMana, 114);
		Assert.equal(derived.maxHealth, 100);
		Assert.undefined(derived.maxEnergy);
	}

	@Test
	public vitalityRaisesHealth() {
		const base = calculateDerivedStats("archer", emptyStatPoints());
		const more = calculateDerivedStats("archer", { ...emptyStatPoints(), vitality: 5 });
		Assert.equal(more.maxHealth - base.maxHealth, 50);
	}

	@Test
	public mindRaisesManaOnlyForMage() {
		const more = calculateDerivedStats("mage", { ...emptyStatPoints(), mind: 2 });
		Assert.equal(more.maxMana, 130);
		const warrior = calculateDerivedStats("warrior", { ...emptyStatPoints(), mind: 2 });
		Assert.undefined(warrior.maxMana);
	}
}

export = DerivedStatsTests;
