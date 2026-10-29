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
  flowFieldError,
  flowNonFieldError,
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

type Stage = 'loading' | 'identification' | 'password' | 'completing' | 'unsupported' | 'denied' | 'error';

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
      setError(flowNonFieldError(next) ?? t('authInvalidCredentials'));
      setStage('denied');
      return;
    }
    setError(flowNonFieldError(next));
    if (next.component === 'ak-stage-identification') { setStage('identification'); return; }
    if (next.component === 'ak-stage-password') { setStage('password'); return; }
    if (isFlowUnsupported(next)) { setStage('unsupported'); return; }
    setStage('error');
  }

  function restart() {
    setStage('loading');
    setError(null);
    setUid('');
    setPassword('');
    void startFlow(LOGIN_FLOW_SLUG).then(handleChallenge).catch(() => setStage('error'));
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (user) { setLocation(redirectTo, { replace: true }); return; }
    restart();
    // Runs once: starting the flow again on every redirectTo/user change would restart it mid-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  async function submitIdentification(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { uid_field: uid };
      if (challenge?.password_fields) body.password = password;
      handleChallenge(await submitFlow(LOGIN_FLOW_SLUG, body));
    } catch {
      setError(t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      handleChallenge(await submitFlow(LOGIN_FLOW_SLUG, { password }));
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

  const showPasswordWithIdentification = stage === 'identification' && Boolean(challenge?.password_fields);
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

      {stage === 'identification' && (
        <form onSubmit={submitIdentification} className="space-y-4">
          <div>
            <Label htmlFor="sign-in-uid">{t('authIdentifierLabel')}</Label>
            <Input
              id="sign-in-uid"
              value={uid}
              onChange={(event) => setUid(event.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="mt-2"
            />
            <AuthFieldError message={flowFieldError(challenge, 'uid_field')} />
          </div>
          {showPasswordWithIdentification && (
            <div>
              <Label htmlFor="sign-in-password-combined">{t('authPasswordLabel')}</Label>
              <Input
                id="sign-in-password-combined"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="mt-2"
              />
              <AuthFieldError message={flowFieldError(challenge, 'password')} />
            </div>
          )}
          <AuthFieldError message={error} />
          <Button type="submit" disabled={submitting || !uid} className="w-full">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : t('authContinue')}
          </Button>
        </form>
      )}

      {stage === 'password' && (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <Label htmlFor="sign-in-password">{t('authPasswordLabel')}</Label>
            <Input
              id="sign-in-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              className="mt-2"
            />
            <AuthFieldError message={flowFieldError(challenge, 'password')} />
          </div>
          <AuthFieldError message={error} />
          <Button type="submit" disabled={submitting || !password} className="w-full">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : t('authContinue')}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={restart}>
            {t('authBackToIdentifier')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
