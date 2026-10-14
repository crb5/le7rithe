import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware, getAuth } from "./lib/auth";
import router from "./routes";
import { logger } from "./lib/logger";
import { createRequestRateLimiter } from "./lib/request-rate-limit";
import { trustProxyHops } from "./lib/proxy-trust";

const app: Express = express();
app.set("trust proxy", trustProxyHops());
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  credentials: true,
}));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use(authMiddleware);

const requestRateLimitKey = (req: express.Request) => {
  const userId = getAuth(req).userId;
  return userId ? `user:${userId}` : `ip:${req.ip || "unknown"}`;
};
const mutationRateLimiter = createRequestRateLimiter({
  limiterKey: "api-mutation",
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: requestRateLimitKey,
  failClosed: (req) =>
    req.path.startsWith("/auth/phone/") ||
    req.path === "/auth/send-code" ||
    req.path === "/auth/verify-code",
});
const adminPasswordLoginRateLimiter = createRequestRateLimiter({
  limiterKey: "admin-password-login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: requestRateLimitKey,
  failClosed: true,
});
app.use("/api", (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  if (req.path === "/admin/password/login") {
    adminPasswordLoginRateLimiter(req, res, next);
    return;
  }
  mutationRateLimiter(req, res, next);
});

app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }
  const requestOrigin = `${req.protocol}://${req.get("host")}`;
  if (origin === requestOrigin || allowedOrigins.includes(origin)) {
    next();
    return;
  }
  res.status(403).json({ error: "Cross-site request blocked" });
});

app.use("/api", router);

// Optionally serve the built single-page app from the same origin (used by the
// single-container Docker image). The SPA calls the API at `/api`, so serving
// both here avoids any cross-origin or proxy configuration in production.
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  app.use(express.static(staticDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log.error({ err: error }, "Unhandled API error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
