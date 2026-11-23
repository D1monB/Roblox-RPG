import { Players, ReplicatedStorage, RunService } from "@rbxts/services";
import {
	MAX_LEGAL_SPEED,
	MOVEMENT_REMOTES,
	MOVEMENT_REMOTE_FOLDER,
	MovementState,
	SPEED_CHECK,
	STAMINA,
	SpeedBudget,
	checkMove,
	die,
	fallDamage,
	fullSpeedBudget,
	initialMovementState,
	isInvulnerable as isStateInvulnerable,
	normalizeRollDirection,
	requestRoll,
	setSprintHeld,
	stun,
	tick,
	walkSpeedFor,
} from "shared/features/movement";
import { RateLimiter } from "shared/lib/rate-limiter";

// Sprint is press/release, so a few toggles per second is normal play.
const SPRINT_LIMIT = new RateLimiter(10, 5);
// The roll cooldown is 1.2 s; anything much faster than that is spam.
const ROLL_LIMIT = new RateLimiter(3, 2);
// Limits how often we LOG abuse, so an attacker cannot flood our output either.
const LOG_LIMIT = new RateLimiter(2, 0.1);

// Stamina updates are throttled: the UI does not need 60 messages a second.
const STAMINA_SEND_INTERVAL = 0.2;
// A new character may be placed at its spawn point a moment after it appears; checking speed before
// that would see a "teleport" from the origin to the spawn. Kept short: it is a free move window.
const SPAWN_GRACE = 0.3;
// Below this horizontal speed the character counts as standing still (no sprint drain).
const MOVING_THRESHOLD = 1;
// Repeated speed violations inside this window are flagged loudly (one rubber-band can be lag;
// many in a minute is a cheat). No auto-kick yet: that needs a decision (docs/movement.md).
const VIOLATION_WINDOW = 60;
const VIOLATION_FLAG_AT = 10;

interface PlayerMovement {
	state: MovementState;
	humanoid: Humanoid | undefined;
	root: BasePart | undefined;
	// Last position that passed the speed check; the player is returned here on a violation.
	lastValidPosition: Vector3 | undefined;
	lastSampleAt: number;
	anchorReadyAt: number;
	speedBudget: SpeedBudget;
	violations: number;
	violationWindowStart: number;
	// Highest point of the current fall, for fall damage. undefined = not falling.
	fallTopY: number | undefined;
	lastSentStamina: number | undefined;
	lastSentAt: number;
	characterConnections: Array<RBXScriptConnection>;
}

const records = new Map<Player, PlayerMovement>();

let sprintRemote: RemoteEvent | undefined;
let rollRemote: RemoteEvent | undefined;
let staminaRemote: RemoteEvent | undefined;

function createRemote(folder: Folder, name: string): RemoteEvent {
	const remote = new Instance("RemoteEvent");
	remote.Name = name;
	remote.Parent = folder;
	return remote;
}

function logAbuse(player: Player, reason: string): void {
	if (LOG_LIMIT.tryTake(player.UserId, os.clock())) {
		// UserId only: no names or other personal data in logs (CLAUDE.md).
		warn(`[movement] ${player.UserId}: ${reason}`);
	}
}

// ---------------------------------------------------------------------------
// Remote handlers. They take `...args` and check them by hand: TypeScript types do not exist at
// runtime and a client can send anything. Bad requests are dropped, never thrown on.
// ---------------------------------------------------------------------------

function handleSetSprint(player: Player, args: Array<unknown>): void {
	const record = records.get(player);
	if (record === undefined || record.humanoid === undefined) {
		return;
	}
	if (!SPRINT_LIMIT.tryTake(player.UserId, os.clock())) {
		logAbuse(player, "sprint rate limit");
		return;
	}
	const held = args[0];
	if (args.size() !== 1 || !typeIs(held, "boolean")) {
		logAbuse(player, "bad sprint arguments");
		return;
	}
	record.state = setSprintHeld(record.state, held);
}

// A roll starts from the ground only (Souls-like): not mid-air, not swimming or climbing.
const NO_ROLL_STATES = new Set<Enum.HumanoidStateType>([
	Enum.HumanoidStateType.Freefall,
	Enum.HumanoidStateType.Jumping,
	Enum.HumanoidStateType.Swimming,
	Enum.HumanoidStateType.Climbing,
	Enum.HumanoidStateType.Seated,
	Enum.HumanoidStateType.Dead,
]);

function handleRequestRoll(player: Player, args: Array<unknown>): void {
	const record = records.get(player);
	if (record === undefined || record.humanoid === undefined) {
		return;
	}
	if (!ROLL_LIMIT.tryTake(player.UserId, os.clock())) {
		logAbuse(player, "roll rate limit");
		return;
	}
	const direction = args[0];
	if (args.size() !== 1 || !typeIs(direction, "Vector3")) {
		logAbuse(player, "bad roll arguments");
		return;
	}
	if (normalizeRollDirection(direction.X, direction.Y, direction.Z) === undefined) {
		logAbuse(player, "bad roll direction");
		return;
	}
	if (NO_ROLL_STATES.has(record.humanoid.GetState())) {
		return;
	}
	// Cooldown / stamina / state refusals are NOT logged: with network delay an honest client can
	// press a moment too early. The client's own movement is then judged by the speed check.
	record.state = requestRoll(record.state, os.clock()).state;
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

function returnToLastValid(player: Player, record: PlayerMovement, root: BasePart): void {
	const character = player.Character;
	if (character === undefined || record.lastValidPosition === undefined) {
		return;
	}
	// Keep the facing, move the position back.
	character.PivotTo(new CFrame(record.lastValidPosition).mul(root.CFrame.Rotation));
	root.AssemblyLinearVelocity = Vector3.zero;
}

function isFiniteVector(v: Vector3): boolean {
	// NaN fails every comparison, so this also rejects NaN.
	return [v.X, v.Y, v.Z].every((n) => n > -math.huge && n < math.huge);
}

function countViolation(player: Player, record: PlayerMovement, now: number): void {
	if (now - record.violationWindowStart > VIOLATION_WINDOW) {
		record.violationWindowStart = now;
		record.violations = 0;
	}
	record.violations += 1;
	if (record.violations === VIOLATION_FLAG_AT) {
		// Logged once per window, not rate limited, so a real cheater always shows up in the output.
		warn(`[movement] ${player.UserId}: FLAGGED, ${VIOLATION_FLAG_AT} speed violations in ${VIOLATION_WINDOW} s`);
	}
}

function checkSpeed(player: Player, record: PlayerMovement, root: BasePart, now: number): void {
	if (record.lastValidPosition === undefined) {
		// Never anchor on a broken position: returning there later would break the character.
		if (now >= record.anchorReadyAt && isFiniteVector(root.Position)) {
			record.lastValidPosition = root.Position;
			record.lastSampleAt = now;
			record.speedBudget = fullSpeedBudget(MAX_LEGAL_SPEED);
		}
		return;
	}
	if (now - record.lastSampleAt < SPEED_CHECK.interval) {
		return;
	}
	// A NaN position gives NaN deltas, which checkMove rejects, so the player is returned to safety.
	const delta = root.Position.sub(record.lastValidPosition);
	const verdict = checkMove(
		record.speedBudget,
		{ dx: delta.X, dy: delta.Y, dz: delta.Z, dt: now - record.lastSampleAt },
		MAX_LEGAL_SPEED,
	);
	record.lastSampleAt = now;
	record.speedBudget = verdict.budget;
	if (verdict.plausible) {
		record.lastValidPosition = root.Position;
	} else {
		logAbuse(player, "moved too fast, returned to last valid position");
		countViolation(player, record, now);
		returnToLastValid(player, record, root);
	}
}

function sendStamina(player: Player, record: PlayerMovement, now: number): void {
	const value = math.floor(record.state.stamina.current);
	if (value === record.lastSentStamina) {
		return;
	}
	// Empty and full are always sent at once, so the UI never sticks at 1 or 99.
	const edge = value === 0 || value === STAMINA.max;
	if (!edge && now - record.lastSentAt < STAMINA_SEND_INTERVAL) {
		return;
	}
	record.lastSentStamina = value;
	record.lastSentAt = now;
	staminaRemote?.FireClient(player, value);
}

function updatePlayer(player: Player, record: PlayerMovement, dt: number, now: number): void {
	const humanoid = record.humanoid;
	const root = record.root;
	if (humanoid === undefined || root === undefined || root.Parent === undefined) {
		return;
	}
	const velocity = root.AssemblyLinearVelocity;
	const isMoving = new Vector3(velocity.X, 0, velocity.Z).Magnitude > MOVING_THRESHOLD;
	const swimming = humanoid.GetState() === Enum.HumanoidStateType.Swimming;

	record.state = tick(record.state, dt, now, isMoving);

	// The server sets the speed for honest clients; cheaters are limited by the speed check (docs/movement.md).
	const speed = walkSpeedFor(record.state, swimming);
	if (humanoid.WalkSpeed !== speed) {
		humanoid.WalkSpeed = speed;
	}

	if (record.fallTopY !== undefined) {
		record.fallTopY = math.max(record.fallTopY, root.Position.Y);
	}
	// No exception for `humanoid.Sit`: the client controls that property, so a cheater could set it
	// to skip the check. If the map gets moving seats, the server re-anchors with resetMovementAnchor.
	if (record.state.mode !== "dead") {
		checkSpeed(player, record, root, now);
	}
	sendStamina(player, record, now);
}

// ---------------------------------------------------------------------------
// Characters and players
// ---------------------------------------------------------------------------

function onLanded(record: PlayerMovement, humanoid: Humanoid, root: BasePart): void {
	if (record.fallTopY === undefined) {
		return;
	}
	const height = record.fallTopY - root.Position.Y;
	record.fallTopY = undefined;
	const damage = fallDamage(height, humanoid.MaxHealth, humanoid.Health);
	if (damage > 0) {
		// Note: a cheater can hide a fall by faking the humanoid state. That only spares themselves
		// some damage, so it is not worth a heavier check.
		humanoid.TakeDamage(damage);
	}
}

function watchCharacter(player: Player, record: PlayerMovement, character: Model): void {
	for (const connection of record.characterConnections) {
		connection.Disconnect();
	}
	record.characterConnections = [];
	record.humanoid = undefined;
	record.root = undefined;
	record.lastValidPosition = undefined;
	record.fallTopY = undefined;
	record.state = initialMovementState();

	const humanoid = character.WaitForChild("Humanoid", 10);
	const root = character.WaitForChild("HumanoidRootPart", 10);
	// The character may have been replaced while we waited; then the newer call handles it.
	if (player.Character !== character || records.get(player) !== record) {
		return;
	}
	if (humanoid === undefined || !humanoid.IsA("Humanoid") || root === undefined || !root.IsA("BasePart")) {
		return;
	}
	record.humanoid = humanoid;
	record.root = root;
	record.anchorReadyAt = os.clock() + SPAWN_GRACE;

	record.characterConnections.push(
		humanoid.Died.Connect(() => {
			record.state = die(record.state);
		}),
		humanoid.StateChanged.Connect((_, newState) => {
			if (newState === Enum.HumanoidStateType.Freefall) {
				record.fallTopY = root.Position.Y;
			} else if (newState === Enum.HumanoidStateType.Landed) {
				onLanded(record, humanoid, root);
			} else if (
				newState === Enum.HumanoidStateType.Swimming ||
				newState === Enum.HumanoidStateType.Climbing ||
				newState === Enum.HumanoidStateType.Seated
			) {
				// Water, ladders and seats break a fall.
				record.fallTopY = undefined;
			}
		}),
	);
}

function onPlayerAdded(player: Player): void {
	// Shift is our sprint key; by default Roblox uses it to toggle Shift Lock. Turned off from code
	// so the place file does not need to change.
	player.DevEnableMouseLock = false;

	const record: PlayerMovement = {
		state: initialMovementState(),
		humanoid: undefined,
		root: undefined,
		lastValidPosition: undefined,
		lastSampleAt: 0,
		anchorReadyAt: 0,
		speedBudget: fullSpeedBudget(MAX_LEGAL_SPEED),
		violations: 0,
		violationWindowStart: 0,
		fallTopY: undefined,
		lastSentStamina: undefined,
		lastSentAt: 0,
		characterConnections: [],
	};
	records.set(player, record);
	player.CharacterAdded.Connect((character) => watchCharacter(player, record, character));
	const existing = player.Character;
	if (existing !== undefined) {
		task.spawn(watchCharacter, player, record, existing);
	}
}

function onPlayerRemoving(player: Player): void {
	const record = records.get(player);
	if (record !== undefined) {
		for (const connection of record.characterConnections) {
			connection.Disconnect();
		}
	}
	records.delete(player);
	SPRINT_LIMIT.forget(player.UserId);
	ROLL_LIMIT.forget(player.UserId);
	LOG_LIMIT.forget(player.UserId);
}

// ---------------------------------------------------------------------------
// Server-side API for other features (combat, abilities). No remote reaches these.
// ---------------------------------------------------------------------------

/** True during the player's roll i-frames. Combat skips damage while this is true. */
export function isInvulnerable(player: Player): boolean {
	const record = records.get(player);
	return record !== undefined && isStateInvulnerable(record.state, os.clock());
}

/** Stuns the player for `seconds`. Ignored while rolling or dead. */
export function stunPlayer(player: Player, seconds: number): void {
	const record = records.get(player);
	if (record === undefined || !(seconds > 0 && seconds < math.huge)) {
		return;
	}
	record.state = stun(record.state, os.clock() + seconds);
}

/**
 * Call after the SERVER moves a player (fast travel, dungeon entry), so the speed check does not
 * treat that move as a cheat.
 */
export function resetMovementAnchor(player: Player): void {
	const record = records.get(player);
	if (record !== undefined) {
		record.lastValidPosition = undefined;
		record.anchorReadyAt = os.clock();
	}
}

/** Creates the remotes and starts the per-frame update. Call once at server start. */
export function startMovementService(): void {
	if (sprintRemote !== undefined) {
		return;
	}
	const folder = new Instance("Folder");
	folder.Name = MOVEMENT_REMOTE_FOLDER;
	sprintRemote = createRemote(folder, MOVEMENT_REMOTES.setSprint);
	rollRemote = createRemote(folder, MOVEMENT_REMOTES.requestRoll);
	staminaRemote = createRemote(folder, MOVEMENT_REMOTES.staminaChanged);
	// Parent last, so the client never sees a half-built folder.
	folder.Parent = ReplicatedStorage;

	sprintRemote.OnServerEvent.Connect((player, ...args: Array<unknown>) => handleSetSprint(player, args));
	rollRemote.OnServerEvent.Connect((player, ...args: Array<unknown>) => handleRequestRoll(player, args));

	Players.PlayerAdded.Connect(onPlayerAdded);
	Players.PlayerRemoving.Connect(onPlayerRemoving);
	for (const player of Players.GetPlayers()) {
		onPlayerAdded(player);
	}

	RunService.Heartbeat.Connect((dt) => {
		const now = os.clock();
		for (const [player, record] of records) {
			// One player's error (e.g. a half-destroyed character) must not skip everyone after them.
			const [ok, err] = pcall(updatePlayer, player, record, dt, now);
			if (!ok) {
				warn(`[movement] update failed for ${player.UserId}: ${err}`);
			}
		}
	});
}
