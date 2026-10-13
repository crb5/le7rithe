import { useState, type FormEvent } from 'react';
import { AuthenticateWithRedirectCallback, useSignUp } from '@clerk/react';
import { ArrowLeft, Eye, EyeOff, Loader2, Phone } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/language';
import { clearPendingLegalConsent, savePendingLegalConsent } from '@/lib/legal-consent-flow';
import { PhoneSignIn } from '@/components/phone-sign-in';
import { getMauritaniaPhoneInputValue, normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { clearPendingSignupContact, savePendingSignupContact } from '@/lib/signup-contact-flow';
import { authCopyByLanguage, authCardClass, authInputClass, authOutlineButtonClass } from '@/lib/clerkTheme';
import { AuthAttribution } from '@/components/auth-attribution';

type ClerkError = { errors?: Array<{ longMessage?: string; message?: string }> };

function errorMessage(error: unknown, fallback: string) {
  const clerkError = error as ClerkError;
  return clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || fallback;
}

export function RequiredNameSignUp({ basePath, redirectPath = '/' }: { basePath: string; redirectPath?: string }) {
  const { signUp, fetchStatus } = useSignUp();
  const { language, t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [autoSendPhone, setAutoSendPhone] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneSignupOpen, setPhoneSignupOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState('');
  const safeReturnPath = redirectPath.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : '/';
  const afterSignupPhonePath = `/account/complete-signup-phone?return_to=${encodeURIComponent(safeReturnPath)}`;

  if (window.location.pathname.includes('/sign-up/sso-callback')) {
    return <AuthenticateWithRedirectCallback />;
  }

  const validateNames = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('signUpNameRequired'));
      return false;
    }
    return true;
  };

  const handleEmailSignUp = async (event: FormEvent) => {
    event.preventDefault();
    if (!signUp) return;
    const phoneOnly = !emailAddress.trim() && Boolean(phoneNumber.trim());
    if (phoneOnly && !firstName.trim()) {
      setError(t('phoneSignupNameRequired'));
      return;
    }
    if (!phoneOnly && !validateNames()) return;
    const normalizedPhone = phoneNumber.trim() ? normalizeMauritaniaPhone(phoneNumber) : null;
    if (!emailAddress.trim() && !phoneNumber.trim()) {
      setError(t('signupContactRequired'));
      return;
    }
    if (phoneNumber.trim() && !normalizedPhone) {
      setError(t('mauritaniaPhoneInvalid'));
      return;
    }
    if (!hasAcceptedPolicies) {
      setError(t('consentRequired'));
      return;
    }
    if (!emailAddress.trim()) {
      if (!savePendingLegalConsent({ locale: language, redirectPath: safeReturnPath })) {
        setError(t('consentStorageUnavailable'));
        return;
      }
      clearPendingSignupContact();
      setError('');
      setAutoSendPhone(true);
      setPhoneSignupOpen(true);
      return;
    }
    if (!savePendingSignupContact('phone', normalizedPhone || '')
      || !savePendingLegalConsent({ locale: language, redirectPath: normalizedPhone ? afterSignupPhonePath : safeReturnPath })) {
      setError(t('consentStorageUnavailable'));
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const { error: signUpError } = await signUp.password({
        emailAddress: emailAddress.trim(),
        password,
        unsafeMetadata: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
      });
      if (signUpError) throw signUpError;
      const { error: verificationError } = await signUp.verifications.sendEmailCode();
      if (verificationError) throw verificationError;
      setIsVerifying(true);
    } catch (caught) {
      clearPendingLegalConsent();
      clearPendingSignupContact();
      setError(errorMessage(caught, t('signUpError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerification = async (event: FormEvent) => {
    event.preventDefault();
    if (!signUp) return;
    setError('');
    setIsSubmitting(true);
    try {
      const { error: verificationError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (verificationError) throw verificationError;
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) throw finalizeError;
    } catch (caught) {
      setError(errorMessage(caught, t('signUpVerificationError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!signUp || isSubmitting) return;
    if (!savePendingLegalConsent({ locale: language, redirectPath: safeReturnPath })) {
      setError(t('consentStorageUnavailable'));
      return;
    }
    clearPendingSignupContact();
    setError('');
    setIsSubmitting(true);
    try {
      const { error: ssoError } = await signUp.sso({
        strategy: 'oauth_google',
        redirectUrl: `${basePath}${safeReturnPath}`,
        redirectCallbackUrl: `${basePath}/sign-up/sso-callback`,
      });
      if (ssoError) throw ssoError;
    } catch (caught) {
      clearPendingLegalConsent();
      setError(errorMessage(caught, t('signUpError')));
      setIsSubmitting(false);
    }
  };

  const handlePhoneSignUp = () => {
    setError('');
    clearPendingSignupContact();
    setAutoSendPhone(false);
    setPhoneSignupOpen(true);
  };

  const copy = authCopyByLanguage[language];
  const inputClass = authInputClass;
  const labelClass = 'mb-2 block text-sm font-semibold text-[#173d32]';

  if (phoneSignupOpen) {
    return (
      <section className={authCardClass}>
        <PhoneSignIn
          basePath={basePath}
          redirectPath={safeReturnPath}
          presentation="standalone"
          flowMode="sign-up"
          initialPhone={phoneNumber}
          initialName={firstName}
          initialEmail={emailAddress}
          autoSendPhoneCode={autoSendPhone}
          onBack={() => { setPhoneSignupOpen(false); setEmailOpen(false); }}
        />
        <AuthAttribution />
      </section>
    );
  }

  if (!emailOpen) {
    return (
      <section className={authCardClass} data-testid="sign-up-choice">
        <h1 className="text-center text-[25px] font-bold leading-8 tracking-tight text-[#173d32]">{t('createAccount')}</h1>
        <p className="mt-1.5 text-center text-sm leading-6 text-[#6f7f77]" data-testid="text-sign-up-subtitle">{copy.signUpSubtitle}</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-[#f0c6bf] bg-[#fff6f3] px-4 py-3 text-sm leading-6 text-[#b94b3e]">{error}</div>}
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" onClick={handleGoogleSignUp} disabled={isSubmitting} className={authOutlineButtonClass} data-testid="button-choice-google-sign-up">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 0 1 13 31.5l-6.4 5A20 20 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
              <path fill="#34A853" d="M24 44c5.4 0 10.1-2.1 13.5-5.6l-6.2-5.2A12 12 0 0 1 13 31.5l-6.4 5A20 20 0 0 0 24 44Z" />
              <path fill="#FBBC05" d="M13 31.5a12 12 0 0 1 0-15l-6.4-5a20 20 0 0 0 0 25Z" />
              <path fill="#EA4335" d="M24 12c3.1 0 5.9 1.1 8.1 3.2l5.7-5.7A19.8 19.8 0 0 0 24 4 20 20 0 0 0 6.6 11.5l6.4 5A12 12 0 0 1 24 12Z" />
            </svg>
            {copy.continueWithGoogle}
          </button>
          <button
            type="button"
            onClick={handlePhoneSignUp}
            disabled={isSubmitting || fetchStatus === 'fetching'}
            className={authOutlineButtonClass}
            data-testid="button-choice-phone-sign-up"
          >
            <Phone size={18} aria-hidden="true" />
            {copy.continueWithPhone}
          </button>
        </div>
        <div className="my-3 flex items-center gap-3 text-xs text-[#6f7f77]"><span className="h-px flex-1 bg-[#e4e9e5]" /><span>{t('or')}</span><span className="h-px flex-1 bg-[#e4e9e5]" /></div>
        <div className="flex flex-col gap-3">
          <label htmlFor="signup-choice-email" className="text-sm font-semibold text-[#173d32]">{copy.continueWithEmail}</label>
          <input id="signup-choice-email" type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} className={authInputClass} autoComplete="email" placeholder={t('emailAddress')} data-testid="input-choice-email" />
          <button type="button" onClick={() => { setError(''); setEmailOpen(true); }} className="auth-continue-button flex min-h-[48px] h-12 w-full items-center justify-center gap-[10px] rounded-xl bg-[#1f5948] px-4 text-base font-bold text-white transition-colors hover:bg-[#174536] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9b949]" data-testid="button-choice-email-sign-up">{t('continue')}</button>
        </div>
          <p className="mt-3 text-center text-xs leading-5 text-[#6f7f77]" data-testid="text-google-consent-notice">
            {t('googleConsentNotice')}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-normal text-[#1f5948] no-underline hover:underline underline-offset-2">{t('termsOfService')}</Link>
            {t('signupConsentJoin')}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-normal text-[#1f5948] no-underline hover:underline underline-offset-2">{t('privacyPolicy')}</Link>
            {t('signupConsentSuffix')}
          </p>
        <div id="clerk-captcha" data-cl-theme="light" data-cl-size="flexible" data-cl-language={language} />
        <p className="mt-4 text-center text-sm leading-6 text-[#6f7f77]">
          {t('alreadyHaveAccount')}{' '}
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`} className="inline-flex min-h-11 items-center font-bold text-[#1f5948] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9b949]" data-testid="link-choice-sign-in">
            {t('signIn')}
          </Link>
        </p>
        <AuthAttribution />
      </section>
    );
  }

  return (
    <section className={authCardClass} data-testid="custom-sign-up">
      <button type="button" disabled={isSubmitting} onClick={() => {
        setEmailOpen(false);
        setIsVerifying(false);
        setFirstName('');
        setLastName('');
        setEmailAddress('');
        setPhoneNumber('');
        setAutoSendPhone(false);
        setShowPassword(false);
        setCode('');
        setPassword('');
        setError('');
        setHasAcceptedPolicies(false);
        clearPendingSignupContact();
        clearPendingLegalConsent();
      }} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1f5948] disabled:opacity-60" data-testid="button-email-sign-up-back">
        <ArrowLeft size={16} aria-hidden="true" className={language === 'ar' ? 'rotate-180' : ''} />
        {t('back')}
      </button>
      <h1 className="text-center text-[25px] font-bold leading-8 tracking-tight text-[#173d32]">{isVerifying ? t('verifyEmailTitle') : t('createAccount')}</h1>
      <p className="mt-1.5 text-center text-sm leading-6 text-[#6f7f77]">{isVerifying ? t('verifyEmailDescription') : t('createAccountDescription')}</p>

      {error && <div role="alert" className="mt-5 rounded-xl border border-[#f0c6bf] bg-[#fff6f3] px-4 py-3 text-sm leading-6 text-[#b94b3e]">{error}</div>}

      {isVerifying ? (
        <form onSubmit={handleVerification} className="mt-6 flex flex-col gap-3">
          <label>
            <span className={labelClass}>{t('verificationCode')}</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} inputMode="numeric" autoComplete="one-time-code" required data-testid="input-verification-code" />
          </label>
          <button type="submit" disabled={isSubmitting} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1f5948] px-4 text-base font-bold text-white transition-colors hover:bg-[#174536] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e9b949]/70 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-verify-email">
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}{t('verifyAndContinue')}
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleEmailSignUp} className="mt-6 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>{t('firstName')}</span>
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} autoComplete="given-name" required data-testid="input-first-name" />
              </label>
              <label>
                <span className={labelClass}>{t('lastName')}</span>
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} autoComplete="family-name" required={Boolean(emailAddress.trim())} data-testid="input-last-name" />
              </label>
            </div>
            <label>
              <span className={labelClass}>{t('emailAddress')}</span>
              <input type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} className={inputClass} autoComplete="email" data-testid="input-sign-up-email" />
            </label>
            <label>
              <span className={labelClass}>{t('signupPhoneOptional')}</span>
              <span dir="ltr" className="flex min-h-[48px] overflow-hidden rounded-xl border border-[#d9dfd7] bg-white focus-within:ring-4 focus-within:ring-[#1f5948]/10">
                <span className="flex items-center border-r border-[#d9dfd7] bg-[#f8faf8] px-4 text-sm font-semibold text-[#52665c]">+222</span>
                <input type="tel" inputMode="numeric" autoComplete="tel-national" value={phoneNumber}
                  onChange={(event) => { setPhoneNumber(getMauritaniaPhoneInputValue(event.target.value)); setError(''); }}
                  placeholder={t('phoneLocalNumberPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent px-3.5 text-left text-base text-[#173d32] outline-none"
                  data-testid="input-sign-up-phone" />
              </span>
            </label>
            <p className="text-xs leading-5 text-[#6f7f77]">{t('signupContactHint')}</p>
            <label>
              <span className={labelClass}>{t('password')}</span>
              <span className="relative block">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} pe-11`} autoComplete="new-password" required={Boolean(emailAddress.trim())} minLength={emailAddress.trim() ? 8 : undefined} data-testid="input-sign-up-password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-[#6f7f77]" aria-label={t(showPassword ? 'hidePassword' : 'showPassword')}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <div className="flex items-start gap-3 text-sm leading-6 text-[#43594f]">
              <input
                id="signup-policy-consent"
                type="checkbox"
                checked={hasAcceptedPolicies}
                onChange={(event) => setHasAcceptedPolicies(event.target.checked)}
                required
                className="mt-1 h-4 w-4 shrink-0 accent-[#1f5948] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9b949]"
                data-testid="input-signup-policy-consent"
              />
              <label htmlFor="signup-policy-consent">
                {t('signupConsentPrefix')}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-normal text-[#1f5948] no-underline hover:underline underline-offset-2" data-testid="link-signup-terms">
                  {t('termsOfService')}
                </Link>
                {t('signupConsentJoin')}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-normal text-[#1f5948] no-underline hover:underline underline-offset-2" data-testid="link-signup-privacy">
                  {t('privacyPolicy')}
                </Link>
                {t('signupConsentSuffix')}
              </label>
            </div>
            <button type="submit" disabled={isSubmitting || fetchStatus === 'fetching' || !hasAcceptedPolicies} className="auth-continue-button flex min-h-[48px] w-full items-center justify-center gap-[10px] rounded-xl bg-[#1f5948] px-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#174536] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e9b949]/70 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-create-account">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {t('continue')}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-[#6f7f77]"><span className="h-px flex-1 bg-[#d9dfd7]" /><span>{t('or')}</span><span className="h-px flex-1 bg-[#d9dfd7]" /></div>
          <button type="button" onClick={handleGoogleSignUp} disabled={isSubmitting} className={authOutlineButtonClass} data-testid="button-google-sign-up">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 0 1 13 31.5l-6.4 5A20 20 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5Z" />
              <path fill="#34A853" d="M24 44c5.4 0 10.1-2.1 13.5-5.6l-6.2-5.2A12 12 0 0 1 13 31.5l-6.4 5A20 20 0 0 0 24 44Z" />
              <path fill="#FBBC05" d="M13 31.5a12 12 0 0 1 0-15l-6.4-5a20 20 0 0 0 0 25Z" />
              <path fill="#EA4335" d="M24 12c3.1 0 5.9 1.1 8.1 3.2l5.7-5.7A19.8 19.8 0 0 0 24 4 20 20 0 0 0 6.6 11.5l6.4 5A12 12 0 0 1 24 12Z" />
            </svg>
            {copy.continueWithGoogle}
          </button>
        </>
      )}

      <div id="clerk-captcha" data-cl-theme="light" data-cl-size="flexible" data-cl-language={language} />
      <p className="mt-4 text-center text-sm leading-6 text-[#6f7f77]">
        {t('alreadyHaveAccount')}{' '}
        <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`} className="inline-flex min-h-11 items-center font-bold text-[#1f5948] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9b949]">
          {t('signIn')}
        </Link>
      </p>
      <AuthAttribution />
    </section>
  );
}