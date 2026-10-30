import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useUser, useSignInRedirect } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import {
  LOGIN_FLOW_SLUG,
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

/**
 * Identification and password are two separate Authentik stages under the
 * hood, submitted as two chained requests — but both fields are shown
 * together on one screen, so the person never sees that split.
 */
export function SignIn() {
  const { t } = useLanguage();
  const { isLoaded, user } = useUser();
  const signInRedirect = useSignInRedirect();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = signupReturnPath(search, 'redirect_url');

  const [stage, setStage] = useState<Stage>('loading');
  const [challenge, setChallenge] = useState<FlowChallenge | null>(null);
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChallenge(next: FlowChallenge) {
    setChallenge(next);
    if (isFlowSuccess(next)) {
      setStage('completing');
      void signInRedirect(redirectTo);
      return;
    }
    if (isFlowDenied(next)) {
      setError(translateFlowNonFieldError(t, next) ?? t('authInvalidCredentials'));
      setStage('denied');
      return;
    }
    setError(translateFlowNonFieldError(t, next));
    if (next.component === 'ak-stage-identification' || next.component === 'ak-stage-password') {
      setStage('ready');
      return;
    }
    if (isFlowUnsupported(next)) { setStage('unsupported'); return; }
    setStage('error');
  }

  function restart() {
    setStage('loading');
    setError(null);
    void startFlow(LOGIN_FLOW_SLUG).then(handleChallenge).catch(() => setStage('error'));
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (user) { setLocation(redirectTo, { replace: true }); return; }
    restart();
    // Runs once: starting the flow again on every redirectTo/user change would restart it mid-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const first = challenge?.password_fields ? { uid_field: uid, password } : { uid_field: uid };
      let next = await submitFlow(LOGIN_FLOW_SLUG, first);
      if (next.component === 'ak-stage-password') {
        next = await submitFlow(LOGIN_FLOW_SLUG, { password });
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
      <AuthShell title={t('authSignInTitle')}>
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

  const ownReturnPath = `/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`;
  const googleUrl = socialSourceUrl(challenge, ownReturnPath);

  return (
    <AuthShell
      title={t('authSignInTitle')}
      subtitle={t('authSignInSubtitle')}
      footer={
        <p className="mt-8 text-sm text-muted-foreground">
          {t('authNoAccountYet')}{' '}
          <a href="/sign-up" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {t('authCreateAccount')}
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
          <Label htmlFor="sign-in-uid">{t('authIdentifierLabel')}</Label>
          <Input
            id="sign-in-uid"
            name="username"
            value={uid}
            onChange={(event) => setUid(event.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'uid_field')} />
        </div>
        <div>
          <Label htmlFor="sign-in-password">{t('authPasswordLabel')}</Label>
          <Input
            id="sign-in-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="mt-2"
          />
          <AuthFieldError message={translateFlowFieldError(t, challenge, 'password')} />
        </div>
        <AuthFieldError message={error} />
        <Button type="submit" disabled={submitting || !uid || !password} className="w-full">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : t('authContinue')}
        </Button>
      </form>
    </AuthShell>
  );
}
