// Movement numbers as DATA (CLAUDE.md rule 4). All values are PLACEHOLDERS from docs/movement.md:
// tune them here after playtests, the logic does not change.
// Speeds are in studs per second, times in seconds.

export const SPEEDS = {
	// No separate walk mode: on a phone a half-tilted stick already walks slower (Roblox does it).
	run: 16,
	// Sprint = run + 50%, close to Genshin's sprint/run ratio: clearly faster, but not a mount.
	sprint: 24,
	swim: 10,
	// While stunned or dead the character must not walk on its own.
	none: 0,
} as const;

export const STAMINA = {
	max: 100,
	sprintDrainPerSecond: 10,
	rollCost: 25,
	regenPerSecond: 20,
	// Short pause before regen starts (Genshin, Elden Ring): spending is a decision, not free.
	regenDelay: 1,
	// After running dry, sprint comes back only at this level (prevents stutter sprint at 0-1 stamina).
	sprintResumeAt: 20,
} as const;

export const ROLL = {
	distance: 12,
	duration: 0.5,
	// Invulnerable for the first part of the roll only (Souls-like i-frames), so timing matters.
	invulnerableFor: 0.3,
	cooldown: 1.2,
} as const;

/** Roll travel speed, derived so distance and duration stay the single source of truth. */
export const ROLL_SPEED = ROLL.distance / ROLL.duration;

export const FALL = {
	// Falls below this height are free (normal jumps and small ledges).
	safeHeight: 25,
	damagePercentPerStud: 0.02,
	// A fall never takes more than half of max health and never kills (docs/movement.md).
	maxDamagePercent: 0.5,
} as const;

export const SPEED_CHECK = {
	// How often the server compares positions.
	interval: 0.5,
	// The distance budget refills 10% faster than the fastest legal speed (float error, physics jitter).
	tolerance: 1.1,
	// Burst cap: up to 1 s of movement may arrive at once after a lag spike without a rubber-band.
	burstSeconds: 1,
	// Upward speed limit. A jump rises ~6.5 studs; ladders climb at ~0.7 x WalkSpeed (16.8 while sprinting).
	maxRiseSpeed: 20,
} as const;
