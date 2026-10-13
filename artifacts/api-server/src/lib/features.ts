/**
 * Temporary feature switch: paid listing flows are disabled for regular users.
 * Re-enable the existing flow with ENABLE_PAID_LISTINGS=true and
 * VITE_ENABLE_PAID_LISTINGS=true on the marketplace frontend.
 */
export const ENABLE_PAID_LISTINGS =
  process.env.ENABLE_PAID_LISTINGS?.trim().toLowerCase() === "true";

export function validateProductionFeatureFlags(
  nodeEnv = process.env.NODE_ENV,
  apiValue = process.env.ENABLE_PAID_LISTINGS,
  webValue = process.env.VITE_ENABLE_PAID_LISTINGS,
): void {
  if (nodeEnv !== "production") return;

  const parse = (value: string | undefined, name: string) => {
    const normalized = value?.trim().toLowerCase();
    if (normalized === undefined || normalized === "") return false;
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw new Error(`${name} must be either "true" or "false" in production.`);
  };

  const apiEnabled = parse(apiValue, "ENABLE_PAID_LISTINGS");
  const webEnabled = parse(webValue, "VITE_ENABLE_PAID_LISTINGS");
  if (apiEnabled !== webEnabled) {
    throw new Error(
      "ENABLE_PAID_LISTINGS and VITE_ENABLE_PAID_LISTINGS must match in production.",
    );
  }
}