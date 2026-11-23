// Upper bounds for saved point counters. ONE source of truth: sanitize.ts clamps loaded data to these,
// and progression.ts refuses to go past them. If they disagreed, a point granted at the cap would be
// kept in memory but cut off on the next load, and the player would silently lose it.
// Raising one is a schema change: bump CURRENT_SCHEMA_VERSION (see profile/schema.ts) so older servers refuse the save.
export const MAX_STAT_POINTS = 1000;
export const MAX_UNSPENT_POINTS = 1000;
