import assert from "node:assert/strict";
import { test } from "node:test";
import { validateProductionFeatureFlags } from "./features";

test("production paid-listing flags must be valid and agree", () => {
  assert.doesNotThrow(() =>
    validateProductionFeatureFlags("production", undefined, undefined),
  );
  assert.doesNotThrow(() =>
    validateProductionFeatureFlags("production", "true", " true "),
  );
  assert.throws(
    () => validateProductionFeatureFlags("production", "true", "false"),
    /must match in production/,
  );
  assert.throws(
    () => validateProductionFeatureFlags("production", "yes", undefined),
    /must be either/,
  );
  assert.doesNotThrow(() =>
    validateProductionFeatureFlags("development", "invalid", undefined),
  );
});
