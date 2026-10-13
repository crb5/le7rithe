const seedEnvironments = new Set(["development", "test"]);

export const shouldRunMarketplaceDemoSeed = (
  nodeEnv: string | undefined,
  explicitOptIn: string | undefined,
): boolean =>
  seedEnvironments.has(nodeEnv ?? "") && explicitOptIn === "true";