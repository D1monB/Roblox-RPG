// movement feature (server): authoritative movement state, speeds, stamina, roll i-frames, speed check.
// Public API of this feature. Other code imports only from this file.
export { isInvulnerable, resetMovementAnchor, startMovementService, stunPlayer } from "./movement-service";
