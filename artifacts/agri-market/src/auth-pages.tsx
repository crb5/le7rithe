import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SignIn, useUser } from '@clerk/react';
import { Phone } from 'lucide-react';
import { useCompletePhoneSignupProfile } from '@workspace/api-client-react';
import { HeaderBrand, HeaderLanguageSwitcher, useHeaderLocaleTransition, type Lang } from '@/components/Header';
import { useLanguage } from '@/lib/language';
import { RequiredNameSignUp } from '@/components/required-name-sign-up';
import { PhoneSignIn } from '@/components/phone-sign-in';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import { SITE_NAME } from '@/lib/brand';
import { clerkSharedAuthAppearance } from '@/lib/clerkTheme';
import { useLocation, useSearch } from 'wouter';
import { Link } from 'wouter';
import './auth.css';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');


function authRoute(path: '/sign-in' | '/sign-up', redirectPath: string): string {
  return `${path}?redirect_url=${encodeURIComponent(redirectPath)}`;
}


export function AuthPageFrame({
  children,
  pageClassName = '',
}: {
  children: ReactNode;
  pageClassName?: string;
}) {
  const { language, setLanguage, meta, t } = useLanguage();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const authIdentityRef = useRef<HTMLDivElement>(null);
  const authToolsRef = useRef<HTMLDivElement>(null);
  useHeaderLocaleTransition(meta[language].dir, authIdentityRef, authToolsRef);
  return (
    <div
      dir={meta[language].dir}
      className={`auth-page ${pageClassName} relative flex min-h-[100dvh] flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]`}
      data-testid="auth-page"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -start-36 top-28 h-80 w-80 rounded-full bg-[hsl(var(--accent)/.13)] blur-3xl" />
        <div className="absolute -bottom-40 end-[-7rem] h-96 w-96 rounded-full bg-[hsl(var(--primary)/.08)] blur-3xl" />
      </div>
      <header
        dir="ltr"
        className={`auth-topbar relative z-10 flex items-center justify-between gap-4 ${meta[language].dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}
        data-testid="auth-header"
      >
        <div ref={authIdentityRef} className="flex min-w-0 items-center" data-testid="auth-identity">
          <HeaderBrand direction={meta[language].dir} />
        </div>
        <div ref={authToolsRef} className="flex items-center" data-testid="auth-tools">
          <HeaderLanguageSwitcher
            language={({ ar: 'AR', fr: 'FR', en: 'EN' } as const)[language]}
            onLanguageChange={(nextLanguage: Lang) =>
              setLanguage(({ AR: 'ar', FR: 'fr', EN: 'en' } as const)[nextLanguage])
            }
            languageMenuOpen={languageMenuOpen}
            onLanguageMenuOpenChange={setLanguageMenuOpen}
          />
        </div>
      </header>
      <main className={`relative z-[1] flex w-full flex-1 justify-center px-4 sm:px-6 ${pageClassName === 'auth-page--sign-in' || pageClassName === 'auth-page--sign-up' ? 'items-start pb-8 pt-3 sm:pt-6' : 'items-center py-7 sm:py-10'}`}>
        <div className="mx-auto w-full max-w-[28rem]" data-testid="auth-card-container">
          {children}
        </div>
      </main>
    </div>
  );
}


export function SignInPage() {
  const search = useSearch();
  const redirectPath = signupReturnPath(search, 'redirect_url');
  const fallbackRedirectUrl = `${basePath}${redirectPath}`;
  return (
    <AuthPageFrame pageClassName="auth-page--sign-in">
      <ClerkPasswordToggleLocalization />
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={fallbackRedirectUrl || '/'}
        appearance={clerkSharedAuthAppearance}
      />
      <PhoneSignIn basePath={basePath} redirectPath={redirectPath} />
    </AuthPageFrame>
  );
}


export function PhoneSignupNamePage() {
  const { user } = useUser();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const completeProfile = useCompletePhoneSignupProfile();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const returnPath = signupReturnPath(search);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
  }, [user]);

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    const first = firstName.trim();
    if (!first) {
      setError(t('phoneSignupNameRequired'));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await completeProfile.mutateAsync({ data: { firstName: first } });
      await user.reload();
      setLocation(returnPath, { replace: true });
    } catch (caught) {
      const response = caught && typeof caught === 'object'
        ? caught as { data?: unknown }
        : null;
      const data = response?.data && typeof response.data === 'object'
        ? response.data as { error?: unknown }
        : null;
      setError(typeof data?.error === 'string' ? data.error : t('phoneSignupNameError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthPageFrame pageClassName="auth-page--phone-profile">
      <section className="rounded-[1.5rem] border border-[#e4e9e5] bg-white p-6 shadow-[0_16px_40px_rgba(23,61,50,0.08)] sm:p-8" data-testid="phone-name-completion">
        <div className="mb-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff5ef] text-[#1f5948]">
            <Phone size={20} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-[#173d32]">{t('phoneSignupNameTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-[#6f7f77]">{t('phoneSignupNameDescription')}</p>
        </div>
        <form onSubmit={saveName} className="space-y-4">
          <label className="block text-xs font-semibold text-[#173d32]">
            {t('phoneSignupNameLabel')}
            <input
              required
              maxLength={120}
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-2 min-h-[50px] w-full rounded-xl border border-[#d9dfd7] bg-white px-4 text-sm text-[#173d32] outline-none focus:border-[#1f5948] focus:ring-2 focus:ring-[#1f5948]/20"
              data-testid="input-phone-signup-first-name"
            />
          </label>
          {error && <p role="alert" className="text-xs font-medium text-[#b94b3e]">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#1f5948] px-4 text-sm font-bold text-white transition-colors hover:bg-[#174536] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="button-phone-signup-save-name"
          >
            {isSaving && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {isSaving ? t('saving') : t('phoneSignupNameSave')}
          </button>
        </form>
      </section>
    </AuthPageFrame>
  );
}


export function SignUpPage({ redirectPath }: { redirectPath: string }) {
  return (
    <AuthPageFrame pageClassName="auth-page--sign-up">
      <RequiredNameSignUp basePath={basePath} redirectPath={redirectPath} />
    </AuthPageFrame>
  );
}


export function PublishAuthPrompt() {
  const { meta, language, t } = useLanguage();
  return (
    <div dir={meta[language].dir} className="min-h-[100dvh] bg-[hsl(var(--background))] px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[0_12px_30px_hsl(155_20%_18%/.08)]" data-testid="publish-auth-prompt">
          <Link
            href="/"
            dir="ltr"
            aria-label={SITE_NAME}
            className="mx-auto mb-5 flex w-fit flex-col items-center text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            <span dir="ltr" className="text-xl font-bold tracking-[.035em]">{SITE_NAME}</span>
          </Link>
          <h1 className="text-xl font-bold text-[hsl(var(--primary))]">{t('publishRequiresAccount')}</h1>
          <p className="mt-2 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{t('publishRequiresAccountDescription')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={authRoute('/sign-in', '/add-listing')} className="rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-publish-sign-in">{t('signIn')}</Link>
            <Link href={authRoute('/sign-up', '/add-listing')} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-publish-sign-up">{t('createAccount')}</Link>
          </div>
          <Link href="/" className="mt-5 inline-block text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]">{t('backToMarket')}</Link>
        </section>
      </div>
    </div>
  );
}


export function ClerkPasswordToggleLocalization() {
  const { t } = useLanguage();

  useEffect(() => {
    const localizePasswordToggles = () => {
      document.querySelectorAll<HTMLElement>('[aria-label="Show password"], [aria-label="Hide password"]').forEach((element) => {
        const isVisible = element.getAttribute('aria-label') === 'Hide password';
        element.setAttribute('aria-label', t(isVisible ? 'hidePassword' : 'showPassword'));
      });
    };
    localizePasswordToggles();
    const observer = new MutationObserver(localizePasswordToggles);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [t]);

  return null;
}