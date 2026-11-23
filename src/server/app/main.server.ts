// Server bootstrap. Starts feature services in a fixed order:
// profile must load before anything reads player data.
// Feature services are wired in here as they are implemented.
import { startProfileService } from "server/features/profile";
import { startStatsService } from "server/features/stats";

startProfileService();
startStatsService();
