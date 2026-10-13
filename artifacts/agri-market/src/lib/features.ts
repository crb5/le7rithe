/**
 * Temporary feature switch: paid listing flows are disabled for regular users.
 * Re-enable the existing flow with VITE_ENABLE_PAID_LISTINGS=true and
 * ENABLE_PAID_LISTINGS=true on the API server.
 */
export const ENABLE_PAID_LISTINGS =
  import.meta.env?.VITE_ENABLE_PAID_LISTINGS?.trim().toLowerCase() === 'true';