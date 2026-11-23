// profile feature (shared): player data schema, version, migrations and validation.
// Pure logic, no Roblox API. The server feature `profile` does the actual loading and saving.
// Public API of this feature. Other code imports only from this file.
export { CURRENT_SCHEMA_VERSION, createDefaultProfileData, isProfileData } from "./schema";
export type { AllocatedStats, ProfileData } from "./schema";
export { loadProfileData } from "./load-profile-data";
export type { LoadFailure, LoadResult } from "./load-profile-data";
