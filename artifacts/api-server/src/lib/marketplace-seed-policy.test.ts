import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRunMarketplaceDemoSeed } from "./marketplace-seed-policy.js";

test("marketplace demo seed is never enabled in production", () => {
  assert.equal(shouldRunMarketplaceDemoSeed("production", "true"), false);
});

test("development and test require explicit demo-seed opt-in", () => {
  assert.equal(shouldRunMarketplaceDemoSeed("development", undefined), false);
  assert.equal(shouldRunMarketplaceDemoSeed("test", "false"), false);
  assert.equal(shouldRunMarketplaceDemoSeed("development", "true"), true);
  assert.equal(shouldRunMarketplaceDemoSeed("test", "true"), true);
});

test("unknown runtime environments fail closed", () => {
  assert.equal(shouldRunMarketplaceDemoSeed(undefined, "true"), false);
  assert.equal(shouldRunMarketplaceDemoSeed("staging", "true"), false);
});