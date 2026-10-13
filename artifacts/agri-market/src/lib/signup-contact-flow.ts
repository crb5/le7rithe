import { normalizeMauritaniaPhone } from "./mauritania-phone";

export const PENDING_SIGNUP_CONTACT_KEY = "le7rithe:pending-signup-contact:v1";
type ContactKind = "phone" | "email";
const lifetimeMs = 30 * 60_000;

export function signupReturnPath(search: string, key = "return_to"): string {
  const path = new URLSearchParams(search).get(key);
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export const normalizeOtpDigits = (value: string) => value
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

export function parsePendingSignupContact(raw: string | null, kind: ContactKind, now = Date.now()): string {
  if (!raw) return "";
  try {
    const draft = JSON.parse(raw);
    if (draft.kind !== kind || typeof draft.value !== "string"
      || typeof draft.createdAt !== "number" || draft.createdAt > now
      || now - draft.createdAt > lifetimeMs) return "";
    if (kind === "phone") return normalizeMauritaniaPhone(draft.value) || "";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.value) ? draft.value : "";
  } catch {
    return "";
  }
}

// This is only a short-lived form draft, never verification evidence.
export function savePendingSignupContact(kind: ContactKind, value: string): boolean {
  try {
    if (!value) window.sessionStorage.removeItem(PENDING_SIGNUP_CONTACT_KEY);
    else window.sessionStorage.setItem(PENDING_SIGNUP_CONTACT_KEY, JSON.stringify({
      kind, value, createdAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function readPendingSignupContact(kind: ContactKind): string {
  try {
    return parsePendingSignupContact(window.sessionStorage.getItem(PENDING_SIGNUP_CONTACT_KEY), kind);
  } catch {
    return "";
  }
}

export function clearPendingSignupContact(): void {
  try {
    window.sessionStorage.removeItem(PENDING_SIGNUP_CONTACT_KEY);
  } catch {
    // The draft expires and cannot authorize linking.
  }
}
