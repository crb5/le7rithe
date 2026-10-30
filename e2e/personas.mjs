// Shared test-persona credentials, used by both setup-auth.mjs (to
// provision/sign in the accounts) and the e2e specs (to sign in with the
// same accounts). Keeping this in one place means they can't drift apart.

// A fixed, clearly-synthetic default password — only used against disposable
// test-environment Authentik accounts, never production. Override via env if
// your test environment enforces a stronger password policy.
const DEFAULT_TEST_PASSWORD = 'E2e-Test-Passw0rd!2026';

/**
 * @param {string} prefix
 * @param {{ name: string, email: string, role?: string }} defaults
 */
function persona(prefix, { name, email, role }) {
  return {
    username: process.env[`E2E_${prefix}_USERNAME`] ?? `e2e-${prefix.toLowerCase().replace(/_/g, '-')}`,
    password: process.env[`E2E_${prefix}_PASSWORD`] ?? DEFAULT_TEST_PASSWORD,
    email: process.env[`E2E_${prefix}_EMAIL`] ?? email,
    name,
    role,
  };
}

export const seller = persona('SELLER', { name: 'E2E Seller', email: 'e2e-seller@example.com' });
export const secondSeller = persona('SECOND_SELLER', { name: 'E2E Second Seller', email: 'e2e-second-seller@example.com' });
// This account only actually becomes an admin if its email is listed in the
// target server's ADMIN_ALLOWED_EMAILS — an external precondition this
// module can't set (see provisionLocalAccount on the backend).
export const admin = persona('ADMIN', { name: 'E2E Admin', email: 'e2e-admin@example.com', role: 'admin' });
// Moderator has no self-service promotion path (no admin API grants it, by
// design — it's a deliberate manual elevation). Signing in/up only gets an
// ordinary user account; granting the moderator role is a one-time manual
// step the test environment operator must do directly.
export const moderator = persona('MODERATOR', { name: 'E2E Moderator', email: 'e2e-moderator@example.com', role: 'moderator' });
export const secondaryAdmin = persona('SECONDARY_ADMIN', { name: 'E2E Secondary Admin', email: 'e2e-secondary-admin@example.com', role: 'admin' });
