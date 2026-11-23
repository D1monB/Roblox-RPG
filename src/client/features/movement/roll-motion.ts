import { RunService } from "@rbxts/services";
import { rollAngleAt, rollProgress, rollSpeedAt } from "shared/features/movement";

// The physical and visual part of a roll, played on the client that owns the character.
// Only looks and movement: whether the roll COUNTS (stamina, i-frames) is decided by the server.

function findRootJoint(character: Instance | undefined): Motor6D | undefined {
	const joint = character?.FindFirstChild("LowerTorso")?.FindFirstChild("Root");
	return joint !== undefined && joint.IsA("Motor6D") ? joint : undefined;
}

/**
 * Turns the character toward `direction`, slides it along the ground with a fast-then-fading speed
 * (Dark Souls feel) and, if `somersault` is true, spins the body one full forward turn.
 * Cleans up by itself, also if the character dies or is removed mid-roll.
 */
export function playRoll(humanoid: Humanoid, root: BasePart, direction: Vector3, somersault: boolean): void {
	// R6 characters have no "Root" joint; they simply roll without the spin.
	const joint = somersault ? findRootJoint(root.Parent) : undefined;
	const originalC0 = joint?.C0;
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
		if (joint !== undefined && originalC0 !== undefined) {
			joint.C0 = originalC0;
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
		if (joint !== undefined && originalC0 !== undefined) {
			// C0 is the joint's offset from the root part. Turning it spins the body around the hips.
			joint.C0 = originalC0.mul(CFrame.Angles(rollAngleAt(progress), 0, 0));
		}
	});
}
