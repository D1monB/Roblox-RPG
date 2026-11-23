// profile feature (server): loads, hands out and saves player data. The ONLY place that writes player data.
// Public API of this feature. Other code imports only from this file.
export { getProfileData, onProfileLoaded, startProfileService } from "./profile-service";
