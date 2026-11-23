import { ContextActionService, Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { MOVEMENT_REMOTES, MOVEMENT_REMOTE_FOLDER, ROLL, STAMINA } from "shared/features/movement";
import { MOVEMENT_ANIMATIONS } from "./animations";
import { playRoll } from "./roll-motion";

// The client sends intent (sprint key, roll direction) and plays the roll locally so it feels instant.
// Speed, stamina, cooldown and i-frames are decided by the server (docs/movement.md).

const SPRINT_ACTION = "Sprint";
const ROLL_ACTION = "Roll";

let sprintRemote: RemoteEvent | undefined;
let rollRemote: RemoteEvent | undefined;
let stamina: number = STAMINA.max;
let sprintOn = false;
let lastRollAt: number | undefined;
const staminaListeners: Array<(value: number) => void> = [];

/** Last stamina value from the server (0..STAMINA.max). */
export function getStamina(): number {
	return stamina;
}

/** UI subscribes here; called on every update from the server. */
export function onStaminaChanged(listener: (value: number) => void): void {
	staminaListeners.push(listener);
	listener(stamina);
}

function setSprint(on: boolean): void {
	if (sprintOn === on) {
		return;
	}
	sprintOn = on;
	sprintRemote?.FireServer(on);
}

function handleSprint(_: string, inputState: Enum.UserInputState, input: InputObject): Enum.ContextActionResult {
	if (input.UserInputType === Enum.UserInputType.Touch) {
		// Holding a button while steering with the other thumb is awkward on a phone, so touch toggles.
		if (inputState === Enum.UserInputState.Begin) {
			setSprint(!sprintOn);
		}
	} else if (inputState === Enum.UserInputState.Begin) {
		setSprint(true);
	} else if (inputState === Enum.UserInputState.End || inputState === Enum.UserInputState.Cancel) {
		setSprint(false);
	}
	return Enum.ContextActionResult.Sink;
}

/**
 * Moving: roll where the stick/keys point. Standing: roll forward, away from the camera (there is
 * no lock-on, so "forward" is what players expect). Always flat and unit length.
 */
function rollDirection(humanoid: Humanoid, root: BasePart): Vector3 | undefined {
	const moving = humanoid.MoveDirection;
	const camera = Workspace.CurrentCamera;
	const standingDirection = camera !== undefined ? camera.CFrame.LookVector : root.CFrame.LookVector;
	const source = moving.Magnitude > 0.1 ? moving : standingDirection;
	const flat = new Vector3(source.X, 0, source.Z);
	return flat.Magnitude > 0.01 ? flat.Unit : undefined;
}

/** Plays the designer's roll animation if one is set. Returns true if it is playing. */
function playRollAnimation(humanoid: Humanoid): boolean {
	const id = MOVEMENT_ANIMATIONS.roll;
	const animator = humanoid.FindFirstChildOfClass("Animator");
	if (id === undefined || animator === undefined) {
		return false;
	}
	const animation = new Instance("Animation");
	animation.AnimationId = id;
	animator.LoadAnimation(animation).Play();
	return true;
}

// Same rule as the server: rolls start from the ground only.
const NO_ROLL_STATES = new Set<Enum.HumanoidStateType>([
	Enum.HumanoidStateType.Freefall,
	Enum.HumanoidStateType.Jumping,
	Enum.HumanoidStateType.Swimming,
	Enum.HumanoidStateType.Climbing,
	Enum.HumanoidStateType.Seated,
	Enum.HumanoidStateType.Dead,
]);

function handleRoll(_: string, inputState: Enum.UserInputState): Enum.ContextActionResult {
	if (inputState !== Enum.UserInputState.Begin) {
		return Enum.ContextActionResult.Sink;
	}
	const character = Players.LocalPlayer.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	const root = character?.FindFirstChild("HumanoidRootPart");
	if (humanoid === undefined || root === undefined || !root.IsA("BasePart") || humanoid.Health <= 0) {
		return Enum.ContextActionResult.Sink;
	}
	// Predict only when the server would most likely agree, so honest players are rarely corrected.
	const now = os.clock();
	const onCooldown = lastRollAt !== undefined && now - lastRollAt < ROLL.cooldown;
	if (onCooldown || stamina < STAMINA.rollCost || NO_ROLL_STATES.has(humanoid.GetState())) {
		return Enum.ContextActionResult.Sink;
	}
	const direction = rollDirection(humanoid, root);
	if (direction === undefined) {
		return Enum.ContextActionResult.Sink;
	}
	lastRollAt = now;
	rollRemote?.FireServer(direction);
	// A real animation replaces the procedural somersault; the facing and speed curve stay.
	const hasAnimation = playRollAnimation(humanoid);
	playRoll(humanoid, root, direction, !hasAnimation);
	return Enum.ContextActionResult.Sink;
}

export function startMovementController(): void {
	if (sprintRemote !== undefined) {
		return;
	}
	const folder = ReplicatedStorage.WaitForChild(MOVEMENT_REMOTE_FOLDER) as Folder;
	sprintRemote = folder.WaitForChild(MOVEMENT_REMOTES.setSprint) as RemoteEvent;
	rollRemote = folder.WaitForChild(MOVEMENT_REMOTES.requestRoll) as RemoteEvent;
	const staminaRemote = folder.WaitForChild(MOVEMENT_REMOTES.staminaChanged) as RemoteEvent;

	staminaRemote.OnClientEvent.Connect((value: unknown) => {
		if (!typeIs(value, "number")) {
			return;
		}
		stamina = value;
		for (const listener of staminaListeners) {
			listener(value);
		}
	});

	// A new character starts with sprint off on the server, so match it here.
	Players.LocalPlayer.CharacterAdded.Connect(() => {
		sprintOn = false;
	});

	// `true` = Roblox also creates an on-screen button on phones and tablets (docs/decisions.md #1).
	ContextActionService.BindAction(SPRINT_ACTION, handleSprint, true, Enum.KeyCode.LeftShift, Enum.KeyCode.ButtonL3);
	ContextActionService.SetTitle(SPRINT_ACTION, "Sprint");
	ContextActionService.BindAction(
		ROLL_ACTION,
		handleRoll,
		true,
		Enum.KeyCode.C,
		Enum.KeyCode.LeftAlt,
		Enum.KeyCode.ButtonB,
	);
	ContextActionService.SetTitle(ROLL_ACTION, "Roll");
}
