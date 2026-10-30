import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useUser, useSignInRedirect } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import { normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { savePendingSignupProfile } from '@/lib/pending-signup-profile';
import { savePendingLegalConsent } from '@/lib/legal-consent-flow';
import {
  ENROLLMENT_FLOW_SLUG,
  startFlow,
  submitFlow,
  translateFlowFieldError,
  translateFlowNonFieldError,
  isFlowSuccess,
  isFlowDenied,
  isFlowUnsupported,
  socialSourceUrl,
  type FlowChallenge,
} from '@/lib/oidc-flow';
import { AuthShell, GoogleContinueButton, AuthDivider, AuthFieldError } from '@/components/auth-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type Stage = 'loading' | 'ready' | 'completing' | 'unsupported' | 'denied' | 'error';

function hasField(challenge: FlowChallenge | null, key: string): boolean {
  return (challenge?.fields ?? []).some((field) => field.field_key === key);
}

/**
 * Credentials (username/password) and profile (name/email) are two separate
 * Authentik enrollment stages under the hood, submitted as two chained
 * requests — but every field is shown together on one screen, so the person
 * never sees that split. Phone and the policy checkbox are collected here
 * too but never sent to Authentik: phone is saved to our own DB after the
 * account exists (see lib/pending-signup-profile.ts), and the policy
 * checkbox feeds the existing legal-consent-flow mechanism so the separate
 * consent screen never shows for people who already agreed here.
 */
export function SignUp() {
  const { t, language } = useLanguage();
  const { isLoaded, user } = useUser();
  const signInRedirect = useSignInRedirect();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = signupReturnPath(search, 'redirect_url');

  const [stage, setStage] = useState<Stage>('loading');
  const [challenge, setChallenge] = useState<FlowChallenge | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChallenge(next: FlowChallenge) {
    setChallenge(next);
    if (isFlowSuccess(next)) {
      setStage('completing');
      const normalizedPhone = normalizeMauritaniaPhone(phone);
      if (normalizedPhone) savePendingSignupProfile({ name, phone: normalizedPhone });
      savePendingLegalConsent({ locale: language, redirectPath: redirectTo });
      void signInRedirect(redirectTo);
      return;
    }
    if (isFlowDenied(next)) {
      setError(translateFlowNonFieldError(t, next) ?? t('authGenericError'));
      setStage('denied');
      return;
    }
    setError(translateFlowNonFieldError(t, next));
    if (next.component === 'ak-stage-prompt') { setStage('ready'); return; }
    if (isFlowUnsupported(next)) { setStage('unsupported'); return; }
    setStage('error');
  }

  function restart() {
    setStage('loading');
    setError(null);
    void startFlow(ENROLLMENT_FLOW_SLUG).then(handleChallenge).catch(() => setStage('error'));
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (user) { setLocation(redirectTo, { replace: true }); return; }
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedPhone = normalizeMauritaniaPhone(phone);
    if (!normalizedPhone) {
      setPhoneError(t('authInvalidPhone'));
      return;
    }
    setPhoneError(null);
    if (!agreedToPolicies) {
      setAgreementError(t('authAgreeRequired'));
      return;
    }
    setAgreementError(null);
    setSubmitting(true);
    setError(null);
    try {
      let next = await submitFlow(ENROLLMENT_FLOW_SLUG, { username, password, password_repeat: passwordRepeat });
      if (hasField(next, 'name')) {
        next = await submitFlow(ENROLLMENT_FLOW_SLUG, { name, email });
      }
      handleChallenge(next);
    } catch {
      setError(t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded || stage === 'loading' || stage === 'completing') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (stage === 'unsupported' || stage === 'denied' || stage === 'error') {
    return (
      <AuthShell title={t('authSignUpTitle')}>
        <AuthFieldError message={error ?? t('authGenericError')} />
        <div className="mt-4 space-y-2">
          <Button type="button" className="w-full" onClick={() => void signInRedirect(redirectTo)}>
            {t('authContinueSecure')}
          </Button>
          {stage !== 'unsupported' && (
            <Button type="button" variant="outline" className="w-full" onClick={restart}>
              {t('authTryAgain')}
            </Button>
          )}
        </div>
      </AuthShell>
    );
  }

  const ownReturnPath = `/sign-up?redirect_url=${encodeURIComponent(redirectTo)}`;
  const googleUrl = socialSourceUrl(challenge, ownReturnPath);

  return (
    <AuthShell
      title={t('authSignUpTitle')}
      subtitle={t('authSignUpSubtitle')}
      footer={
        <p className="mt-8 text-sm text-muted-foreground">
          {t('authAlreadyHaveAccount')}{' '}
          <a href="/sign-in" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {t('authSignInInstead')}
          </a>
        </p>
      }
    >
      {googleUrl && (
        <>
          <GoogleContinueButton url={googleUrl} label={t('authContinueWithGoogle')} />
          <AuthDivider label={t('authOrDivider')} />
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="sign-up-username">{t('authUsernameLabel')}</Label>
          <Input
            id="sign-up-username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'username')} />
        </div>
        <div>
          <Label htmlFor="sign-up-name">{t('authNameLabel')}</Label>
          <Input
            id="sign-up-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'name')} />
        </div>
        <div>
          <Label htmlFor="sign-up-email">{t('authEmailLabel')}</Label>
          <Input
            id="sign-up-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'email')} />
        </div>
        <div>
          <Label htmlFor="sign-up-phone">{t('authPhoneLabel')}</Label>
          <Input
            id="sign-up-phone"
            name="phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+222 XX XX XX XX"
            autoComplete="tel"
            required
            className="mt-2"
          />
          <AuthFieldError message={phoneError} />
        </div>
        <div>
          <Label htmlFor="sign-up-password">{t('authPasswordLabel')}</Label>
          <Input
            id="sign-up-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'password')} />
        </div>
        <div>
          <Label htmlFor="sign-up-password-repeat">{t('authPasswordRepeatLabel')}</Label>
          <Input
            id="sign-up-password-repeat"
            name="password_repeat"
            type="password"
            value={passwordRepeat}
            onChange={(event) => setPasswordRepeat(event.target.value)}
            autoComplete="new-password"
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'password_repeat')} />
        </div>
        <div>
          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreedToPolicies}
              onChange={(event) => setAgreedToPolicies(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
            />
            <span>
              {t('authAgreePrefix')}{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                {t('termsOfService')}
              </a>
              {' '}{t('authAgreeAnd')}{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                {t('privacyPolicy')}
              </a>
            </span>
          </label>
          <AuthFieldError message={agreementError} />
        </div>
        <AuthFieldError message={error} />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : t('authCreateAccount')}
        </Button>
      </form>
    </AuthShell>
  );
}
