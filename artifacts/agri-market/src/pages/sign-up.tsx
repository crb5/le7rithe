import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useUser, useSignInRedirect } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import { LOGIN_FLOW_SLUG, startFlow, socialSourceUrl, type FlowChallenge } from '@/lib/oidc-flow';
import { AuthShell, GoogleContinueButton, AuthFieldError } from '@/components/auth-form';
import { Spinner } from '@/components/ui/spinner';

/**
 * Registration is Google-only for now: this instance has no self-service
 * username/password enrollment flow configured in Authentik (confirmed via
 * `ak shell` — only `default-source-enrollment`, the just-in-time flow that
 * runs after a *new* Google sign-in, exists). A phone+password flow needs an
 * SMS provider wired into Authentik first; add that path here once it exists.
 */
export function SignUp() {
  const { t } = useLanguage();
  const { isLoaded, user } = useUser();
  const signInRedirect = useSignInRedirect();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = signupReturnPath(search, 'redirect_url');

  const [challenge, setChallenge] = useState<FlowChallenge | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (user) { setLocation(redirectTo, { replace: true }); return; }
    void startFlow(LOGIN_FLOW_SLUG).then(setChallenge).catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  if (!isLoaded || (!challenge && !error)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Spinner />
      </div>
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
      {googleUrl ? (
        <GoogleContinueButton url={googleUrl} label={t('authContinueWithGoogle')} />
      ) : (
        <AuthFieldError message={t('authGenericError')} />
      )}
    </AuthShell>
  );
}
