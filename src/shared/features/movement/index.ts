// movement feature (shared): movement rules (sprint, roll, stamina, fall damage, speed check) and network names.
// Public API of this feature. Other code imports only from this file.
export { fallDamage } from "./fall-damage";
export {
	MAX_LEGAL_SPEED,
	canTransition,
	die,
	initialMovementState,
	isInvulnerable,
	requestRoll,
	setSprintHeld,
	stun,
	tick,
	walkSpeedFor,
} from "./movement-state";
export type { MovementMode, MovementState, RollRefusal, RollResult } from "./movement-state";
export { MOVEMENT_REMOTES, MOVEMENT_REMOTE_FOLDER } from "./network";
export { ROLL_START_SPEED, rollAngleAt, rollProgress, rollSpeedAt, rollTuckAt } from "./roll-curve";
export { normalizeRollDirection } from "./roll-direction";
export type { FlatDirection } from "./roll-direction";
export { checkMove, clearRollCredit, fullSpeedBudget, grantRollCredit } from "./speed-check";
export type { MoveSample, SpeedBudget, SpeedVerdict } from "./speed-check";
export type { Stamina } from "./stamina";
export { FALL, ROLL, ROLL_SPEED, SPEEDS, SPEED_CHECK, STAMINA } from "./tuning";
