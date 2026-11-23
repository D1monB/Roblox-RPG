// Client bootstrap. Starts feature controllers (input, UI, effects only).
// Controllers are wired in here as they are implemented.
import { startMovementController } from "client/features/movement";
import { startStatsController } from "client/features/stats";

startStatsController();
startMovementController();
