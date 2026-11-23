// Network contract for the movement feature: names only, no logic.
// The server creates these RemoteEvents in one folder in ReplicatedStorage; the client waits for them.
export const MOVEMENT_REMOTE_FOLDER = "MovementRemotes";

export const MOVEMENT_REMOTES = {
	// client -> server: one boolean. Intent only: "I hold / released the sprint key".
	setSprint: "SetSprint",
	// client -> server: one Vector3, a unit direction. Intent only: "roll this way".
	requestRoll: "RequestRoll",
	// server -> client: the receiving player's own stamina (number), throttled.
	staminaChanged: "StaminaChanged",
} as const;
