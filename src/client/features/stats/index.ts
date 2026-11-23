// stats feature (client): shows level, XP and stat points from the server and sends "spend a point" intent.
// Public API of this feature.
export { getStatsSnapshot, onLevelUp, onStatsChanged, requestAllocate, startStatsController } from "./stats-controller";
