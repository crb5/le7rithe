import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Phone, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  getGetMyAccountProfileQueryKey,
  useGetMyAccountProfile,
  useSendPhoneVerification,
  useVerifyPhoneNumber,
} from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/lib/language";
import { getMauritaniaPhoneInputValue, normalizeMauritaniaPhone } from "@/lib/mauritania-phone";
import { clearPendingSignupContact, normalizeOtpDigits, readPendingSignupContact, signupReturnPath } from "@/lib/signup-contact-flow";

const responseStatus = (error: unknown) => (
  error && typeof error === "object" && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0
);

export function PhoneLinkAfterSignup() {
  const { t, language, meta } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const profileQuery = useGetMyAccountProfile();
  const sendCode = useSendPhoneVerification();
  const verifyCode = useVerifyPhoneNumber();
  const [draftPhone] = useState(() => readPendingSignupContact("phone"));
  const [phone, setPhone] = useState(() => draftPhone ? draftPhone.slice(4) : "");
  const autoSent = useRef(false);
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");

  const normalizedPhone = normalizeMauritaniaPhone(phone);
  const returnPath = signupReturnPath(search);

  useEffect(() => {
    if (countdown <= 0) return;
    const timeout = window.setTimeout(() => {
      setCountdown((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [countdown]);

  const continueToMarket = () => {
    clearPendingSignupContact();
    setLocation(returnPath, { replace: true });
  };

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (!normalizedPhone) {
      setError(t("mauritaniaPhoneInvalid"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await sendCode.mutateAsync({ data: { phone: normalizedPhone } });
      setVerificationId(result.verificationId);
      setCode("");
      setCountdown(result.resendAfterSeconds);
    } catch (caught) {
      const status = responseStatus(caught);
      setError(status === 409 ? t("phoneLinkDuplicateError")
        : status === 429 ? t("phoneLinkRateLimit") : t("phoneLinkError"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!draftPhone || autoSent.current || !profileQuery.isSuccess) return;
    autoSent.current = true;
    if (profileQuery.data.phoneVerified && profileQuery.data.phone === draftPhone) return;
    void requestCode();
  }, [draftPhone, profileQuery.isSuccess, profileQuery.data]);

  const verifyPhone = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !verificationId) return;
    if (!/^[0-9٠-٩۰-۹]{4,8}$/.test(code.trim())) {
      setError(t("phoneCodeInvalid"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await verifyCode.mutateAsync({
        data: { verificationId, code: normalizeOtpDigits(code.trim()) },
      });
      await queryClient.invalidateQueries({ queryKey: getGetMyAccountProfileQueryKey() });
      setLinked(true);
      clearPendingSignupContact();
      setVerificationId(null);
      setCode("");
      setCountdown(0);
    } catch (caught) {
      const status = responseStatus(caught);
      setError(status === 409
        ? t("phoneLinkDuplicateError")
        : status === 400
          ? t("phoneCodeInvalid")
          : status === 429
            ? t("phoneLinkRateLimit")
            : t("phoneLinkError"));
    } finally {
      setBusy(false);
    }
  };

  const alreadyLinked = linked || Boolean(profileQuery.data?.phoneVerified
    && (!draftPhone || profileQuery.data.phone === draftPhone));

  return (
    <main className="min-h-[min(100dvh,900px)] px-4 py-8 sm:py-12" dir={meta[language].dir}>
      <section className="mx-auto w-full max-w-[28rem] rounded-[20px] border border-[#e4e9e5] bg-white p-5 shadow-[0_12px_32px_rgba(23,61,50,0.08)] sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff5f0] text-[#1f5948]">
            <Phone size={19} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#173d32]">{t("phoneLinkAfterSignupTitle")}</h1>
            <p className="mt-1 text-sm leading-6 text-[#6f7f77]">{t("phoneLinkAfterSignupDescription")}</p>
          </div>
        </div>

        {profileQuery.isLoading ? (
          <div className="flex min-h-16 items-center justify-center">
            <Spinner />
          </div>
        ) : profileQuery.isError ? (
          <div>
            <p role="alert" className="text-sm text-[#b94b3e]">{t("phoneLinkError")}</p>
            <button
              type="button"
              onClick={() => void profileQuery.refetch()}
              className="mt-3 text-sm font-semibold text-[#1f5948] underline-offset-4 hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : alreadyLinked ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-[#f1f7f1] px-4 py-3 text-sm font-medium text-[#1f5948]">
              {t("phoneVerified")}
            </p>
            <button
              type="button"
              onClick={continueToMarket}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1f5948] px-4 text-sm font-bold text-white hover:bg-[#174536]"
              data-testid="button-continue-after-phone-link"
            >
              {t("continue")}
            </button>
          </div>
        ) : verificationId ? (
          <form onSubmit={verifyPhone} className="space-y-3">
            <p className="rounded-xl bg-[#f4f7f4] px-3 py-2 text-xs leading-5 text-[#52665c]">
              {t("phoneCodeSentTo")} <span dir="ltr" className="font-semibold text-[#173d32]">{normalizedPhone}</span>
            </p>
            <label className="block text-xs font-semibold text-[#173d32]" htmlFor="signup-phone-code">
              {t("verificationCode")}
            </label>
            <input
              id="signup-phone-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/[^0-9٠-٩۰-۹]/g, "").slice(0, 8));
                setError("");
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              className="min-h-[52px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-left text-lg tracking-[0.25em] text-[#173d32] outline-none focus:border-[#1f5948] focus:ring-2 focus:ring-[#1f5948]/20"
              data-testid="input-signup-phone-code"
            />
            {error && <p role="alert" className="text-xs font-medium text-[#b94b3e]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1f5948] px-4 text-sm font-bold text-white hover:bg-[#174536] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="button-verify-signup-phone"
            >
              {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {busy ? t("sending") : t("verifyAndContinue")}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setVerificationId(null);
                  setCode("");
                  setError("");
                  setCountdown(0);
                }}
                disabled={busy}
                className="text-xs font-semibold text-[#1f5948] underline-offset-4 hover:underline disabled:opacity-50"
              >
                {t("changePhone")}
              </button>
              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={busy || countdown > 0}
                className="flex items-center gap-1 text-xs font-semibold text-[#1f5948] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {countdown > 0 ? t("phoneResendWait", { seconds: countdown }) : t("resendCode")}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={requestCode} className="space-y-3">
            <label className="block text-xs font-semibold text-[#173d32]" htmlFor="signup-phone-number">
              {t("phoneNumber")}
            </label>
            <div dir="ltr" className="flex min-h-[52px] overflow-hidden rounded-xl border border-[#d9dfd7] bg-white focus-within:ring-2 focus-within:ring-[#1f5948]">
              <span className="flex items-center border-r border-[#d9dfd7] bg-[#f8faf8] px-4 text-sm font-semibold text-[#52665c]" aria-label={t("mauritaniaCountryCode")}>
                +222
              </span>
              <input
                id="signup-phone-number"
                value={phone}
                onChange={(event) => {
                  setPhone(getMauritaniaPhoneInputValue(event.target.value));
                  setError("");
                }}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={24}
                placeholder={t("phoneLocalNumberPlaceholder")}
                aria-label={t("phoneNumber")}
                aria-invalid={Boolean(error)}
                className="min-w-0 flex-1 bg-transparent px-4 text-left text-base text-[#173d32] outline-none placeholder:text-[#9aa69f]"
                data-testid="input-signup-phone-number"
              />
            </div>
            {error && <p role="alert" className="text-xs font-medium text-[#b94b3e]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1f5948] px-4 text-sm font-bold text-white hover:bg-[#174536] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="button-send-signup-phone-code"
            >
              {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {busy ? t("sending") : t("phoneSignInSendCode")}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={continueToMarket}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d9dfd7] px-4 text-sm font-semibold text-[#1f5948] hover:bg-[#f8faf8]"
          data-testid="button-skip-phone-link"
        >
          {t("skipPhoneLink")}
        </button>
      </section>
    </main>
  );
}
