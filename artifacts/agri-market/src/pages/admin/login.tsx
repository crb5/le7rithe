import { useEffect, useState } from 'react';
import { useUser, useSignInRedirect } from '@/lib/auth';
import { useLocation } from 'wouter';
import { Loader2, LockKeyhole } from 'lucide-react';
import { Logo } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import { SITE_NAME } from '@/lib/brand';
import { useAdminMe, useAdminPasswordLogin } from '@/hooks/use-admin';
import NotFound from '@/pages/not-found';

type AdminPasswordLoginError = Error & { code?: string };

export function AdminLogin() {
  const { user, isLoaded } = useUser();
  const signInRedirect = useSignInRedirect();
  const [, setLocation] = useLocation();
  const { language, meta, t } = useLanguage();
  const { data: me, isLoading: isMeLoading } = useAdminMe();
  const passwordLogin = useAdminPasswordLogin();
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user && me?.adminSessionActive) setLocation('/admin', { replace: true });
  }, [me?.adminSessionActive, setLocation, user]);

  // A signed-out visitor authenticates with the identity provider first.
  useEffect(() => {
    if (isLoaded && !user) void signInRedirect('/admin/login');
  }, [isLoaded, user, signInRedirect]);

  if (!isLoaded || (user && isMeLoading)) {
    return null;
  }

  if (!user) return null;

  if (!me || me.role !== 'admin') return <NotFound />;

  if (me.passwordSetupStatus === 'missing-secret' || me.passwordSetupStatus === 'invalid-secret') {
    const invalidSetup = me.passwordSetupStatus === 'invalid-secret';
    return (
      <div className="admin-text-flow min-h-[100dvh] bg-[hsl(38_44%_96%)] flex items-center justify-center p-4" dir={meta[language].dir}>
        <div className="max-w-md w-full bg-white border border-[hsl(4_62%_48%)/0.3] p-8 rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 bg-[hsl(346_42%_43%)/0.18] text-[hsl(167_55%_24%)] rounded-full flex items-center justify-center mx-auto mb-5"><LockKeyhole size={32} /></div>
          <h1 className="text-xl font-bold text-[hsl(167_55%_24%)] mb-2">{invalidSetup ? t('adminPasswordSetupInvalid') : t('adminPasswordSetupRequired')}</h1>
          <p className="text-sm text-[hsl(161_15%_42%)] leading-relaxed">{invalidSetup ? t('adminPasswordSetupInvalidDescription') : t('adminPasswordSetupRequiredDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-text-flow min-h-[100dvh] bg-[hsl(38_44%_96%)] flex flex-col items-center justify-center p-4 relative overflow-hidden" dir={meta[language].dir}>
      <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] rounded-full bg-[hsl(167_55%_24%)/0.03] blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[400px] h-[400px] rounded-full bg-[hsl(346_42%_43%)/0.05] blur-3xl pointer-events-none" />
      <div className="mb-8 scale-110 sm:mb-10 sm:scale-125"><Logo /></div>
      <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-3xl border border-[hsl(38_15%_87%)] bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]">
        <div className="bg-[hsl(167_45%_13%)] p-6 text-center text-white border-b border-[hsl(167_45%_13%)]">
          <h1 className="text-xl font-bold">{t('adminPortal')}</h1>
          <p className="text-xs text-[hsl(38_30%_94%)/0.7] mt-1 font-medium tracking-wide">{t('restrictedAccess')}</p>
        </div>
        <div className="p-5 pb-7 sm:p-8 sm:pb-10">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(346_42%_43%)/0.18] text-[hsl(167_55%_24%)]"><LockKeyhole size={24} /></div>
            <h2 className="text-lg font-bold text-[hsl(167_55%_24%)]">{t('adminPasswordTitle')}</h2>
            <p className="mt-2 text-xs leading-6 text-[hsl(161_15%_42%)]">{t('adminPasswordDescription')}</p>
          </div>
          {passwordLogin.isError && <div role="alert" data-testid="admin-password-error" className="mb-4 rounded-xl border border-[hsl(4_62%_48%)/0.25] bg-[hsl(4_62%_48%)/0.08] px-3 py-2 text-xs font-semibold text-[hsl(4_62%_48%)]">
            {(passwordLogin.error as AdminPasswordLoginError)?.code === 'ADMIN_PASSWORD_SETUP_MISSING'
              ? t('adminPasswordSetupRequiredDescription')
              : (passwordLogin.error as AdminPasswordLoginError)?.code === 'ADMIN_PASSWORD_SETUP_INVALID'
                ? t('adminPasswordSetupInvalidDescription')
                : t('adminPasswordInvalid')}
          </div>}
          <form onSubmit={(event) => { event.preventDefault(); passwordLogin.mutate(password); }} className="space-y-4">
            <label className="block text-xs font-bold text-[hsl(167_55%_24%)]" htmlFor="admin-password">{t('adminPasswordLabel')}
              <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-[hsl(38_15%_87%)] bg-white px-3.5 py-3 text-base outline-none focus:border-[hsl(167_55%_24%)] focus:ring-2 focus:ring-[hsl(167_55%_24%)/0.15]" />
            </label>
             <button type="submit" disabled={passwordLogin.isPending || !password} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[hsl(167_55%_24%)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[hsl(167_45%_15%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(346_42%_43%)] focus-visible:ring-offset-2 disabled:opacity-60">
              {passwordLogin.isPending ? <Loader2 size={18} className="animate-spin" /> : t('adminPasswordContinue')}
            </button>
          </form>
        </div>
      </div>
      <p className="mt-12 text-xs text-[hsl(161_15%_42%)] font-medium z-10">&copy; {new Date().getFullYear()} <bdi dir="ltr">{SITE_NAME}</bdi>. {t('footerRights')}</p>
    </div>
  );
}
