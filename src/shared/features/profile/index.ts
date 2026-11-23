// profile feature (shared): player data schema, version, migrations and validation.
// Pure logic, no Roblox API. The server feature `profile` does the actual loading and saving.
// `loadProfileData` is exported so it can be unit tested. Only the server may call it and trust its result:
// anything the client computes with it is just a guess.
// Public API of this feature. Other code imports only from this file.
export { CURRENT_SCHEMA_VERSION, createDefaultProfileData, isProfileData } from "./schema";
export type { AllocatedStats, ProfileData } from "./schema";
export { loadProfileData } from "./load-profile-data";
export type { LoadFailure, LoadResult } from "./load-profile-data";
