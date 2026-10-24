import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { CheckCircle2, LoaderCircle, MessageCircle, Phone, Send } from 'lucide-react';
import { useGetSupportSettings, useSendSupportMessage } from '@workspace/api-client-react';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { AppShell, PageHeading } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import { useToast } from '@/hooks/use-toast';


export function Support() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const settingsQuery = useGetSupportSettings();
  const reportsQuery = useQuery<{ items: Array<{ id: number; reason: string; details: string; status: string; createdAt: string; listing: { title: string } | null }> }>({
    queryKey: ['my-reports'],
    queryFn: async () => {
      const response = await fetch('/api/reports', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(t('dataLoadError'));
      return response.json();
    },
  });
  const sendSupport = useSendSupportMessage();
  const [message, setMessage] = useState('');
  const [requestContact, setRequestContact] = useState(false);

  const settings = settingsQuery.data;
  const phoneHref = settings?.phone ? `tel:${settings.phone.replace(/[^\d+]/g, '')}` : '';
  const whatsappNumber = settings?.whatsappPhone?.replace(/\D/g, '').replace(/^00/, '') ?? '';
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : '';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sendSupport.isPending) return;
    sendSupport.mutate(
      { data: { message: trimmedMessage, requestContact } },
      {
        onSuccess: () => {
          setMessage('');
          setRequestContact(false);
          toast({ title: t('supportMessageSent'), description: t('supportMessageSentDescription') });
        },
        onError: (error) => {
          toast({ title: t('supportMessageError'), description: error instanceof Error ? error.message : t('tryAgain'), variant: 'destructive' });
        },
      },
    );
  };

  return <AppShell>
    <PageHeading eyebrow={t('support')} title={t('supportTitle')} description={t('supportDescription')} />
    <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_350px]">
      <form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_10px_28px_hsl(155_20%_18%/.05)] sm:p-7">
        <div className="mb-6 flex items-start gap-3 border-b border-[hsl(var(--border))] pb-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.2)] text-[hsl(var(--primary))]"><MessageCircle size={20} /></span>
          <div>
            <h2 className="font-bold text-[hsl(var(--primary))]">{t('supportMessageTitle')}</h2>
            <p className="mt-1 text-xs leading-6 text-[hsl(var(--muted-foreground))]">{t('supportMessageHelp')}</p>
          </div>
        </div>
        <label className="field-label">
          {t('supportMessageLabel')}
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={5000}
            rows={7}
            className="field-input min-h-[170px] resize-y leading-7"
            placeholder={t('supportMessagePlaceholder')}
            data-testid="input-support-message"
          />
        </label>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)] p-4 text-sm">
          <input type="checkbox" checked={requestContact} onChange={(event) => setRequestContact(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-support-contact" />
          <span><strong className="block text-[hsl(var(--primary))]">{t('supportRequestContact')}</strong><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('supportRequestContactDescription')}</span></span>
        </label>
        <div className="mt-6 flex justify-end border-t border-[hsl(var(--border))] pt-5">
          <button type="submit" disabled={!message.trim() || sendSupport.isPending} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-send-support">
            {sendSupport.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
            {sendSupport.isPending ? t('sending') : t('sendSupportMessage')}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]">
          <h2 className="font-bold">{t('supportDirectContact')}</h2>
          <p className="mt-2 text-xs leading-6 text-white/65">{t('supportDirectContactDescription')}</p>
          <div className="mt-6 space-y-3">
            {phoneHref && <a href={phoneHref} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 text-sm font-bold transition hover:bg-white/15" dir="ltr" data-testid="link-support-phone"><Phone size={17} className="text-[hsl(var(--accent))]" /><span>{settings?.phone}</span></a>}
            {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-[hsl(142_60%_40%)/.85] p-3 text-sm font-bold transition hover:bg-[hsl(142_60%_35%)]" dir="ltr" data-testid="link-support-whatsapp"><WhatsAppIcon size={18} /><span>{settings?.whatsappPhone}</span></a>}
            {!settingsQuery.isLoading && !phoneHref && !whatsappHref && <p className="rounded-xl bg-white/10 p-3 text-xs leading-6 text-white/65">{t('supportContactsUnavailable')}</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]"><CheckCircle2 size={16} className="text-[hsl(var(--accent-foreground))]" />{t('supportResponseNote')}</div>
        </section>
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="font-bold text-[hsl(var(--primary))]">{t('reportDetailsTitle')}</h2>
          {reportsQuery.isLoading ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /> : reportsQuery.isError ? <p className="mt-3 text-xs leading-6 text-[hsl(var(--muted-foreground))]">{t('dataLoadError')}</p> : reportsQuery.data?.items.length ? <div className="mt-4 space-y-2">{reportsQuery.data.items.slice(0, 5).map((report) => <Link key={report.id} href={`/reports/${report.id}`} className="block rounded-xl border border-[hsl(var(--border))] p-3 transition hover:bg-[hsl(var(--secondary)/.5)]"><div className="flex items-center justify-between gap-2"><strong className="truncate text-xs text-[hsl(var(--primary))]">{report.listing?.title ?? t('supportRequest')}</strong><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${report.status === 'resolved' ? 'bg-[hsl(155_33%_23%/.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.2)] text-[hsl(35_90%_35%)]'}`}>{report.status === 'resolved' ? t('reportStatusResolved') : t('reportStatusOpen')}</span></div><p className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{report.details}</p></Link>)}</div> : <p className="mt-3 text-xs leading-6 text-[hsl(var(--muted-foreground))]">{t('reportNotFound')}</p>}
        </section>
      </aside>
    </div>
  </AppShell>;
}
