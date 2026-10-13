import { useEffect, useRef, useState, type FormEvent } from "react";
import { useClerk, useSignIn } from "@clerk/react";
import { createPortal } from "react-dom";
import { useSendPhoneCode, useVerifyPhoneCode } from "@workspace/api-client-react";
import { ArrowLeft, LoaderCircle, Phone, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { authCopyByLanguage } from "@/lib/clerkTheme";
import { getMauritaniaPhoneInputValue, normalizeMauritaniaPhone } from "@/lib/mauritania-phone";
import { clearPendingSignupContact, normalizeOtpDigits, savePendingSignupContact } from "@/lib/signup-contact-flow";
import { clearPendingLegalConsent, savePendingLegalConsent } from "@/lib/legal-consent-flow";
import { Link } from "wouter";

type PhoneSignInProps = {
  basePath: string;
  redirectPath: string;
  presentation?: "portal" | "standalone";
  flowMode?: "sign-in" | "sign-up";
  onBack?: () => void;
  initialPhone?: string;
  initialEmail?: string;
  autoSendPhoneCode?: boolean;
  initialName?: string;
};

const apiErrorMessage = (error: unknown): { status: number; retryAfterSeconds: number; code?: string } => {
  if (!error || typeof error !== "object") return { status: 0, retryAfterSeconds: 0 };
  const value = error as { data?: unknown; status?: unknown };
  const data = value.data && typeof value.data === "object"
    ? value.data as { retryAfterSeconds?: unknown; code?: unknown }
    : null;
  return {
    status: typeof value.status === "number" ? value.status : 0,
    code: typeof data?.code === "string" ? data.code : undefined,
    retryAfterSeconds: typeof data?.retryAfterSeconds === "number"
      ? Math.max(0, Math.ceil(data.retryAfterSeconds))
      : 0,
  };
};

export function PhoneSignIn({
  basePath,
  redirectPath,
  presentation = "portal",
  flowMode = "sign-in",
  onBack,
  initialPhone = "",
  initialEmail = "",
  autoSendPhoneCode = false,
  initialName = "",
}: PhoneSignInProps) {
  const { t, language, meta } = useLanguage();
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  const sendCode = useSendPhoneCode();
  const verifyCode = useVerifyPhoneCode();
  const [open, setOpen] = useState(presentation === "standalone");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [optionalEmail, setOptionalEmail] = useState(initialEmail);
  const autoSent = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (presentation !== "portal") return;

    const mountPhoneSignInSlot = () => {
      const socialButtons = document.querySelector<HTMLElement>(
        ".auth-page--sign-in .cl-socialButtons",
      );
      const googleButton = socialButtons?.querySelector<HTMLElement>(
        ".cl-socialButtonsBlockButton__google",
      );
      if (!socialButtons || !googleButton) return;

      let slot = socialButtons.querySelector<HTMLElement>(
        ":scope > [data-phone-sign-in-slot]",
      );
      if (!slot) {
        slot = document.createElement("div");
        slot.dataset.phoneSignInSlot = "true";
        googleButton.after(slot);
      }
      setPortalTarget((current) => (current === slot ? current : slot));
    };

    mountPhoneSignInSlot();
    const observer = new MutationObserver(mountPhoneSignInSlot);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document
        .querySelector(".auth-page--sign-in [data-phone-sign-in-slot]")
        ?.remove();
    };
  }, [presentation]);

  useEffect(() => {
    if (presentation !== "portal") return;

    const applyPhoneOnlyMode = () => {
      document
        .querySelector(".auth-page--sign-in .cl-cardBox")
        ?.classList.toggle("phone-sign-in-active", open);
    };

    applyPhoneOnlyMode();
    const observer = new MutationObserver(applyPhoneOnlyMode);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document
        .querySelector(".auth-page--sign-in .cl-cardBox")
        ?.classList.remove("phone-sign-in-active");
    };
  }, [open, presentation]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(
      () => setResendCountdown((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const normalizedPhone = normalizeMauritaniaPhone(phone);
  const resetFlow = () => {
    setOpen(false);
    setVerificationId(null);
    setCode("");
    setError("");
    setExistingAccount(false);
    setResendCountdown(0);
    setPassword("");
    setAccepted(false);
  };

  const goBack = () => {
    if (flowMode === "sign-up") clearPendingSignupContact();
    resetFlow();
    onBack?.();
  };

  const sendPhoneCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (flowMode === "sign-up" && (!name.trim() || !lastName.trim())) {
      setError(t("phoneSignupNamesRequired"));
      return;
    }
    if (flowMode === "sign-up" && password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (flowMode === "sign-up" && !accepted) {
      setError(t("consentRequired"));
      return;
    }
    if (!normalizedPhone) {
      setError(t("mauritaniaPhoneInvalid"));
      return;
    }
    if (flowMode === "sign-up" && !savePendingSignupContact("email", optionalEmail.trim())) {
      setError(t("consentStorageUnavailable"));
      return;
    }
    setBusy(true);
    setError("");
    setExistingAccount(false);
    try {
      const result = await sendCode.mutateAsync({ data: { phone: normalizedPhone, mode: flowMode } });
      setVerificationId(result.verificationId);
      setCode("");
      setResendCountdown(result.resendAfterSeconds);
    } catch (caught) {
      const failure = apiErrorMessage(caught);
      if (failure.retryAfterSeconds > 0) setResendCountdown(failure.retryAfterSeconds);
      setError(failure.status === 400
        ? t("mauritaniaPhoneInvalid")
        : failure.status === 429
          ? t("phoneLinkRateLimit")
          : t(flowMode === "sign-up" ? "phoneSignupError" : "phoneSignInError"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoSendPhoneCode || autoSent.current) return;
    autoSent.current = true;
    void sendPhoneCode();
  }, [autoSendPhoneCode]);

  const completePhoneSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !verificationId) return;
    if (!/^[0-9٠-٩۰-۹]{4,8}$/.test(code.trim())) {
      setError(t("phoneCodeInvalid"));
      return;
    }
    if (!signIn) {
      setError(t("phoneSignInError"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await verifyCode.mutateAsync({
        data: { verificationId, code: normalizeOtpDigits(code.trim()),
          ...(flowMode === "sign-up"
            ? { firstName: name.trim(), lastName: lastName.trim(), password }
            : {}) },
      });
      const ticketSignIn = await signIn.create({
        strategy: "ticket",
        ticket: result.ticket,
      });
      if (ticketSignIn.error || !signIn.createdSessionId) {
        throw new Error("Clerk ticket sign-in did not complete");
      }

      const safeReturnPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//")
        ? redirectPath
        : "/";
      const returnTarget = flowMode === "sign-up" && optionalEmail.trim()
        ? `/account/complete-signup-email?return_to=${encodeURIComponent(safeReturnPath)}`
        : safeReturnPath;
      const nextPath = result.requiresName
        ? `/account/complete-phone-profile?return_to=${encodeURIComponent(returnTarget)}`
        : returnTarget;
      if (flowMode === "sign-up" && !savePendingLegalConsent({ locale: language, redirectPath: nextPath })) {
        throw new Error("Could not retain signup consent");
      }
      const destination = `${basePath}${nextPath}`;
      await setActive({
        session: signIn.createdSessionId,
        redirectUrl: destination,
      });
    } catch (caught) {
      const failure = apiErrorMessage(caught);
      const registered = failure.code === "PHONE_ALREADY_REGISTERED";
      setExistingAccount(registered);
      if (failure.retryAfterSeconds > 0) setResendCountdown(failure.retryAfterSeconds);
      setError(registered ? t("phoneSignupExisting")
        : failure.code === "PASSWORD_REJECTED" ? t("phoneSignupPasswordRejected")
        : failure.code === "PASSWORD_REQUIRED" ? t("passwordTooShort")
        : failure.code === "NAME_REQUIRED" ? t("phoneSignupNamesRequired")
        : failure.status === 400
        ? t("phoneCodeRejected")
        : failure.status === 429
          ? t("phoneLinkRateLimit")
          : t(flowMode === "sign-up" ? "phoneSignupError" : "phoneSignInError"));
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <div className="w-full min-w-0" data-testid="phone-sign-in">
      {!open ? (
        <button
          type="button"
          dir={meta[language].dir}
          onClick={() => {
            setOpen(true);
            setError("");
          }}
          className="cl-socialButtonsBlockButton cl-button relative h-12 min-h-[48px] w-full rounded-xl border border-[#d9dfd7] !bg-white !text-[#173d32] hover:!bg-[#f8faf8]"
          style={{
            fontFamily: '"IBM Plex Sans Arabic", sans-serif',
            fontSize: "13px",
            fontWeight: 500,
          }}
          data-testid="button-phone-sign-in"
        >
          <span className="flex items-center justify-center gap-2">
            <Phone size={17} aria-hidden="true" />
            <span className="cl-socialButtonsBlockButtonText !text-[#173d32]">
              {authCopyByLanguage[language].continueWithPhone}
            </span>
          </span>
        </button>
      ) : (
        <div>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#173d32]">
                {t(flowMode === "sign-up" ? "phoneSignupTitle" : "phoneSignInTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#6f7f77]">
                {t(flowMode === "sign-up" ? "phoneSignupDescription" : "phoneSignInDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1f5948] hover:bg-[#f2f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5948]"
              data-testid={flowMode === "sign-up" ? "button-phone-sign-up-back" : "button-phone-sign-in-back"}
            >
              <ArrowLeft className={meta[language].dir === "rtl" ? "rotate-180" : undefined} size={14} aria-hidden="true" />
              {t("back")}
            </button>
          </div>

          {!verificationId ? (
            <form onSubmit={sendPhoneCode} className="space-y-3">
              {flowMode === "sign-up" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#173d32]">
                    {t("firstName")}
                    <input autoComplete="given-name" value={name} required maxLength={120}
                      onChange={(event) => { setName(event.target.value); setError(""); }}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-base text-[#173d32] outline-none focus:ring-2 focus:ring-[#1f5948]/20" data-testid="input-phone-signup-first-name" />
                  </label>
                  <label className="block text-xs font-semibold text-[#173d32]">
                    {t("lastName")}
                    <input autoComplete="family-name" value={lastName} required maxLength={120}
                      onChange={(event) => { setLastName(event.target.value); setError(""); }}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-base text-[#173d32] outline-none focus:ring-2 focus:ring-[#1f5948]/20" data-testid="input-phone-signup-last-name" />
                  </label>
                </div>
              )}
              <label className="block text-xs font-semibold text-[#173d32]" htmlFor="phone-sign-in-number">
                {t("phoneNumber")}
              </label>
              <div dir="ltr" className="flex min-h-[48px] overflow-hidden rounded-xl border border-[#d9dfd7] bg-white focus-within:ring-2 focus-within:ring-[#1f5948]">
                <span className="flex items-center border-r border-[#d9dfd7] bg-[#f8faf8] px-4 text-sm font-semibold text-[#52665c]" aria-label={t("mauritaniaCountryCode")}>
                  +222
                </span>
                <input
                  id="phone-sign-in-number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={24}
                  value={phone}
                  onChange={(event) => {
                    setPhone(getMauritaniaPhoneInputValue(event.target.value));
                    setError("");
                  }}
                  placeholder={t("phoneLocalNumberPlaceholder")}
                  aria-label={t("phoneNumber")}
                  aria-invalid={Boolean(error)}
                  className="min-w-0 flex-1 bg-transparent px-4 text-left text-base text-[#173d32] outline-none placeholder:text-[#9aa69f]"
                  data-testid="input-phone-sign-in-number"
                />
              </div>
              {flowMode === "sign-up" && (
                <label className="block text-xs font-semibold text-[#173d32]">
                  {t("signupEmailOptional")}
                  <input type="email" autoComplete="email" value={optionalEmail}
                    onChange={(event) => { setOptionalEmail(event.target.value); setError(""); }}
                    className="mt-2 min-h-[48px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-base text-[#173d32] outline-none focus:ring-2 focus:ring-[#1f5948]/20"
                    data-testid="input-phone-signup-email" />
                </label>
              )}
              {flowMode === "sign-up" && (
                <label className="block text-xs font-semibold text-[#173d32]">
                  {t("passwordMinLabel")}
                  <input type="password" autoComplete="new-password" value={password} required minLength={8} maxLength={128}
                    onChange={(event) => { setPassword(event.target.value); setError(""); }}
                    className="mt-2 min-h-[48px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-base text-[#173d32] outline-none focus:ring-2 focus:ring-[#1f5948]/20" data-testid="input-phone-signup-password" />
                </label>
              )}
              {flowMode === "sign-up" && (
                <div className="flex items-start gap-3 text-xs leading-5 text-[#43594f]">
                  <input id="phone-signup-consent" type="checkbox" checked={accepted} required
                    onChange={(event) => { setAccepted(event.target.checked); setError(""); }}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#1f5948]" data-testid="input-phone-signup-consent" />
                  <label htmlFor="phone-signup-consent">
                    {t("signupConsentPrefix")}
                    <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-normal text-[#1f5948] no-underline hover:underline underline-offset-2">{t("termsOfService")}</Link>
                    {t("signupConsentJoin")}
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-normal text-[#1f5948] no-underline hover:underline underline-offset-2">{t("privacyPolicy")}</Link>
                    {t("signupConsentSuffix")}
                  </label>
                </div>
              )}
              {error && <p role="alert" className="text-xs font-medium text-[#b94b3e]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1f5948] px-4 text-sm font-bold text-white transition-colors hover:bg-[#174536] disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="button-phone-sign-in-send-code"
              >
                {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                {busy ? t("sending") : t("phoneSignInSendCode")}
              </button>
            </form>
          ) : (
            <form onSubmit={completePhoneSignIn} className="space-y-3">
              <p className="rounded-xl bg-[#f4f7f4] px-3 py-2 text-xs leading-5 text-[#52665c]">
                {t("phoneCodeSentTo")} <span dir="ltr" className="font-semibold text-[#173d32]">{normalizedPhone}</span>
              </p>
              <label className="block text-xs font-semibold text-[#173d32]" htmlFor="phone-sign-in-code">
                {t("verificationCode")}
              </label>
              <input
                id="phone-sign-in-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/[^0-9٠-٩۰-۹]/g, "").slice(0, 8));
                  setError("");
                }}
                dir="ltr"
                aria-invalid={Boolean(error)}
                className="min-h-[48px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-left text-lg tracking-[0.25em] text-[#173d32] outline-none focus:border-[#1f5948] focus:ring-2 focus:ring-[#1f5948]/20"
                data-testid="input-phone-sign-in-code"
              />
              {error && <p role="alert" className="text-xs font-medium text-[#b94b3e]">{error}</p>}
              {existingAccount && (
                <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`}
                  onClick={() => { clearPendingSignupContact(); clearPendingLegalConsent(); }}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-[#d9dfd7] text-sm font-bold text-[#1f5948]"
                  data-testid="link-existing-phone-sign-in">{t("signIn")}</Link>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1f5948] px-4 text-sm font-bold text-white transition-colors hover:bg-[#174536] disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="button-phone-sign-in-verify"
              >
                {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                {busy ? t("signingIn") : t("verifyAndContinue")}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setVerificationId(null);
                    setCode("");
                    setError("");
                    setResendCountdown(0);
                  }}
                  disabled={busy}
                  className="text-xs font-semibold text-[#1f5948] underline-offset-4 hover:underline disabled:opacity-50"
                  data-testid="button-phone-sign-in-change-number"
                >
                  {t("changePhone")}
                </button>
                {resendCountdown > 0 ? (
                  <span role="status" className="text-xs text-[#6f7f77]">{t("phoneResendWait", { seconds: resendCountdown })}</span>
                ) : <button
                  type="button"
                  onClick={() => void sendPhoneCode()}
                  disabled={busy}
                  className="flex items-center gap-1 text-xs font-semibold text-[#1f5948] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="button-phone-sign-in-resend"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  {t("resendCode")}
                </button>}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );

  if (presentation === "standalone") return content;
  if (!portalTarget) return null;
  return createPortal(content, portalTarget);
}
