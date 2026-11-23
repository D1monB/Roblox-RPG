import { Assert, Test } from "@rbxts/lunit";
import { MAX_LEVEL, STAT_IDS } from "shared/features/stats";
import { PlainTable, deepCopy } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { Migration } from "./migrations";
import { CURRENT_SCHEMA_VERSION, createDefaultProfileData, isProfileData } from "./schema";

function validRaw(): PlainTable {
	return createDefaultProfileData() as unknown as PlainTable;
}

function loadOk(raw: unknown) {
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load should succeed, got ${result.reason}`);
	}
	return result;
}

class LoadProfileDataTests {
	// ---- schema ----

	@Test
	public defaultDataPassesTheShapeCheck() {
		Assert.true(isProfileData(createDefaultProfileData()));
		Assert.equal(createDefaultProfileData().schemaVersion, CURRENT_SCHEMA_VERSION);
	}

	@Test
	public shapeCheckRejectsMissingOrBrokenFields() {
		for (const key of ["schemaVersion", "level", "xp", "allocatedStats", "unspentPoints", "gold"]) {
			const broken = validRaw();
			broken[key] = undefined;
			Assert.false(isProfileData(broken), `missing ${key}`);
		}
		for (const statId of STAT_IDS) {
			const broken = deepCopy(validRaw());
			(broken.allocatedStats as PlainTable)[statId] = undefined;
			Assert.false(isProfileData(broken), `missing stat ${statId}`);
		}
	}

	@Test
	public defaultsAreNotSharedBetweenPlayers() {
		const first = createDefaultProfileData();
		first.allocatedStats.mind = 5;
		Assert.equal(createDefaultProfileData().allocatedStats.mind, 0);
	}

	// ---- happy path ----

	@Test
	public acceptsAValidSaveUnchanged() {
		const raw = validRaw();
		raw.level = 12;
		raw.xp = 340;
		raw.gold = 500;
		raw.classId = "mage";
		const result = loadOk(raw);
		Assert.equal(result.data.level, 12);
		Assert.equal(result.data.classId, "mage");
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public doesNotModifyTheInput() {
		const raw = validRaw();
		raw.level = 0;
		loadProfileData(raw);
		Assert.equal(raw.level, 0);
	}

	// ---- extending the save without breaking old saves ----

	@Test
	public oldSaveWithoutNewFieldsGetsDefaults() {
		// Simulates a save written before `gold` and one of the stats existed.
		const raw = validRaw();
		raw.gold = undefined;
		(raw.allocatedStats as PlainTable).intelligence = undefined;
		const result = loadOk(raw);
		Assert.equal(result.data.gold, 0);
		Assert.equal(result.data.allocatedStats.intelligence, 0);
	}

	@Test
	public unknownKeysSurvive() {
		const raw = validRaw();
		raw.futureFeature = { slots: 3 };
		const result = loadOk(raw);
		Assert.deepEqual((result.data as unknown as PlainTable).futureFeature, { slots: 3 });
	}

	@Test
	public isIdempotent() {
		const raw = validRaw();
		raw.level = 999;
		raw.gold = -5;
		const first = loadOk(raw);
		const second = loadOk(first.data);
		Assert.deepEqual(second.data, first.data);
		Assert.equal(second.repairs.size(), 0);
	}

	@Test
	public migratesThroughAChainThenRepairs() {
		const chain: ReadonlyArray<Migration> = [
			{
				from: 1,
				apply: (data) => {
					data.gold = data.coins;
				},
			},
		];
		const raw = validRaw();
		raw.schemaVersion = 1;
		raw.gold = undefined;
		raw.coins = 40;
		const result = loadProfileData(raw, chain, 2);
		if (!result.ok) {
			Assert.fail("should load");
		}
		Assert.equal(result.data.gold, 40);
		Assert.equal(result.data.schemaVersion, 2);
	}

	// ---- bad data: wrong types, out of range, hostile values ----

	@Test
	public clampsLevelIntoRange() {
		const low = validRaw();
		low.level = -3;
		Assert.equal(loadOk(low).data.level, 1);

		const high = validRaw();
		high.level = MAX_LEVEL + 100;
		Assert.equal(loadOk(high).data.level, MAX_LEVEL);
	}

	@Test
	public repairsNonIntegersAndSpecialNumbers() {
		const raw = validRaw();
		raw.level = 5.7;
		raw.xp = 0 / 0;
		raw.gold = math.huge;
		raw.unspentPoints = -math.huge;
		const result = loadOk(raw);
		Assert.equal(result.data.level, 5);
		Assert.equal(result.data.xp, 0);
		Assert.greaterThan(result.data.gold, 0);
		Assert.equal(result.data.unspentPoints, 0);
		Assert.greaterThan(result.repairs.size(), 0);
	}

	@Test
	public repairsWrongTypes() {
		const raw = validRaw();
		raw.level = "99";
		raw.gold = { cheat: true };
		raw.xp = true;
		const result = loadOk(raw);
		Assert.equal(result.data.level, 1);
		Assert.equal(result.data.gold, 0);
		Assert.equal(result.data.xp, 0);
	}

	@Test
	public repairsBrokenStatTable() {
		const notATable = validRaw();
		notATable.allocatedStats = 12;
		Assert.deepEqual(loadOk(notATable).data.allocatedStats, createDefaultProfileData().allocatedStats);

		const negative = validRaw();
		(negative.allocatedStats as PlainTable).strength = -50;
		Assert.equal(loadOk(negative).data.allocatedStats.strength, 0);
	}

	@Test
	public dropsUnknownClass() {
		const raw = validRaw();
		raw.classId = "paladin";
		const result = loadOk(raw);
		Assert.undefined(result.data.classId);
		Assert.contains(result.repairs, "classId");
	}

	// ---- refusing instead of guessing ----

	@Test
	public refusesDataThatIsNotATable() {
		for (const raw of [undefined, 5, "text", true]) {
			const result = loadProfileData(raw);
			Assert.false(result.ok);
			if (!result.ok) {
				Assert.equal(result.reason, "not-a-table");
			}
		}
	}

	@Test
	public refusesAMissingVersion() {
		const raw = validRaw();
		raw.schemaVersion = undefined;
		const result = loadProfileData(raw);
		Assert.false(result.ok);
	}

	@Test
	public refusesFutureVersions() {
		const raw = validRaw();
		raw.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
		const result = loadProfileData(raw);
		Assert.false(result.ok);
		if (!result.ok) {
			Assert.equal(result.reason, "future-version");
		}
	}
}

export = LoadProfileDataTests;
