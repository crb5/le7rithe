import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SALE_REVERT_WINDOW_MS, canRevertSale, saleRevertUntil } from "./listing-sale";

describe("listing sale reversal window", () => {
  const soldAt = new Date("2026-09-11T10:00:00.000Z");

  it("ends exactly five minutes after the sale", () => {
    assert.equal(SALE_REVERT_WINDOW_MS, 5 * 60 * 1000);
    assert.equal(saleRevertUntil(soldAt).toISOString(), "2026-09-11T10:05:00.000Z");
    assert.equal(
      canRevertSale(soldAt, new Date("2026-09-11T10:04:59.999Z")),
      true,
    );
    assert.equal(
      canRevertSale(soldAt, new Date("2026-09-11T10:05:00.000Z")),
      false,
    );
    assert.equal(
      canRevertSale(soldAt, new Date("2026-09-11T10:05:00.001Z")),
      false,
    );
  });
});