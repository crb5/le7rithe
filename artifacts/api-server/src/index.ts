import app from "./app";
import { logger } from "./lib/logger";
import { cleanupAbandonedPaymentProofs } from "./routes/marketplace";
import { validateProductionFeatureFlags } from "./lib/features";

validateProductionFeatureFlags();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const paymentProofCleanupSchedule = setInterval(
  () => cleanupAbandonedPaymentProofs(logger),
  60 * 60 * 1000,
);
paymentProofCleanupSchedule.unref();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
