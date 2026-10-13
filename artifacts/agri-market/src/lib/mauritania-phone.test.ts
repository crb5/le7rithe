import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMauritaniaPhoneInputValue, hasAllowedMauritaniaPhonePrefix, normalizeMauritaniaPhone } from "./mauritania-phone";

describe("Mauritanian phone form values", () => {
  it("accepts local, country-prefixed, and Arabic-digit numbers", () => {
    assert.equal(normalizeMauritaniaPhone("36 12 34 56"), "+22236123456");
    assert.equal(normalizeMauritaniaPhone("+222 36-12-34-56"), "+22236123456");
    assert.equal(normalizeMauritaniaPhone("٠٠٢٢٢ ٣٦ ١٢ ٣٤ ٥٦"), "+22236123456");
  });

  it("shows a validated saved number without duplicating the fixed country prefix", () => {
    assert.equal(getMauritaniaPhoneInputValue("+222 36 12 34 56"), "36123456");
    assert.equal(getMauritaniaPhoneInputValue("legacy number"), "legacy number");
  });

  it("rejects invalid Mauritanian numbers", () => {
    for (const prefix of ["0", "1", "5", "6", "7", "8", "9"]) {
      assert.equal(normalizeMauritaniaPhone(`${prefix}1234567`), null);
    }
    for (const prefix of ["2", "3", "4"]) {
      assert.equal(normalizeMauritaniaPhone(`${prefix}1234567`), `+222${prefix}1234567`);
    }
    assert.equal(normalizeMauritaniaPhone("3612345"), null);
    assert.equal(normalizeMauritaniaPhone("Call 36 12 34 56"), null);
  });

  it("blocks invalid first national digits while allowing partial country prefixes", () => {
    for (const prefix of ["0", "1", "5", "6", "7", "8", "9"]) {
      assert.equal(hasAllowedMauritaniaPhonePrefix(`${prefix}1234567`), false);
    }
    for (const prefix of ["2", "3", "4"]) {
      assert.equal(hasAllowedMauritaniaPhonePrefix(`${prefix}1234567`), true);
    }
    for (const value of ["", "+", "+2", "+22", "+222", "00", "0022", "00222", "+222 3", "٠٠٢٢٢ ٤"]) {
      assert.equal(hasAllowedMauritaniaPhonePrefix(value), true);
    }
    for (const value of ["+222 8", "00222 8", "+221 36", "081234567"]) {
      assert.equal(hasAllowedMauritaniaPhonePrefix(value), false);
    }
  });
});