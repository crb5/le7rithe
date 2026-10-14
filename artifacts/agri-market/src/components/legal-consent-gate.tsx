import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk } from '@/lib/auth';
import {
  getGetMyLegalConsentQueryKey,
  useGetMyLegalConsent,
  useRecordLegalConsent,
} from '@workspace/api-client-react';
import { FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Link, useLocation } from 'wouter';
import {
  clearPendingLegalConsent,
  readPendingLegalConsent,
  type PendingLegalConsent,
} from '@/lib/legal-consent-flow';
import { useLanguage } from '@/lib/language';
import { isIdentityProtectedPath } from '@/lib/auth-query-cache';

function LegalConsentCard({
  pending,
  isSaving,
  error,
  onAccept,
  onSignOut,
}: {
  pending: PendingLegalConsent | null;
  isSaving: boolean;
  error: boolean;
  onAccept: () => void;
  onSignOut: () => void;
}) {
  const { language, meta, t } = useLanguage();
  const isCompletingSignup = Boolean(pending);

  return (
    <main
      dir={meta[language].dir}
      className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10 text-[hsl(var(--foreground))]"
      data-testid="legal-consent-gate"
    >
      <section className="w-full max-w-xl rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_16px_44px_hsl(155_20%_18%/.09)] sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]" aria-hidden="true">
          <ShieldCheck size={22} />
        </div>
        <h1 className="text-xl font-bold text-[hsl(var(--primary))]" data-testid="text-legal-consent-title">
          {isCompletingSignup && isSaving ? t('legalConsentCompleteTitle') : t('legalConsentTitle')}
        </h1>
        <p className="mt-2 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          {isCompletingSignup && isSaving ? t('legalConsentCompleteDescription') : t('legalConsentDescription')}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))] transition hover:border-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
            data-testid="link-consent-terms"
          >
            <FileText size={16} aria-hidden="true" />
            {t('termsOfService')}
          </Link>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))] transition hover:border-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
            data-testid="link-consent-privacy"
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {t('privacyPolicy')}
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] px-4 py-3 text-sm leading-6 text-[hsl(var(--destructive))]" data-testid="text-legal-consent-error">
            {t('legalConsentError')}
          </p>
        )}

        <button
          type="button"
          onClick={onAccept}
          disabled={isSaving}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="button-legal-consent-accept"
        >
          {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isSaving ? t('legalConsentSubmitting') : t('legalConsentSubmit')}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSaving}
          className="mt-3 min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] underline underline-offset-4 hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="button-legal-consent-sign-out"
        >
          {t('signOut')}
        </button>
      </section>
    </main>
  );
}

export function LegalConsentGate({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [location, setLocation] = useLocation();
  const { language, setLanguage, t, meta } = useLanguage();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const pendingAtMount = useRef<PendingLegalConsent | null>(readPendingLegalConsent());
  const [pendingConsent, setPendingConsent] = useState<PendingLegalConsent | null>(pendingAtMount.current);
  const [submissionError, setSubmissionError] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoAttemptRef = useRef<string | null>(null);
  const consentQuery = useGetMyLegalConsent({
    query: {
      enabled,
      queryKey: getGetMyLegalConsentQueryKey(),
      retry: false,
      refetchOnWindowFocus: true,
    },
  });
  const saveConsent = useRecordLegalConsent();

  const finishPendingSignup = async (pending: PendingLegalConsent) => {
    await saveConsent.mutateAsync({ data: { accepted: true, locale: pending.locale } });
    await queryClient.invalidateQueries({ queryKey: getGetMyLegalConsentQueryKey() });
    clearPendingLegalConsent();
    setPendingConsent(null);
    setLanguage(pending.locale);
    setLocation(pending.redirectPath, { replace: true });
  };

  useEffect(() => {
    const pending = pendingConsent;
    const status = consentQuery.data;
    if (!pending || consentQuery.isLoading || consentQuery.isError || !status) return;

    if (!status.needsConsent) {
      clearPendingLegalConsent();
      setPendingConsent(null);
      setLanguage(pending.locale);
      setLocation(pending.redirectPath, { replace: true });
      return;
    }

    const attemptKey = `${pending.locale}:${pending.redirectPath}`;
    if (autoAttemptRef.current === attemptKey) return;
    autoAttemptRef.current = attemptKey;
    setAutoSaving(true);
    setSubmissionError(false);
    void finishPendingSignup(pending).catch(() => {
      setSubmissionError(true);
    }).finally(() => {
      setAutoSaving(false);
    });
  }, [
    consentQuery.data,
    consentQuery.isError,
    consentQuery.isLoading,
    pendingConsent,
    setLanguage,
    setLocation,
  ]);

  const handleAccept = async () => {
    setSubmissionError(false);
    if (pendingConsent) {
      setAutoSaving(true);
      try {
        await finishPendingSignup(pendingConsent);
      } catch {
        setSubmissionError(true);
      } finally {
        setAutoSaving(false);
      }
      return;
    }

    try {
      await saveConsent.mutateAsync({ data: { accepted: true, locale: language } });
      await queryClient.invalidateQueries({ queryKey: getGetMyLegalConsentQueryKey() });
    } catch {
      setSubmissionError(true);
    }
  };

  const consentCheckEnabled = enabled && location !== '/privacy' && location !== '/terms';
  const publicRoute = !isIdentityProtectedPath(location);
  const consentLoading = consentCheckEnabled && (consentQuery.isLoading || !consentQuery.data);
  const consentError = consentCheckEnabled && consentQuery.isError;
  const needsConsent = consentCheckEnabled && !consentQuery.isError &&
    !consentQuery.isLoading && Boolean(consentQuery.data?.needsConsent);
  const consentPrompt = (
    <LegalConsentCard
      pending={pendingConsent}
      isSaving={autoSaving || saveConsent.isPending}
      error={submissionError}
      onAccept={() => void handleAccept()}
      onSignOut={() => void signOut()}
    />
  );
  const consentErrorView = (
      <main dir={meta[language].dir} className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10" data-testid="legal-consent-status-error">
        <section className="w-full max-w-xl rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center shadow-[0_16px_44px_hsl(155_20%_18%/.09)] sm:p-8">
          <p dir={meta[language].dir} role="alert" className="text-sm leading-7 text-[hsl(var(--muted-foreground))]">{t('legalConsentStatusError')}</p>
          <button
            type="button"
            onClick={() => void consentQuery.refetch()}
            className="mt-5 min-h-11 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
            data-testid="button-legal-consent-retry"
          >
            {t('legalConsentRetry')}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 min-h-11 rounded-xl px-5 py-3 text-sm font-semibold text-[hsl(var(--muted-foreground))] underline underline-offset-4 hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
            data-testid="button-legal-consent-error-sign-out"
          >
            {t('signOut')}
          </button>
        </section>
      </main>
  );

  const consentLoadingView = (
    <main dir={meta[language].dir} className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4" aria-live="polite" data-testid="legal-consent-status-loading">
      <Spinner />
    </main>
  );

  if (publicRoute) {
    const isBlocked = consentLoading || consentError || needsConsent;
    return (
      <>
        <div className="contents" aria-hidden={isBlocked || undefined} inert={isBlocked || undefined}>
          {children}
        </div>
        {consentLoading ? (
          <main
            dir={meta[language].dir}
            className="fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background)/.55)] px-4 backdrop-blur-[2px]"
            aria-live="polite"
            data-testid="legal-consent-status-loading"
          >
            <Spinner />
          </main>
        ) : null}
        {consentError ? (
          <div className="fixed inset-0 z-[200] overflow-y-auto bg-[hsl(var(--background))]">
            {consentErrorView}
          </div>
        ) : null}
        {needsConsent ? (
          <div className="fixed inset-0 z-[200] overflow-y-auto bg-[hsl(var(--background))]">
            {consentPrompt}
          </div>
        ) : null}
      </>
    );
  }

  if (!consentCheckEnabled) return children;
  if (consentError) return consentErrorView;
  if (consentLoading) return consentLoadingView;
  if (needsConsent) return consentPrompt;

  return children;
}
