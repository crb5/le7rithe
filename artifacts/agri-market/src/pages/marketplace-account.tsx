import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useAuth, useClerk, useUser } from '@/lib/auth';
import { AlertTriangle, CheckCircle2, LoaderCircle, Trash2, UserRound } from 'lucide-react';
import {
  getGetMyAccountProfileQueryKey,
  getListSavedListingsQueryKey,
  getListSellerActiveListingsQueryKey,
  useGetMyAccountProfile,
  useSendPhoneVerification,
  useUpdateMyAccountProfile,
  useVerifyPhoneNumber,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, PageHeading } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import { hasAllowedMauritaniaPhonePrefix, normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { useToast } from '@/hooks/use-toast';
import { VerifiedBadge } from '@/components/verified-badge';


export type PendingPhoneVerification = { verificationId: string };


export const accountRequestError = (caught: unknown, fallback: string) => {
  const error = caught && typeof caught === "object"
    ? caught as { message?: unknown; data?: unknown }
    : null;
  const data = error?.data && typeof error.data === "object"
    ? error.data as { error?: unknown; retryAfterSeconds?: unknown }
    : null;
  return {
    message: typeof data?.error === "string"
      ? data.error
      : typeof error?.message === "string" && error.message
        ? error.message
        : fallback,
    retryAfterSeconds: typeof data?.retryAfterSeconds === "number" && Number.isFinite(data.retryAfterSeconds)
      ? Math.max(0, Math.ceil(data.retryAfterSeconds))
      : 0,
  };
};


export const accountRequestStatus = (caught: unknown) => (
  caught && typeof caught === "object" && "status" in caught
    ? Number((caught as { status?: unknown }).status)
    : 0
);


export function Account() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { t, formatDate } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileQuery = useGetMyAccountProfile({
    query: { queryKey: getGetMyAccountProfileQueryKey() },
  });
  const sendPhoneVerification = useSendPhoneVerification();
  const updateAccountProfile = useUpdateMyAccountProfile();
  const verifyPhoneNumber = useVerifyPhoneNumber();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingPhone, setPendingPhone] = useState<PendingPhoneVerification | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [phoneValidationAttempted, setPhoneValidationAttempted] = useState(false);
  const [phonePrefixRejected, setPhonePrefixRejected] = useState(false);

  const currentPhone = profileQuery.data?.phoneVerified
    ? profileQuery.data.phone || ''
    : user?.primaryPhoneNumber?.phoneNumber || '';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const normalizedCurrentPhone = normalizeMauritaniaPhone(currentPhone);
  const normalizedEditedPhone = normalizeMauritaniaPhone(phone);
  const accountPhoneChanged = phone.trim() !== currentPhone
    && !(normalizedCurrentPhone && normalizedCurrentPhone === normalizedEditedPhone);

  useEffect(() => {
    if (!user) return;
    const savedName = profileQuery.data?.name?.trim();
    if (savedName) {
      const [savedFirstName, ...savedLastName] = savedName.split(/\s+/);
      setFirstName(savedFirstName || '');
      setLastName(savedLastName.join(' '));
    } else {
      setFirstName(user.firstName || (typeof user.unsafeMetadata?.firstName === 'string' ? user.unsafeMetadata.firstName : ''));
      setLastName(user.lastName || (typeof user.unsafeMetadata?.lastName === 'string' ? user.unsafeMetadata.lastName : ''));
    }
    setPhone(currentPhone);
  }, [currentPhone, profileQuery.data?.name, user]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timeout = window.setTimeout(() => {
      setResendCountdown((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [resendCountdown]);

  const displayName = profileQuery.data?.name?.trim() || `${firstName} ${lastName}`.trim() || user?.fullName || t('user');

  const updatePhone = (value: string) => {
    if (!hasAllowedMauritaniaPhonePrefix(value)) {
      setPhonePrefixRejected(true);
      setPhoneValidationAttempted(true);
      return;
    }
    if (pendingPhone && normalizeMauritaniaPhone(value) !== normalizeMauritaniaPhone(phone)) {
      setPendingPhone(null);
      setVerificationCode('');
      setResendCountdown(0);
    }
    setPhonePrefixRejected(false);
    setPhone(value);
  };

  const requestPhoneCode = async (normalizedPhone: string) => {
    const sent = await sendPhoneVerification.mutateAsync({ data: { phone: normalizedPhone } });
    setPendingPhone({ verificationId: sent.verificationId });
    setVerificationCode('');
    setResendCountdown(sent.resendAfterSeconds);
    toast({ title: t('phoneVerification'), description: t('phoneVerificationSent') });
  };

  const resendPhoneCode = async () => {
    if (isSaving || resendCountdown > 0) return;
    const normalizedPhone = normalizeMauritaniaPhone(phone);
    if (!normalizedPhone) {
      setPhoneValidationAttempted(true);
      return;
    }
    setIsSaving(true);
    try {
      await requestPhoneCode(normalizedPhone);
    } catch (caught) {
      const failure = accountRequestError(caught, t('tryAgain'));
      if (failure.retryAfterSeconds > 0) setResendCountdown(failure.retryAfterSeconds);
      const status = accountRequestStatus(caught);
      const message = status === 409
        ? t('phoneLinkDuplicateError')
        : status === 429
          ? t('phoneLinkRateLimit')
          : status === 400
            ? t('mauritaniaPhoneInvalid')
            : t('phoneLinkError');
      toast({ title: t('accountUpdateError'), description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    if (!name) {
      toast({ title: t('accountUpdateError'), description: t('signUpNameRequired'), variant: 'destructive' });
      return;
    }
    if (!pendingPhone && phone.trim() !== currentPhone && !phone.trim()) {
      toast({ title: t('accountUpdateError'), description: t('phoneRequired'), variant: 'destructive' });
      return;
    }
    if (!pendingPhone && phonePrefixRejected) return;
    const phoneChanged = !pendingPhone && accountPhoneChanged;
    const normalizedPhone = phoneChanged ? normalizeMauritaniaPhone(phone) : null;
    if (phoneChanged && !normalizedPhone) {
      setPhoneValidationAttempted(true);
      return;
    }
    setIsSaving(true);
    let phoneRequestStarted = false;
    let phoneCodeBeingVerified = false;
    try {
      const updatedProfile = await updateAccountProfile.mutateAsync({ data: { name } });
      queryClient.setQueryData(getGetMyAccountProfileQueryKey(), updatedProfile);
      void queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === 'string'
          && query.queryKey[0].startsWith('/api/listings'),
      });
      void queryClient.invalidateQueries({ queryKey: getListSavedListingsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListSellerActiveListingsQueryKey() });
      if (pendingPhone) {
        if (!verificationCode.trim()) {
          toast({ title: t('phoneVerification'), description: t('verificationCodeRequired'), variant: 'destructive' });
          return;
        }
        phoneRequestStarted = true;
        phoneCodeBeingVerified = true;
        const verified = await verifyPhoneNumber.mutateAsync({
          data: {
            verificationId: pendingPhone.verificationId,
            code: verificationCode.trim(),
          },
        });
        await queryClient.invalidateQueries({ queryKey: getGetMyAccountProfileQueryKey() });
        setPendingPhone(null);
        setVerificationCode('');
        setResendCountdown(0);
        setPhone(verified.phone);
        toast({ title: t('accountUpdated'), description: t('phoneVerified') });
        return;
      }
      if (accountPhoneChanged) {
        if (resendCountdown > 0) {
          toast({
            title: t('phoneVerification'),
            description: t('phoneResendWait', { seconds: resendCountdown }),
            variant: 'destructive',
          });
          return;
        }
        phoneRequestStarted = true;
        await requestPhoneCode(normalizedPhone!);
        return;
      }
      toast({ title: t('accountUpdated'), description: t('accountUpdatedDescription') });
    } catch (caught) {
      const failure = accountRequestError(caught, t('tryAgain'));
      if (failure.retryAfterSeconds > 0) setResendCountdown(failure.retryAfterSeconds);
      const status = accountRequestStatus(caught);
      const message = phoneRequestStarted
        ? status === 409
          ? t('phoneLinkDuplicateError')
          : status === 429
            ? t('phoneLinkRateLimit')
            : status === 400
              ? t(phoneCodeBeingVerified ? 'phoneCodeInvalid' : 'mauritaniaPhoneInvalid')
              : t('phoneLinkError')
        : failure.message;
      toast({
        title: t('accountUpdateError'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm(t('deleteAccountConfirmation'))) return;
    setIsDeleting(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/account/me', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(t('accountDeletionError'));
      }
      const redirectUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;
      try {
        await signOut({ redirectUrl });
      } catch {
        window.location.assign(redirectUrl);
      }
    } catch {
      toast({
        title: t('accountDeletionError'),
        description: t('accountDeletionRetry'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return <AppShell>
    <PageHeading eyebrow={t('accountProfile')} title={t('account')} description={t('accountDescription')} />
    <section className="mb-7 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_8px_24px_hsl(155_20%_18%/.04)] sm:p-6" data-testid="account-profile-summary">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xl font-bold text-[hsl(var(--primary))]">{displayName.charAt(0)}</div>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-[hsl(var(--primary))]">
            {displayName}
            {profileQuery.data?.verified && <VerifiedBadge display="label" testId="badge-verified-account-summary" />}
          </h2>
          {profileQuery.data?.createdAt && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t('memberSince')} {formatDate(profileQuery.data.createdAt, { dateStyle: 'medium' })}
            </p>
          )}
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">{currentPhone || t('phoneNotLinked')}</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{email}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]"
          data-testid="link-view-my-listings"
        >
          {t('viewMyListings')}
        </Link>
      </div>
    </section>
    <div className="grid min-w-0 gap-7 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[0_14px_30px_hsl(155_20%_18%/.12)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xl font-bold text-[hsl(var(--primary))]">{displayName.charAt(0)}</div>
        <h2 className="mt-5 flex flex-wrap items-center gap-2 text-xl font-bold">
          {displayName}
          {profileQuery.data?.verified && <VerifiedBadge variant="inverse" display="label" testId="badge-verified-account" />}
        </h2>
        <p className="mt-1 text-xs text-white/55">{email}</p>
        <div className="mt-7 flex items-center gap-2 text-xs text-white/65"><CheckCircle2 size={16} className="text-[hsl(var(--accent))]" />{t('clerkSession')}</div>
      </section>
      <form onSubmit={saveChanges} className="space-y-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_8px_24px_hsl(155_20%_18%/.04)] sm:p-6">
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] pb-5"><UserRound size={18} className="text-[hsl(var(--primary))]" /><div><h3 className="text-sm font-bold">{t('personalInformation')}</h3><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('personalInformationHelp')}</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">{t('firstName')}<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required className="field-input" autoComplete="given-name" data-testid="input-account-first-name" /></label>
          <label className="field-label">{t('lastName')}<input value={lastName} onChange={(event) => setLastName(event.target.value)} className="field-input" autoComplete="family-name" data-testid="input-account-last-name" /></label>
            <label className="field-label">{t('phoneNumber')}<input value={phone} onChange={(event) => updatePhone(event.target.value)} type="tel" dir="ltr" className="field-input text-right" autoComplete="tel" placeholder={t('phonePlaceholder')} aria-invalid={phoneValidationAttempted && !pendingPhone && (phonePrefixRejected || (phone.trim() !== currentPhone && Boolean(phone.trim()) && !normalizeMauritaniaPhone(phone)))} data-testid="input-account-phone" />
             {phoneValidationAttempted && !pendingPhone && (phonePrefixRejected || (accountPhoneChanged && Boolean(phone.trim()) && !normalizedEditedPhone)) && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
              {profileQuery.data?.phoneVerified && <span className="mt-1 block text-xs font-medium text-[hsl(var(--primary))]">{t('phoneVerified')}</span>}
           </label>
          <label className="field-label">{t('email')}<input value={email || t('emailNotLinked')} readOnly dir="ltr" className="field-input cursor-not-allowed bg-[hsl(var(--muted)/.45)] text-right" data-testid="input-account-email" /></label>
        </div>
        {pendingPhone && <div className="rounded-xl border border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.1)] p-4">
          <label className="field-label">{t('verificationCode')}<span className="mt-1 block text-[11px] font-normal text-[hsl(var(--muted-foreground))]">{t('phoneVerificationSent')}</span><input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="field-input mt-3" dir="ltr" data-testid="input-account-phone-code" /></label>
          <button type="button" onClick={resendPhoneCode} disabled={isSaving || resendCountdown > 0} className="mt-3 text-xs font-semibold text-[hsl(var(--primary))] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-resend-phone-code">
            {t('resendCode')}{resendCountdown > 0 && <> (<span dir="ltr">{resendCountdown}s</span>)</>}
          </button>
        </div>}
        <div className="flex justify-end border-t border-[hsl(var(--border))] pt-5"><button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-save-account">{isSaving && <LoaderCircle size={15} className="animate-spin" />}{isSaving ? t('saving') : pendingPhone ? t('verifyAndContinue') : t('saveChanges')}</button></div>
      </form>
    </div>
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6" aria-labelledby="delete-account-heading" data-testid="account-deletion-section">
      <div className="flex items-start gap-3">
        <AlertTriangle size={19} className="mt-0.5 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1">
          <h2 id="delete-account-heading" className="text-sm font-bold text-red-900">{t('deleteAccount')}</h2>
          <p className="mt-2 text-xs leading-6 text-red-900/80">{t('deleteAccountDescription')}</p>
          <button type="button" onClick={deleteAccount} disabled={isDeleting || isSaving} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-delete-account">
            {isDeleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {isDeleting ? t('deletingAccount') : t('deleteAccount')}
          </button>
        </div>
      </div>
    </section>
  </AppShell>;
}
