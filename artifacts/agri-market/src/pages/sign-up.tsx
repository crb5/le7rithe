import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useUser, useSignInRedirect } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import { normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { savePendingSignupProfile } from '@/lib/pending-signup-profile';
import {
  ENROLLMENT_FLOW_SLUG,
  startFlow,
  submitFlow,
  flowFieldError,
  flowNonFieldError,
  isFlowSuccess,
  isFlowDenied,
  isFlowUnsupported,
  socialSourceUrl,
  type FlowChallenge,
  type PromptField,
} from '@/lib/oidc-flow';
import { AuthShell, GoogleContinueButton, AuthDivider, AuthFieldError } from '@/components/auth-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type Stage = 'loading' | 'prompt' | 'completing' | 'unsupported' | 'denied' | 'error';

function inputTypeFor(fieldType: string): string {
  switch (fieldType) {
    case 'email':
    case 'password':
      return fieldType;
    default:
      return 'text';
  }
}

export function SignUp() {
  const { t } = useLanguage();
  const { isLoaded, user } = useUser();
  const signInRedirect = useSignInRedirect();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = signupReturnPath(search, 'redirect_url');

  const [stage, setStage] = useState<Stage>('loading');
  const [challenge, setChallenge] = useState<FlowChallenge | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChallenge(next: FlowChallenge) {
    setChallenge(next);
    if (isFlowSuccess(next)) {
      setStage('completing');
      const normalizedPhone = normalizeMauritaniaPhone(phone);
      if (normalizedPhone) savePendingSignupProfile({ name: values.name ?? '', phone: normalizedPhone });
      void signInRedirect(redirectTo);
      return;
    }
    if (isFlowDenied(next)) {
      setError(flowNonFieldError(next) ?? t('authGenericError'));
      setStage('denied');
      return;
    }
    setError(flowNonFieldError(next));
    if (next.component === 'ak-stage-prompt') {
      // Carry values forward across stages, and pre-fill any server-provided defaults.
      setValues((previous) => {
        const merged = { ...previous };
        for (const field of next.fields ?? []) {
          if (merged[field.field_key] === undefined && field.initial_value) {
            merged[field.field_key] = field.initial_value;
          }
        }
        return merged;
      });
      setStage('prompt');
      return;
    }
    if (isFlowUnsupported(next)) { setStage('unsupported'); return; }
    setStage('error');
  }

  function restart() {
    setStage('loading');
    setError(null);
    setValues({});
    void startFlow(ENROLLMENT_FLOW_SLUG).then(handleChallenge).catch(() => setStage('error'));
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (user) { setLocation(redirectTo, { replace: true }); return; }
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  const fields = (challenge?.fields ?? []).filter(
    (field): field is PromptField => field.type !== 'static' && field.type !== 'separator' && field.type !== 'hidden',
  );
  const showPhone = fields.some((field) => field.field_key === 'email');

  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    if (showPhone) {
      const normalized = normalizeMauritaniaPhone(phone);
      if (!normalized) {
        setPhoneError(t('authInvalidPhone'));
        return;
      }
      setPhoneError(null);
    }
    setSubmitting(true);
    setError(null);
    try {
      handleChallenge(await submitFlow(ENROLLMENT_FLOW_SLUG, values));
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

      <form onSubmit={submitPrompt} className="space-y-4">
        {fields.map((field) => (
          <div key={field.field_key}>
            <Label htmlFor={`sign-up-${field.field_key}`}>{field.label}</Label>
            <Input
              id={`sign-up-${field.field_key}`}
              name={field.field_key}
              type={inputTypeFor(field.type)}
              value={values[field.field_key] ?? ''}
              onChange={(event) => setValues((previous) => ({ ...previous, [field.field_key]: event.target.value }))}
              placeholder={field.type === 'text' || field.type === 'email' ? field.placeholder : undefined}
              required={field.required}
              autoComplete={field.field_key === 'password' || field.field_key === 'password_repeat' ? 'new-password' : field.field_key}
              className="mt-2"
            />
            <AuthFieldError message={flowFieldError(challenge, field.field_key)} />
          </div>
        ))}
        {showPhone && (
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
        )}
        <AuthFieldError message={error} />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : t('authCreateAccount')}
        </Button>
      </form>
    </AuthShell>
  );
}
