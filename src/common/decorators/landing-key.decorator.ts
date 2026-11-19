import { SetMetadata } from "@nestjs/common";

// Handlers the public landing page may call with its own key
// (LANDING_API_KEY) instead of the BFF's INTERNAL_API_KEY. Any other
// handler refuses the landing key, so a leaked one exposes nothing of the
// app. See InternalApiKeyGuard.
export const LANDING_KEY_ALLOWED = "landingKeyAllowed";
export const LandingKeyAllowed = () => SetMetadata(LANDING_KEY_ALLOWED, true);
