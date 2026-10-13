import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isProductionObjectStorageConfigured } from "../lib/objectStorage";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res): Promise<void> => {
  try {
    await db.execute(sql`select 1`);
    if (!isProductionObjectStorageConfigured()) {
      res.status(503).json({
        status: "not_ready",
        code: "PRIVATE_OBJECT_STORAGE_NOT_CONFIGURED",
      });
      return;
    }
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

export default router;
