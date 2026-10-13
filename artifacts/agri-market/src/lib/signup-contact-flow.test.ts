import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOtpDigits, parsePendingSignupContact, signupReturnPath } from "./signup-contact-flow";

const now = 1_000_000_000;
const draft = (kind: string, value: string, createdAt = now) => JSON.stringify({ kind, value, createdAt });

test("signup drafts preserve only the requested optional contact, not verification", () => {
  assert.equal(parsePendingSignupContact(draft("phone", "36 12 34 56"), "phone", now), "+22236123456");
  assert.equal(parsePendingSignupContact(draft("email", "example@example.com"), "email", now), "example@example.com");
  assert.equal(parsePendingSignupContact(draft("email", "example@example.com"), "phone", now), "");
  assert.equal(parsePendingSignupContact(draft("phone", "+22236123456"), "email", now), "");
});

test("invalid, stale and future drafts cannot continue a signup contact flow", () => {
  for (const raw of [null, "", "{", "null", draft("phone", "123"), draft("phone", "+22336123456"),
    draft("phone", "+22236123456", now - 31 * 60_000), draft("phone", "+22236123456", now + 1)]) {
    assert.equal(parsePendingSignupContact(raw, "phone", now), "");
  }
  assert.equal(parsePendingSignupContact(draft("email", "not-an-email"), "email", now), "");
});

test("verification codes normalize Arabic and Persian numerals without changing the proof", () => {
  assert.equal(normalizeOtpDigits("١٢٣۴۵۶"), "123456");
});

test("contact completion preserves the search return path and nested name-completion destination", () => {
  assert.equal(signupReturnPath("return_to=/listings"), "/listings");
  assert.equal(signupReturnPath("?return_to=%2Flistings"), "/listings");
  const emailStep = "/account/complete-signup-email?return_to=%2Flistings";
  assert.equal(signupReturnPath(`return_to=${encodeURIComponent(emailStep)}`), emailStep);
  assert.equal(signupReturnPath("redirect_url=%2Fadd-listing", "redirect_url"), "/add-listing");
  for (const query of ["", "return_to=https%3A%2F%2Fexample.com", "return_to=%2F%2Fexample.com"]) {
    assert.equal(signupReturnPath(query), "/");
  }
});
