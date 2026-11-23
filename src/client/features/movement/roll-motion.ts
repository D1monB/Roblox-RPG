import { RunService } from "@rbxts/services";
import { rollAngleAt, rollProgress, rollSpeedAt, rollTuckAt } from "shared/features/movement";

// The physical and visual part of a roll, played on the client that owns the character.
// Only looks and movement: whether the roll COUNTS (stamina, i-frames) is decided by the server.

// The "curled up" pose while rolling, as DATA: how far each R15 joint bends at full tuck, in radians.
// Joint C0 is turned around the X axis. Positive swings a hanging limb FORWARD, negative leans the
// upright torso/head forward. Tune the numbers here if a limb looks wrong; the logic does not change.
interface TuckJoint {
	partName: string;
	jointName: string;
	pitch: number;
}

const TUCK_POSE: ReadonlyArray<TuckJoint> = [
	// Thighs up to the chest, shins folded back.
	{ partName: "LowerTorso", jointName: "LeftHip", pitch: 1.5 },
	{ partName: "LowerTorso", jointName: "RightHip", pitch: 1.5 },
	{ partName: "LeftUpperLeg", jointName: "LeftKnee", pitch: -1.7 },
	{ partName: "RightUpperLeg", jointName: "RightKnee", pitch: -1.7 },
	// Arms wrapped around the knees.
	{ partName: "UpperTorso", jointName: "LeftShoulder", pitch: 1.3 },
	{ partName: "UpperTorso", jointName: "RightShoulder", pitch: 1.3 },
	{ partName: "LeftUpperArm", jointName: "LeftElbow", pitch: 1.2 },
	{ partName: "RightUpperArm", jointName: "RightElbow", pitch: 1.2 },
	// Back rounded, chin down.
	{ partName: "UpperTorso", jointName: "Waist", pitch: -0.5 },
	{ partName: "Head", jointName: "Neck", pitch: -0.4 },
];

interface BentJoint {
	joint: Motor6D;
	originalC0: CFrame;
	pitch: number;
}

function findJoint(character: Instance | undefined, partName: string, jointName: string): Motor6D | undefined {
	const joint = character?.FindFirstChild(partName)?.FindFirstChild(jointName);
	return joint !== undefined && joint.IsA("Motor6D") ? joint : undefined;
}

/** The joints that exist on this rig. R6 and custom rigs just skip the ones they do not have. */
function collectTuckJoints(character: Instance | undefined): Array<BentJoint> {
	const bent: Array<BentJoint> = [];
	for (const entry of TUCK_POSE) {
		const joint = findJoint(character, entry.partName, entry.jointName);
		if (joint !== undefined) {
			bent.push({ joint, originalC0: joint.C0, pitch: entry.pitch });
		}
	}
	return bent;
}

/**
 * Turns the character toward `direction`, slides it along the ground with a fast-then-fading speed
 * (Dark Souls feel) and, if `somersault` is true, curls up and spins the body one full forward turn.
 * Cleans up by itself, also if the character dies or is removed mid-roll.
 */
export function playRoll(humanoid: Humanoid, root: BasePart, direction: Vector3, somersault: boolean): void {
	const character = root.Parent;
	// R6 characters have no "Root" joint; they simply roll without the spin.
	const spinJoint = somersault ? findJoint(character, "LowerTorso", "Root") : undefined;
	const spinOriginalC0 = spinJoint?.C0;
	const tuckJoints = somersault ? collectTuckJoints(character) : [];
	const wasAutoRotate = humanoid.AutoRotate;

	// Face the roll direction so the roll goes FORWARD (Souls-like), and stop Roblox turning us back.
	humanoid.AutoRotate = false;
	root.CFrame = CFrame.lookAt(root.Position, root.Position.add(direction));

	const attachment = new Instance("Attachment");
	attachment.Parent = root;
	const velocity = new Instance("LinearVelocity");
	velocity.Attachment0 = attachment;
	velocity.RelativeTo = Enum.ActuatorRelativeTo.World;
	// Plane mode: we control the ground speed only, gravity and slopes still work.
	velocity.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane;
	velocity.PrimaryTangentAxis = new Vector3(1, 0, 0);
	velocity.SecondaryTangentAxis = new Vector3(0, 0, 1);
	velocity.PlaneVelocity = new Vector2(direction.X * rollSpeedAt(0), direction.Z * rollSpeedAt(0));
	velocity.MaxForce = math.huge;
	velocity.Parent = root;

	const startedAt = os.clock();

	const finish = (): void => {
		connection.Disconnect();
		velocity.Destroy();
		attachment.Destroy();
		// Put every joint back exactly as it was, so the next animation starts from a clean pose.
		if (spinJoint !== undefined && spinOriginalC0 !== undefined) {
			spinJoint.C0 = spinOriginalC0;
		}
		for (const bent of tuckJoints) {
			bent.joint.C0 = bent.originalC0;
		}
		humanoid.AutoRotate = wasAutoRotate;
	};

	// RenderStepped: runs right before every frame is drawn, so the spin looks smooth.
	const connection = RunService.RenderStepped.Connect(() => {
		const progress = rollProgress(os.clock() - startedAt);
		if (progress >= 1 || humanoid.Health <= 0 || root.Parent === undefined) {
			finish();
			return;
		}
		const speed = rollSpeedAt(progress);
		velocity.PlaneVelocity = new Vector2(direction.X * speed, direction.Z * speed);
		if (spinJoint !== undefined && spinOriginalC0 !== undefined) {
			// C0 is the joint's offset from the root part. Turning it spins the body around the hips.
			spinJoint.C0 = spinOriginalC0.mul(CFrame.Angles(rollAngleAt(progress), 0, 0));
		}
		const tuck = rollTuckAt(progress);
		for (const bent of tuckJoints) {
			bent.joint.C0 = bent.originalC0.mul(CFrame.Angles(bent.pitch * tuck, 0, 0));
		}
	});
}
