import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { AdminHeader } from '@/components/admin-ui';
import { useAdminMe, useAdminPasswordChange } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';

export function AdminSecurity() {
  const { t, meta, language } = useLanguage();
  const { toast } = useToast();
  const { data: me } = useAdminMe();
  const changePassword = useAdminPasswordChange();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    changePassword.mutate(
      { currentPassword, newPassword, confirmPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          toast({
            title: t('adminPasswordChanged'),
            description: t('adminPasswordChangedDescription'),
          });
        },
        onError: (error) => {
          toast({
            title: t('adminPasswordChangeError'),
            description: error instanceof Error ? error.message : t('tryAgain'),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const minimumLength = me?.passwordPolicy.minimumLength ?? 12;
  const maximumLength = me?.passwordPolicy.maximumLength ?? 128;

  return (
    <div className="flex-1 bg-[hsl(38_44%_96%)]" dir={meta[language].dir}>
      <AdminHeader
        title={t('adminSecurityTitle')}
        description={t('adminSecurityDescription')}
      />
      <div className="min-w-0 p-4 sm:p-6 lg:p-8">
        <form
          onSubmit={submit}
          className="max-w-2xl rounded-2xl border border-[hsl(38_15%_87%)] bg-white p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start gap-3 border-b border-[hsl(38_15%_87%)] pb-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(346_42%_43%)/.18] text-[hsl(167_55%_24%)]">
              <KeyRound size={20} />
            </span>
            <div>
              <h2 className="font-bold text-[hsl(167_55%_24%)]">{t('adminPasswordChangeTitle')}</h2>
              <p className="mt-1 text-xs leading-6 text-[hsl(161_15%_42%)]">
                {t('adminPasswordChangeDescription')}
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-[hsl(167_55%_24%)/.16] bg-[hsl(167_55%_24%)/.05] p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[hsl(167_55%_24%)]" />
              <p className="text-xs leading-6 text-[hsl(167_55%_24%)]">
                {t('adminPasswordRequirements', { min: minimumLength, max: maximumLength })}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[hsl(167_55%_24%)]">
                {t('currentAdminPassword')}
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-[hsl(38_15%_87%)] bg-[hsl(38_33%_97%)] p-3 text-base outline-none focus:border-[hsl(167_55%_24%)] focus:ring-2 focus:ring-[hsl(167_55%_24%)/.12]"
                data-testid="input-current-admin-password"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[hsl(167_55%_24%)]">
                {t('newAdminPassword')}
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={minimumLength}
                maxLength={maximumLength}
                required
                className="w-full rounded-xl border border-[hsl(38_15%_87%)] bg-[hsl(38_33%_97%)] p-3 text-base outline-none focus:border-[hsl(167_55%_24%)] focus:ring-2 focus:ring-[hsl(167_55%_24%)/.12]"
                data-testid="input-new-admin-password"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[hsl(167_55%_24%)]">
                {t('confirmAdminPassword')}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={minimumLength}
                maxLength={maximumLength}
                required
                className="w-full rounded-xl border border-[hsl(38_15%_87%)] bg-[hsl(38_33%_97%)] p-3 text-base outline-none focus:border-[hsl(167_55%_24%)] focus:ring-2 focus:ring-[hsl(167_55%_24%)/.12]"
                data-testid="input-confirm-admin-password"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end border-t border-[hsl(38_15%_87%)] pt-5">
            <button
              type="submit"
              disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 rounded-xl bg-[hsl(167_55%_24%)] px-5 py-3 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
              data-testid="button-change-admin-password"
            >
              {changePassword.isPending && <Loader2 size={15} className="animate-spin" />}
              {changePassword.isPending ? t('adminPasswordChanging') : t('adminPasswordChangeSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}