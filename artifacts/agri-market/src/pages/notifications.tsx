import { Bell, Check, CheckCircle2, Clock3, X } from 'lucide-react';
import { Link } from 'wouter';
import { AppShell, EmptyState, PageHeading } from '@/components/marketplace-ui';
import { Spinner } from '@/components/ui/spinner';
import { useLanguage } from '@/lib/language';
import { useMarketplaceNotifications, useMarkMarketplaceNotificationRead } from '@/hooks/use-notifications';

const notificationDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function Notifications() {
  const { t, meta, language } = useLanguage();
  const query = useMarketplaceNotifications();
  const markRead = useMarkMarketplaceNotificationRead();
  const Icon = (type: string) => {
    if (type === 'listing_approved') return Check;
    if (type === 'listing_rejected') return X;
    return type === 'payment_status' ? CheckCircle2 : type === 'payment_pending' ? Clock3 : Bell;
  };

  return <AppShell><div dir={meta[language].dir} className="mx-auto max-w-4xl">
    <PageHeading eyebrow={t('notifications')} title={t('notifications')} description={t('notificationsDescription')} />
    {query.isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : !query.data?.items.length ? <EmptyState icon={Bell} title={t('noNotifications')} description={t('noNotificationsDescription')} /> : <div className="space-y-3">{query.data.items.map((item) => {
      const NotificationIcon = Icon(item.type);
      const isApproval = item.type === 'listing_approved';
      const isRejection = item.type === 'listing_rejected';
      const isListingDecision = isApproval || isRejection;
      const iconTone = isApproval
        ? 'bg-emerald-50 text-emerald-700'
        : isRejection
          ? 'bg-rose-50 text-rose-700'
          : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]';
      const cardClass = `block w-full rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-sm ${item.read ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.08)]'}`;
      const openItem = () => {
        if (!item.read) markRead.mutate(item.id);
      };
      const content = <>
        <span
          data-testid={`notification-status-icon-${item.id}`}
          aria-hidden="true"
          className={`mt-0.5 rounded-xl p-2 ${iconTone}`}
        >
          <NotificationIcon size={18} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="font-bold text-[hsl(var(--primary))]">{item.title}</span>
            {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--accent-foreground))]" aria-label={t('unreadNotification')} />}
          </span>
          <span className="mt-1 block whitespace-pre-line text-sm leading-6 text-[hsl(var(--muted-foreground))]">{item.body}</span>
          <time dateTime={item.createdAt} className="mt-2 block text-[11px] text-[hsl(var(--muted-foreground))]">
            {notificationDateFormatter.format(new Date(item.createdAt))}
          </time>
          {!item.read && !item.reportId && !isListingDecision && (
            <button type="button" onClick={() => markRead.mutate(item.id)} className="mt-2 rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]">
              {t('markAsRead')}
            </button>
          )}
        </span>
      </>;
      const itemHref = item.reportId
        ? `/reports/${item.reportId}`
        : isListingDecision && item.listingId
          ? `/listings/${item.listingId}`
          : null;

      return itemHref
        ? <Link key={item.id} href={itemHref} onClick={openItem} className={`${cardClass} flex items-start gap-4`} aria-label={item.reportId ? t('openReportDetails') : item.title}>{content}</Link>
        : <article key={item.id} className={`${cardClass} flex items-start gap-4`}>{content}</article>;
    })}</div>}
  </div></AppShell>;
}