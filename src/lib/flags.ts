/** Rides («DEMEU Жол») feature flag. Anything except the literal string "false" keeps the feature on. */
export const RIDES_ENABLED = String(import.meta.env.VITE_RIDES_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
