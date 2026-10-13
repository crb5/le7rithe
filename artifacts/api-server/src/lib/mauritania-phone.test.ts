import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invalidSupportPhoneField, normalizeListingPhones, normalizeMauritaniaPhone } from "./mauritania-phone";

describe("Mauritanian listing phone numbers", () => {
  it("normalizes local, international, punctuated, and Arabic-digit numbers", () => {
    assert.equal(normalizeMauritaniaPhone("36 12 34 56"), "+22236123456");
    assert.equal(normalizeMauritaniaPhone("+222 36-12-34-56"), "+22236123456");
    assert.equal(normalizeMauritaniaPhone("٠٠٢٢٢ ٣٦ ١٢ ٣٤ ٥٦"), "+22236123456");
    assert.equal(normalizeMauritaniaPhone("00222 (41) 22 33 44"), "+22241223344");
  });

  it("rejects numbers outside the Mauritanian mobile prefix and eight-digit format", () => {
    for (const prefix of ["0", "1", "5", "6", "7", "8", "9"]) {
      assert.equal(normalizeMauritaniaPhone(`${prefix}1234567`), null);
    }
    for (const prefix of ["2", "3", "4"]) {
      assert.equal(normalizeMauritaniaPhone(`${prefix}1234567`), `+222${prefix}1234567`);
    }
    assert.equal(normalizeMauritaniaPhone("+221 36 12 34 56"), null);
    assert.equal(normalizeMauritaniaPhone("36 12 34 5"), null);
    assert.equal(normalizeMauritaniaPhone("Call 36 12 34 56"), null);
  });

  it("validates both support phone fields while allowing them to remain blank", () => {
    assert.equal(invalidSupportPhoneField({ phone: "", whatsappPhone: "" }), null);
    assert.equal(invalidSupportPhoneField({ phone: "+222 36 12 34 56", whatsappPhone: "41-22-33-44" }), null);
    assert.equal(invalidSupportPhoneField({ phone: "05123456", whatsappPhone: "" }), "phone");
    assert.equal(invalidSupportPhoneField({ phone: "", whatsappPhone: "95123456" }), "whatsappPhone");
  });

  it("allows an unchanged legacy contact number without validating or rewriting it", () => {
    assert.deepEqual(
      normalizeListingPhones(
        { contactPhone: "legacy number" },
        { contactPhone: "legacy number", whatsappPhone: null },
      ),
      { ok: true, phones: {} },
    );
    assert.deepEqual(
      normalizeListingPhones(
        { contactPhone: "36 12 34 56" },
        { contactPhone: "legacy number", whatsappPhone: null },
      ),
      { ok: true, phones: { contactPhone: "+22236123456" } },
    );
    assert.deepEqual(
      normalizeListingPhones(
        { contactPhone: "a different invalid number" },
        { contactPhone: "legacy number", whatsappPhone: null },
      ),
      { ok: false, field: "contactPhone" },
    );
  });

  it("preserves omitted WhatsApp data, accepts clearing it, and validates changed numbers", () => {
    const existing = { contactPhone: "legacy number", whatsappPhone: "also legacy" };
    assert.deepEqual(normalizeListingPhones({}, existing), { ok: true, phones: {} });
    assert.deepEqual(normalizeListingPhones({ whatsappPhone: null }, existing), {
      ok: true,
      phones: { whatsappPhone: null },
    });
    assert.deepEqual(normalizeListingPhones({ whatsappPhone: "also legacy" }, existing), {
      ok: true,
      phones: {},
    });
    assert.deepEqual(normalizeListingPhones({ whatsappPhone: "+222 36 12 34 56" }, existing), {
      ok: true,
      phones: { whatsappPhone: "+22236123456" },
    });
    assert.deepEqual(normalizeListingPhones({ whatsappPhone: "12345" }, existing), {
      ok: false,
      field: "whatsappPhone",
    });
  });
});