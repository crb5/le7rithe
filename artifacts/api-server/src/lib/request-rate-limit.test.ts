import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import express, { type Request, type Response } from "express";
import {
  createRequestRateLimiter,
  postgresRateLimitStore,
  type RateLimitStore,
} from "./request-rate-limit";

function memoryStore(clock: { now: number }): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async consume({ limiterKey, clientKeyHash, windowMs, max }) {
      const key = `${limiterKey}:${clientKeyHash}`;
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= clock.now) {
        bucket = { count: 1, resetAt: clock.now + windowMs };
        buckets.set(key, bucket);
      } else {
        bucket.count = Math.min(bucket.count + 1, max + 1);
      }
      return { ...bucket };
    },
    async pruneExpired() {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= clock.now) buckets.delete(key);
      }
    },
  };
}

async function invoke(limiter: ReturnType<typeof createRequestRateLimiter>) {
  let status = 200;
  let responseBody: unknown;
  let nextCalled = false;
  const headers: Record<string, string> = {};
  const response = {
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    status(code: number) {
      status = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  await limiter(
    { ip: "192.0.2.30" } as Request,
    response,
    (() => {
      nextCalled = true;
    }) as never,
  );
  return { status, responseBody, headers, nextCalled };
}

test("independent limiter instances share a bucket and reset after expiry", async () => {
  const clock = { now: 10_000 };
  const store = memoryStore(clock);
  const options = {
    limiterKey: "simulated-process-shared",
    windowMs: 1_000,
    max: 2,
    keyGenerator: () => "client-key",
  };
  const processA = createRequestRateLimiter(options, store);
  const processB = createRequestRateLimiter(options, store);

  assert.equal((await invoke(processA)).status, 200);
  assert.equal((await invoke(processB)).status, 200);
  const blocked = await invoke(processA);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers["Retry-After"], "1");

  clock.now += 1_000;
  assert.equal((await invoke(processB)).status, 200);
});

test("concurrent limiter instances share the development PostgreSQL bucket", {
  skip: process.env.ALLOW_DEV_DB_TESTS !== "1"
    ? "Set ALLOW_DEV_DB_TESTS=1 to opt into the development-PostgreSQL integration test."
    : false,
}, async () => {
  const limiterKey = `test-processes-${process.pid}-${Date.now()}`;
  const options = {
    limiterKey,
    windowMs: 100,
    max: 3,
    keyGenerator: () => "synthetic-rate-limit-test-key",
  };
  const processA = createRequestRateLimiter(options);
  const processB = createRequestRateLimiter(options);
  try {
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        invoke(index % 2 === 0 ? processA : processB),
      ),
    );
    assert.equal(outcomes.filter(({ status }) => status === 200).length, 3);
    assert.equal(outcomes.filter(({ status }) => status === 429).length, 5);

    await new Promise((resolve) => setTimeout(resolve, options.windowMs + 30));
    await postgresRateLimitStore.pruneExpired();
    assert.equal((await invoke(processB)).status, 200);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, options.windowMs + 30));
    await postgresRateLimitStore.pruneExpired();
  }
});

test("database failures fail open or closed according to route policy", async () => {
  const unavailable: RateLimitStore = {
    async consume() {
      throw new Error("database unavailable");
    },
    async pruneExpired() {},
  };
  const base = { limiterKey: "failure-mode", windowMs: 1_000, max: 1 };

  const open = await invoke(createRequestRateLimiter(base, unavailable));
  assert.equal(open.nextCalled, true);
  assert.equal(open.status, 200);

  const closed = await invoke(
    createRequestRateLimiter({ ...base, failClosed: true }, unavailable),
  );
  assert.equal(closed.nextCalled, false);
  assert.equal(closed.status, 503);
});

test("three trusted proxy hops use the sanitized client IP, not the incoming spoof", async () => {
  const app = express();
  app.set("trust proxy", 3);
  app.use((req, _res, next) => {
    // Replit preview replaced the supplied XFF value and delivered three entries.
    req.headers["x-forwarded-for"] =
      "203.0.113.10, 192.0.2.20, 192.0.2.30";
    next();
  });
  app.get("/", (req, res) =>
    res.json({ ip: req.ip, trustedIpsCount: req.ips.length }),
  );
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/`, {
      headers: { "X-Forwarded-For": "198.51.100.77" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ip: "203.0.113.10",
      trustedIpsCount: 3,
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});
