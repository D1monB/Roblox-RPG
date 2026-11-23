// Server bootstrap. Starts feature services in a fixed order:
// profile must load before anything reads player data.
// Feature services are wired in here as they are implemented.
import { startMovementService } from "server/features/movement";
import { startProfileService } from "server/features/profile";
import { startStatsService } from "server/features/stats";

startProfileService();
startStatsService();
// Movement does not read player data, but starts after profile to keep one predictable order.
startMovementService();
