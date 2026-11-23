import { RunService } from "@rbxts/services";
import { rollAngleAt, rollProgress, rollSpeedAt, rollTuckAt } from "shared/features/movement";

// The physical and visual part of a roll, played on the client that owns the character.
// Only looks and movement: whether the roll COUNTS (stamina, i-frames) is decided by the server.

// The "curled up" pose while rolling, as DATA: how far each R15 joint bends at full tuck, in radians.
// Joint C0 is turned around the X axis. Positive swings a hanging limb FORWARD, negative leans the
// upright torso/head forward. Tune the numbers here if a limb looks wrong; the logic does not change.
// Joints are found by NAME anywhere in the character: in Roblox a joint lives inside the part it
// moves (the knee is inside the lower leg), so searching one fixed parent does not work.
interface TuckJoint {
	jointName: string;
	pitch: number;
}

const TUCK_POSE: ReadonlyArray<TuckJoint> = [
	// Thighs up to the chest, shins folded back.
	{ jointName: "LeftHip", pitch: 1.5 },
	{ jointName: "RightHip", pitch: 1.5 },
	{ jointName: "LeftKnee", pitch: -1.7 },
	{ jointName: "RightKnee", pitch: -1.7 },
	// Arms wrapped around the knees.
	{ jointName: "LeftShoulder", pitch: 1.3 },
	{ jointName: "RightShoulder", pitch: 1.3 },
	{ jointName: "LeftElbow", pitch: 1.2 },
	{ jointName: "RightElbow", pitch: 1.2 },
	// Back rounded, chin down.
	{ jointName: "Waist", pitch: -0.5 },
	{ jointName: "Neck", pitch: -0.4 },
];

// The joint that spins the whole body. R6 builds its "RootJoint" with a turned frame, so the same
// angle spins the other way round there: the sign fixes that.
const SPIN_JOINTS = [
	{ jointName: "Root", sign: 1, rig: Enum.HumanoidRigType.R15 },
	{ jointName: "RootJoint", sign: -1, rig: Enum.HumanoidRigType.R6 },
] as const;

interface BentJoint {
	joint: Motor6D;
	originalC0: CFrame;
	pitch: number;
}

function findJoint(character: Instance | undefined, jointName: string): Motor6D | undefined {
	const found = character?.FindFirstChild(jointName, true);
	return found !== undefined && found.IsA("Motor6D") ? found : undefined;
}

/** The tuck joints that exist on this rig. Custom rigs just skip the ones they do not have. */
function collectTuckJoints(character: Instance | undefined): Array<BentJoint> {
	const bent: Array<BentJoint> = [];
	for (const entry of TUCK_POSE) {
		const joint = findJoint(character, entry.jointName);
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
	const spin = SPIN_JOINTS.find((candidate) => candidate.rig === humanoid.RigType);
	const spinJoint = somersault && spin !== undefined ? findJoint(character, spin.jointName) : undefined;
	const spinSign = spin?.sign ?? 1;
	const spinOriginalC0 = spinJoint?.C0;
	// Only R15 has the full pose; on R6 the body still spins, just without curling up.
	const tuckJoints = somersault && humanoid.RigType === Enum.HumanoidRigType.R15 ? collectTuckJoints(character) : [];
	const wasAutoRotate = humanoid.AutoRotate;

	if (somersault) {
		// Shown once per roll in Output. If the spin does not appear in game, this says why.
		print(
			`[movement] roll: rig=${humanoid.RigType.Name}, spin joint=${spinJoint !== undefined}, ` +
				`tuck joints=${tuckJoints.size()}/${TUCK_POSE.size()}`,
		);
	}

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
			spinJoint.C0 = spinOriginalC0.mul(CFrame.Angles(rollAngleAt(progress) * spinSign, 0, 0));
		}
		const tuck = rollTuckAt(progress);
		for (const bent of tuckJoints) {
			bent.joint.C0 = bent.originalC0.mul(CFrame.Angles(bent.pitch * tuck, 0, 0));
		}
	});
}
