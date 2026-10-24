import { useEffect, useState } from 'react';
import { MessageCircle, Phone, Save } from 'lucide-react';
import { AdminHeader } from '@/components/admin-ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { useAdminSupportSettings, useUpdateAdminSupportSettings } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';
import { hasAllowedMauritaniaPhonePrefix, normalizeMauritaniaPhone } from '@/lib/mauritania-phone';

export function AdminSupportSettings() {
  const { t, meta, language } = useLanguage();
  const { toast } = useToast();
  const settingsQuery = useAdminSupportSettings();
  const updateSettings = useUpdateAdminSupportSettings();
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [rejectedPhoneInputs, setRejectedPhoneInputs] = useState({ phone: false, whatsappPhone: false });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setPhone(settingsQuery.data.phone ?? '');
    setWhatsappPhone(settingsQuery.data.whatsappPhone ?? '');
  }, [settingsQuery.data]);

  const updatePhone = (key: 'phone' | 'whatsappPhone', value: string) => {
    if (!hasAllowedMauritaniaPhonePrefix(value)) {
      setRejectedPhoneInputs((current) => ({ ...current, [key]: true }));
      setValidationAttempted(true);
      return;
    }
    setRejectedPhoneInputs((current) => ({ ...current, [key]: false }));
    if (key === 'phone') setPhone(value);
    else setWhatsappPhone(value);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationAttempted(true);
    if (rejectedPhoneInputs.phone || rejectedPhoneInputs.whatsappPhone) return;
    if ((phone.trim() && !normalizeMauritaniaPhone(phone))
      || (whatsappPhone.trim() && !normalizeMauritaniaPhone(whatsappPhone))) return;
    updateSettings.mutate(
      { phone: phone.trim(), whatsappPhone: whatsappPhone.trim() },
      {
        onSuccess: () => toast({ title: t('supportSettingsSaved'), description: t('supportSettingsSavedDescription') }),
        onError: (error) => toast({ title: t('error'), description: error instanceof Error ? error.message : t('tryAgain'), variant: 'destructive' }),
      },
    );
  };
  const phoneInvalid = rejectedPhoneInputs.phone || (Boolean(phone.trim()) && !normalizeMauritaniaPhone(phone));
  const whatsappPhoneInvalid = rejectedPhoneInputs.whatsappPhone || (Boolean(whatsappPhone.trim()) && !normalizeMauritaniaPhone(whatsappPhone));

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full" dir={meta[language].dir}>
      <AdminHeader title={t('adminSupportSettingsTitle')} description={t('adminSupportSettingsDescription')} />
      <div className="min-w-0 p-4 sm:p-6 lg:p-8">
        <form onSubmit={save} className="max-w-2xl rounded-2xl border border-[hsl(38_22%_86%)] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-3 border-b border-[hsl(38_22%_86%)] pb-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(42_87%_61%)/.18] text-[hsl(155_33%_23%)]"><MessageCircle size={20} /></span>
            <div>
              <h2 className="font-bold text-[hsl(155_33%_23%)]">{t('supportSettingsContactTitle')}</h2>
              <p className="mt-1 text-xs leading-6 text-[hsl(153_12%_43%)]">{t('supportSettingsContactDescription')}</p>
            </div>
          </div>
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-[hsl(154_26%_15%)]"><Phone size={14} />{t('supportPhoneNumber')}</span>
              <input value={phone} onChange={(event) => updatePhone('phone', event.target.value)} type="tel" dir="ltr" aria-invalid={validationAttempted && phoneInvalid} className="w-full rounded-xl border border-[hsl(38_22%_86%)] bg-[hsl(42_37%_97%)] p-3 text-sm outline-none focus:border-[hsl(155_33%_23%)]" placeholder={t('supportPhonePlaceholder')} data-testid="input-admin-support-phone" />
              {validationAttempted && phoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{t('mauritaniaPhoneInvalid')}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-[hsl(154_26%_15%)]"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('supportWhatsappNumber')}</span>
              <input value={whatsappPhone} onChange={(event) => updatePhone('whatsappPhone', event.target.value)} type="tel" dir="ltr" aria-invalid={validationAttempted && whatsappPhoneInvalid} className="w-full rounded-xl border border-[hsl(38_22%_86%)] bg-[hsl(42_37%_96%)] p-3 text-sm outline-none focus:border-[hsl(155_33%_23%)]" placeholder={t('supportPhonePlaceholder')} data-testid="input-admin-support-whatsapp" />
              {validationAttempted && whatsappPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-red-700">{t('mauritaniaPhoneInvalid')}</span>}
              <span className="mt-1.5 block text-[11px] text-[hsl(153_12%_43%)]">{t('supportWhatsappHelp')}</span>
            </label>
          </div>
          <div className="mt-6 flex justify-end border-t border-[hsl(38_22%_86%)] pt-5">
            <button type="submit" disabled={updateSettings.isPending || settingsQuery.isLoading} className="inline-flex items-center gap-2 rounded-full bg-[hsl(155_33%_23%)] px-5 py-3 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50" data-testid="button-save-support-settings">
              <Save size={15} />{updateSettings.isPending ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}