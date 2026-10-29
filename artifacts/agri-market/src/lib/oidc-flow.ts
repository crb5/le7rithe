/**
 * Headless driver for Authentik's Flow Executor API
 * (https://docs.goauthentik.io/add-secure-apps/flows-stages/flow/).
 *
 * Lets a fully custom login/registration form drive Authentik's
 * identification + password + enrollment stages over JSON, so Authentik's
 * own hosted page is never rendered. XHR calls go through the same-origin
 * `/authentik-api` proxy (see vite.config.ts and Caddyfile) so the session
 * cookie Authentik sets is first-party and reusable by the later OIDC
 * authorize redirect (see useSignInRedirect in lib/auth.tsx), which is what
 * lets that redirect complete silently with no Authentik UI in between.
 *
 * Any stage this driver doesn't recognize (e.g. an OTP/MFA stage) is left
 * for the caller to detect via `isFlowUnsupported` and fall back to the
 * normal hosted redirect rather than getting stuck.
 */

export const LOGIN_FLOW_SLUG =
  import.meta.env.VITE_OIDC_LOGIN_FLOW_SLUG || 'default-authentication-flow';
export const ENROLLMENT_FLOW_SLUG =
  import.meta.env.VITE_OIDC_ENROLLMENT_FLOW_SLUG || 'default-enrollment-flow';

const authentikOrigin = (() => {
  try {
    return new URL(import.meta.env.VITE_OIDC_ISSUER ?? '').origin;
  } catch {
    return '';
  }
})();

type FlowFieldError = { string: string; code: string };

export type PromptField = {
  field_key: string;
  label: string;
  type: string;
  /** Hint text for the empty input — not a default value (see initial_value). */
  placeholder?: string;
  initial_value?: string;
  required?: boolean;
};

export type FlowSource = {
  name: string;
  icon_url?: string;
  challenge?: { component?: string; to?: string };
};

export type FlowChallenge = {
  component: string;
  type?: 'native' | 'shell' | 'redirect';
  to?: string;
  response_errors?: Record<string, FlowFieldError[]>;
  user_fields?: string[];
  password_fields?: boolean;
  fields?: PromptField[];
  sources?: FlowSource[];
  [key: string]: unknown;
};

/**
 * The social-login button's destination, read straight off the live
 * identification challenge rather than guessed from a slug — Authentik's own
 * source name/slug can be (and here, is) anything. `returnPath` is where
 * Authentik sends the browser back to (our own sign-in/sign-up page) once the
 * provider round-trip finishes; from there, re-running the same flow finds an
 * already-authenticated Authentik session and resolves instantly.
 */
export function socialSourceUrl(challenge: FlowChallenge | null | undefined, returnPath: string): string | null {
  const sources = challenge?.sources ?? [];
  const source = sources.find((candidate) => candidate.icon_url?.includes('google')) ?? sources[0];
  const to = source?.challenge?.to;
  if (!to) return null;
  const url = new URL(to, authentikOrigin || window.location.origin);
  url.searchParams.set('next', returnPath);
  return url.toString();
}

export class FlowExecutorError extends Error {}

async function callFlow(slug: string, body?: Record<string, unknown>): Promise<FlowChallenge> {
  let response: Response;
  try {
    response = await fetch(`/authentik-api/api/v3/flows/executor/${slug}/`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new FlowExecutorError('The sign-in service could not be reached.', { cause });
  }
  // Authentik returns 400 with response_errors for an invalid stage submission;
  // that is a normal part of the flow, not a transport failure.
  if (!response.ok && response.status !== 400) {
    throw new FlowExecutorError(`Sign-in service error (${response.status}).`);
  }
  try {
    return (await response.json()) as FlowChallenge;
  } catch (cause) {
    throw new FlowExecutorError('The sign-in service returned an unexpected response.', { cause });
  }
}

// Stages that normally need no user input (the account was just written /
// logged in server-side) — advanced transparently rather than surfaced to the
// caller as an "unsupported" stage.
const AUTO_CONTINUE_COMPONENTS = new Set(['ak-stage-user-write', 'ak-stage-user-login']);
const MAX_AUTO_CONTINUE_STEPS = 5;

async function advance(challenge: FlowChallenge, slug: string): Promise<FlowChallenge> {
  let current = challenge;
  for (let i = 0; i < MAX_AUTO_CONTINUE_STEPS; i += 1) {
    if (isFlowSuccess(current) || isFlowDenied(current)) return current;
    if (!AUTO_CONTINUE_COMPONENTS.has(current.component)) return current;
    current = await callFlow(slug, {});
  }
  return current;
}

/** Starts a flow and transparently advances past any no-input stages. */
export async function startFlow(slug: string): Promise<FlowChallenge> {
  return advance(await callFlow(slug), slug);
}

/** Submits a stage's answer and transparently advances past any no-input stages. */
export async function submitFlow(slug: string, body: Record<string, unknown>): Promise<FlowChallenge> {
  return advance(await callFlow(slug, body), slug);
}

export function flowFieldError(challenge: FlowChallenge | null | undefined, field: string): string | null {
  return challenge?.response_errors?.[field]?.[0]?.string ?? null;
}

export function flowNonFieldError(challenge: FlowChallenge | null | undefined): string | null {
  return (
    flowFieldError(challenge, 'non_field_errors') ??
    flowFieldError(challenge, '__all__') ??
    null
  );
}

export function isFlowSuccess(challenge: FlowChallenge | null | undefined): boolean {
  // Confirmed live: a completed flow responds with component "xak-flow-redirect"
  // (not the `type: "redirect"` shape the docs lead with) — checking for both.
  return challenge?.type === 'redirect' || challenge?.component === 'xak-flow-redirect';
}

export function isFlowDenied(challenge: FlowChallenge | null | undefined): boolean {
  return challenge?.component === 'ak-stage-access-denied';
}

const KNOWN_COMPONENTS = new Set(['ak-stage-identification', 'ak-stage-password', 'ak-stage-prompt']);

/** A stage this driver has no custom form for (e.g. OTP/MFA/email verification). */
export function isFlowUnsupported(challenge: FlowChallenge | null | undefined): boolean {
  if (!challenge) return false;
  if (isFlowSuccess(challenge) || isFlowDenied(challenge)) return false;
  return !KNOWN_COMPONENTS.has(challenge.component);
}
