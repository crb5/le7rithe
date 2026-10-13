import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { adminRouteAccessFailure } from "./admin-route-access";

test("simulated visitors, users, and moderators receive the same concealed admin response", async () => {
  const app = express();
  app.get("/admin/private", (req, res) => {
    const role = req.header("x-mock-role");
    const actor = role
      ? { role, status: req.header("x-mock-status") ?? "active" }
      : null;
    const failure = adminRouteAccessFailure(
      actor,
      req.header("x-mock-admin-session") === "active",
    );
    if (failure) {
      res.status(failure.status).json({ error: failure.error });
      return;
    }
    res.status(204).end();
  });

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/admin/private`;
    const responses = await Promise.all([
      fetch(url),
      fetch(url, { headers: { "x-mock-role": "user" } }),
      fetch(url, { headers: { "x-mock-role": "moderator" } }),
      fetch(url, {
        headers: { "x-mock-role": "admin", "x-mock-status": "suspended" },
      }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    for (const response of responses) assert.equal(response.status, 404);
    assert.deepEqual(bodies, Array.from({ length: 4 }, () => ({ error: "Not found" })));

    const adminWithoutSecondFactor = await fetch(url, {
      headers: { "x-mock-role": "admin" },
    });
    assert.equal(adminWithoutSecondFactor.status, 401);
    assert.deepEqual(await adminWithoutSecondFactor.json(), {
      error: "Admin password required",
    });

    const authorizedAdmin = await fetch(url, {
      headers: {
        "x-mock-role": "admin",
        "x-mock-admin-session": "active",
      },
    });
    assert.equal(authorizedAdmin.status, 204);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("an active simulated administrator still needs the second password session", () => {
  assert.deepEqual(
    adminRouteAccessFailure({ role: "admin", status: "active" }, false),
    { status: 401, error: "Admin password required" },
  );
  assert.equal(
    adminRouteAccessFailure({ role: "admin", status: "active" }, true),
    null,
  );
});
