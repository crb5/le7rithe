import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CreditCard, FileClock, MessageCircle } from 'lucide-react';
import { Link } from 'wouter';
import { AppShell, EmptyState, PageHeading } from '@/components/marketplace-ui';
import { Spinner } from '@/components/ui/spinner';
import { useLanguage } from '@/lib/language';

type PaymentRow = {
  id: number;
  amount: string;
  currency: string;
  status: 'pending' | 'confirmed' | 'rejected';
  transactionReference: string;
  createdAt: string;
  listing?: { id: number; title: string } | null;
  package?: { name: string } | null;
  method?: { name: string } | null;
  proofAvailable: boolean;
};

const statusKey = {
  pending: 'paymentStatusPending',
  confirmed: 'paymentStatusConfirmed',
  rejected: 'paymentStatusRejected',
} as const;

export function Payments() {
  const { t, language, meta, formatMoney } = useLanguage();
  const query = useQuery<{ items: PaymentRow[] }>({
    queryKey: ['my-payments'],
    queryFn: async () => {
      const response = await fetch('/api/payments/mine', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(t('dataLoadError'));
      return response.json();
    },
  });
  return <AppShell><div dir={meta[language].dir} className="mx-auto w-full max-w-5xl min-w-0">
    <PageHeading eyebrow={t('sellerSpace')} title={t('myPayments')} description={t('myPaymentsDescription')} action={<Link href="/add-listing" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"><CreditCard size={15} />{t('startPaymentListing')}</Link>} />
    <div className="mb-6 rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.12)] p-5 text-sm leading-7 text-[hsl(var(--primary))] shadow-sm"><strong>{t('wherePaymentStarts')}</strong><p className="mt-1">{t('wherePaymentStartsDescription')}</p></div>
      {query.isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : query.isError ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{t('dataLoadError')}</p> : query.data?.items.length ? <div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm"><div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] px-5 py-3 text-[11px] font-bold text-[hsl(var(--muted-foreground))] sm:grid"><span>{t('paymentPackageOrService')}</span><span>{t('paymentMethod')}</span><span>{t('paymentAmount')}</span><span>{t('paymentDate')}</span></div>{query.data.items.map((payment) => <div key={payment.id} className="grid min-w-0 gap-4 border-b border-[hsl(var(--border))] px-4 py-5 last:border-0 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center sm:px-5"><div className="min-w-0"><strong className="block truncate text-sm text-[hsl(var(--primary))]">{payment.package?.name || t('paymentListingUpgrade')}</strong><span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{payment.listing?.title || '—'}</span></div><div className="min-w-0 text-xs">{payment.method?.name || '—'}<span className="mt-1 block truncate text-[10px] text-[hsl(var(--muted-foreground))]" dir="ltr">{payment.transactionReference}</span></div><div className="text-sm font-bold" dir="ltr">{formatMoney(Number(payment.amount), payment.currency)}</div><div className="flex flex-wrap items-center justify-between gap-3 text-xs"><span>{new Intl.DateTimeFormat(language === 'ar' ? 'ar-MR' : language === 'fr' ? 'fr-MR' : 'en-MR', { dateStyle: 'medium' }).format(new Date(payment.createdAt))}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${payment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{t(statusKey[payment.status])}</span></div>{!payment.proofAvailable && <div className="sm:col-span-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" data-testid={`payment-proof-unavailable-${payment.id}`}><p>{t('paymentProofUnavailable')}</p><Link href="/support" className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2" data-testid={`link-payment-support-${payment.id}`}><MessageCircle size={14} />{t('contactSupport')}</Link></div>}</div>)}</div> : <EmptyState icon={FileClock} title={t('noPaymentsYet')} description={t('noPaymentsYetDescription')} action={<Link href="/add-listing" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2">{t('startPaymentListing')} <ArrowRight size={15} /></Link>} />}
  </div></AppShell>;
}