import { useEffect, useRef, useState, type FormEvent } from "react";
import { useUser } from "@clerk/react";
import { LoaderCircle, Mail } from "lucide-react";
import { useSyncMyAccountEmail } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language";
import { normalizeOtpDigits } from "@/lib/signup-contact-flow";

type ClerkEmailError = {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
};

const errorStatus = (error: unknown) => (
  error && typeof error === "object" && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0
);

const clerkErrorCode = (error: unknown) => (
  (error as ClerkEmailError | null)?.errors?.[0]?.code || ""
);

export function AccountEmailLink({ initialEmail = "", autoSend = false, onComplete }: {
  initialEmail?: string;
  autoSend?: boolean;
  onComplete?: () => void;
} = {}) {
  const { user, isLoaded } = useUser();
  const { t, language, meta } = useLanguage();
  const syncEmail = useSyncMyAccountEmail();
  const [email, setEmail] = useState(initialEmail);
  const autoSent = useRef(false);
  const emailResource = useRef<NonNullable<typeof user>["emailAddresses"][number] | null>(null);
  const [code, setCode] = useState("");
  const [pendingEmailAddressId, setPendingEmailAddressId] = useState<string | null>(null);
  const [verifiedEmailAddressId, setVerifiedEmailAddressId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const syncVerifiedEmail = async (emailAddressId: string) => {
    if (!user) return;
    try {
      await user.update({ primaryEmailAddressId: emailAddressId });
      await user.reload();
      await syncEmail.mutateAsync();
      setComplete(true);
      setError("");
      onComplete?.();
    } catch {
      setError(t("emailLinkSyncError"));
    }
  };

  const sendVerificationCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!user || busy || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const normalizedEmail = email.trim();
      const pendingEmail = user.emailAddresses.find(
        (address) => address.emailAddress.toLowerCase() === normalizedEmail.toLowerCase()
          && address.verification?.status !== "verified",
      ) || (emailResource.current?.emailAddress.toLowerCase() === normalizedEmail.toLowerCase()
        ? emailResource.current : null);
      const address = pendingEmail || await user.createEmailAddress({ email: normalizedEmail });
      emailResource.current = address;
      await address.prepareVerification({ strategy: "email_code" });
      setPendingEmailAddressId(address.id);
      setCode("");
    } catch (caught) {
      const identifierExists = clerkErrorCode(caught).includes("identifier_exists");
      setError(identifierExists ? t("emailLinkDuplicate") : t("emailLinkError"));
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || busy || !pendingEmailAddressId) return;
    const pendingEmail = emailResource.current?.id === pendingEmailAddressId
      ? emailResource.current
      : user.emailAddresses.find((address) => address.id === pendingEmailAddressId);
    if (!pendingEmail) {
      setError(t("emailLinkError"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const verifiedAddress = await pendingEmail.attemptVerification({ code: normalizeOtpDigits(code.trim()) });
      if (verifiedAddress.verification?.status !== "verified") {
        setError(t("emailLinkCodeInvalid"));
        return;
      }
      setVerifiedEmailAddressId(verifiedAddress.id);
      await syncVerifiedEmail(verifiedAddress.id);
    } catch (caught) {
      const codeValue = clerkErrorCode(caught);
      setError(codeValue.includes("verification") || errorStatus(caught) === 400
        ? t("emailLinkCodeInvalid")
        : codeValue.includes("identifier_exists")
          ? t("emailLinkDuplicate")
          : t("emailLinkError"));
    } finally {
      setBusy(false);
    }
  };

  const retrySync = async () => {
    if (!verifiedEmailAddressId || busy) return;
    setBusy(true);
    await syncVerifiedEmail(verifiedEmailAddressId);
    setBusy(false);
  };

  useEffect(() => {
    if (!autoSend || !initialEmail || autoSent.current || !isLoaded || !user || user.primaryEmailAddress) return;
    autoSent.current = true;
    void sendVerificationCode();
  }, [autoSend, initialEmail, isLoaded, user]);

  if (!isLoaded || !user) return null;
  if (complete) {
    return (
      <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6" dir={meta[language].dir}>
        <p role="status" className="text-sm font-medium text-[hsl(var(--primary))]">{t("emailLinkVerified")}</p>
      </section>
    );
  }
  if (user.primaryEmailAddress?.emailAddress && !verifiedEmailAddressId) return null;

  const inputClass = "min-h-[48px] w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]";

  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_8px_24px_hsl(155_20%_18%/.04)] sm:p-6" dir={meta[language].dir}>
      <div className="mb-5 flex items-center gap-3 border-b border-[hsl(var(--border))] pb-5">
        <Mail size={18} className="text-[hsl(var(--primary))]" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-bold">{t("emailLinkTitle")}</h3>
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t("emailLinkDescription")}</p>
        </div>
      </div>

      {verifiedEmailAddressId ? (
        <div className="space-y-3">
          {error && <p role="alert" className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
          <button
            type="button"
            onClick={() => void retrySync()}
            disabled={busy}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="button-sync-linked-email"
          >
            {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {t("emailLinkVerify")}
          </button>
        </div>
      ) : pendingEmailAddressId ? (
        <form onSubmit={verifyEmailCode} className="space-y-3">
          <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t("emailLinkCodeSent")}</p>
          <label className="field-label">
            {t("verificationCode")}
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/[^0-9٠-٩۰-۹]/g, "").slice(0, 8));
                setError("");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              required
              className="field-input mt-2"
              data-testid="input-account-email-code"
            />
          </label>
          {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="button-verify-account-email"
            >
              {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {t("emailLinkVerify")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingEmailAddressId(null);
                setCode("");
                setError("");
              }}
              disabled={busy}
              className="min-h-[48px] rounded-xl border border-[hsl(var(--border))] px-4 text-sm font-semibold text-[hsl(var(--primary))] disabled:opacity-50"
            >
              {t("changeEmail")}
            </button>
          </div>
          <button type="button" disabled={busy} onClick={() => void sendVerificationCode()}
            className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-50"
            data-testid="button-resend-account-email-code">{t("resendCode")}</button>
        </form>
      ) : (
        <form onSubmit={sendVerificationCode} className="space-y-3">
          <label className="field-label">
            {t("emailLinkInputLabel")}
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              type="email"
              autoComplete="email"
              required
              className={`${inputClass} mt-2`}
              data-testid="input-account-email-link"
            />
          </label>
          {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="button-send-account-email-code"
          >
            {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {busy ? t("sending") : t("emailLinkSendCode")}
          </button>
        </form>
      )}
    </section>
  );
}
