import assert from "node:assert/strict";
import { test } from "node:test";
import { trustProxyHops } from "./proxy-trust";

test("proxy trust defaults to the verified preview depth and accepts 0 through 5", () => {
  assert.equal(trustProxyHops(undefined), 3);
  assert.equal(trustProxyHops("0"), 0);
  assert.equal(trustProxyHops("3"), 3);
  assert.equal(trustProxyHops("5"), 5);
});

test("proxy trust rejects invalid or out-of-range values", () => {
  for (const value of ["", "-1", "6", "1.5", "1e2", "true", "  "]) {
    assert.throws(() => trustProxyHops(value), /integer from 0 to 5/);
  }
});
