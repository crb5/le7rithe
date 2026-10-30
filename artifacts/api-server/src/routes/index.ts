import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import adminRouter from "./admin";
import legalPolicyRouter from "./legal-policy";

const router: IRouter = Router();

// Liveness must remain public so the deployment platform can determine whether
// the process is alive without needing an authenticated session.
router.use(healthRouter);

// Individual route handlers enforce authentication for private mutations and
// user-owned data. Public marketplace reads remain available to visitors.
router.use(adminRouter);
router.use(marketplaceRouter);
router.use(legalPolicyRouter);

export default router;
