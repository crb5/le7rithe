import { Bell, Check, ChevronDown, Clock3, ExternalLink, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  useAdminNotifications,
  useMarkAdminNotificationRead,
  type AdminNotificationFilter,
  type AdminNotification,
} from '@/hooks/use-admin';
import { AdminHeader } from '@/components/admin-ui';
import { useLanguage } from '@/lib/language';
import { VerifiedBadge } from '@/components/verified-badge';

function paymentStatusKey(status: string) {
  if (status === 'confirmed') return 'adminNotificationPaymentConfirmed';
  if (status === 'rejected') return 'adminNotificationPaymentRejected';
  return 'adminNotificationPaymentPending';
}

function listingStatusKey(status: string | null) {
  if (status === 'active') return 'listingStatusActive';
  if (status === 'pending_review') return 'listingStatusPendingReview';
  if (status === 'pending_payment') return 'listingStatusPendingPayment';
  if (status === 'rejected') return 'listingStatusRejected';
  if (status === 'suspended') return 'listingStatusSuspended';
  return 'notAvailable';
}

export function AdminNotifications() {
  const [location, setLocation] = useLocation();
  const requestedFilter = new URLSearchParams(location.split('?')[1] || '').get('filter');
  const filter: AdminNotificationFilter = requestedFilter === 'listings' || requestedFilter === 'reports'
    ? requestedFilter
    : 'all';
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useAdminNotifications(filter);
  const markRead = useMarkAdminNotificationRead();
  const { t, formatDate } = useLanguage();
  const notifications = data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCounts = data?.pages[0]?.unreadCounts;
  const filters: Array<{ value: AdminNotificationFilter; label: string }> = [
    { value: 'all', label: t('adminNotificationFilterAll') },
    { value: 'listings', label: t('adminNotificationFilterListings') },
    { value: 'reports', label: t('adminNotificationFilterReports') },
  ];

  const selectFilter = (nextFilter: AdminNotificationFilter) => {
    setLocation(`/admin/notifications?filter=${nextFilter}`);
  };

  const openNotification = (notification: AdminNotification) => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    if (notification.reportId) {
      setLocation(`/admin/reports?reportId=${encodeURIComponent(notification.reportId)}`);
      return;
    }
    const status = notification.listingStatus || 'pending_payment';
    setLocation(`/admin/listings?status=${encodeURIComponent(status)}`);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[hsl(38_44%_96%)]">
      <AdminHeader
        title={t('adminNotificationsTitle')}
        description={t('adminNotificationsDescription')}
      />

      <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <div
            aria-label={t('adminNotificationFiltersLabel')}
            className="flex flex-wrap gap-2 rounded-xl border border-[hsl(38_15%_87%)] bg-white p-2 shadow-sm"
          >
            {filters.map((option) => {
              const unreadCount = unreadCounts?.[option.value] ?? 0;
              const isSelected = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`admin-notification-filter-${option.value}`}
                  aria-pressed={isSelected}
                  onClick={() => selectFilter(option.value)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[hsl(346_42%_43%)] ${
                    isSelected
                      ? 'bg-[hsl(167_55%_24%)] text-white'
                      : 'text-[hsl(167_55%_24%)] hover:bg-[hsl(38_44%_96%)]'
                  }`}
                >
                  {option.label}
                  {unreadCount > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      isSelected
                        ? 'bg-[hsl(346_42%_43%)] text-[hsl(167_45%_13%)]'
                        : 'bg-[hsl(346_42%_43%)/.25] text-[hsl(167_55%_24%)]'
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-[hsl(38_15%_87%)] bg-white py-20 text-[hsl(161_15%_42%)]">
              <Loader2 className="animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[hsl(38_15%_80%)] bg-white px-6 py-20 text-center">
              <Bell className="mx-auto mb-4 text-[hsl(161_15%_52%)]" size={34} />
              <p className="font-semibold text-[hsl(167_55%_24%)]">{t('adminNoNotifications')}</p>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  data-testid={`admin-notification-${notification.id}`}
                  onClick={() => openNotification(notification)}
                  className={`group w-full rounded-xl border bg-white p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[hsl(346_42%_43%)] ${
                    notification.read
                      ? 'border-[hsl(38_15%_87%)]'
                      : 'border-[hsl(346_42%_43%)] bg-[hsl(346_42%_43%)/.08]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`mt-0.5 rounded-full p-2.5 ${
                      notification.read
                        ? 'bg-[hsl(167_45%_13%)/.08] text-[hsl(167_55%_24%)]'
                        : 'bg-[hsl(346_42%_43%)] text-[hsl(167_45%_13%)]'
                    }`}>
                      {notification.read ? <Check size={18} /> : <Bell size={18} />}
                      </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <span className="font-bold text-[hsl(167_55%_24%)]">
                          {notification.type === 'admin_new_report'
                            ? t('adminNotificationNewReport')
                            : t('adminNotificationNewListing')}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${
                          notification.read ? 'text-[hsl(161_15%_52%)]' : 'text-[hsl(4_62%_58%)]'
                        }`}>
                          {notification.read ? t('adminNotificationRead') : t('adminNotificationUnread')}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm text-[hsl(161_15%_42%)]">{notification.body}</span>
                      {notification.type === 'admin_new_report' ? (
                        <span className="mt-4 grid gap-3 text-xs text-[hsl(167_55%_24%)] sm:grid-cols-2">
                          <span><strong>{t('adminNotificationReport')}:</strong> #{notification.reportId}</span>
                          <span><strong>{t('adminNotificationListing')}:</strong> {notification.listingTitle || t('notAvailable')}</span>
                          <span className="flex items-center gap-1.5">
                            <Clock3 size={14} />
                            <strong>{t('adminNotificationCreatedAt')}:</strong>
                            <span>{formatDate(notification.createdAt, { dateStyle: 'full', timeStyle: 'short' })}</span>
                          </span>
                          <span><strong>{t('adminNotificationReportStatus')}:</strong> {t(notification.reportStatus === 'resolved' ? 'reportStatusResolved' : 'reportStatusOpen')}</span>
                        </span>
                      ) : (
                        <span className="mt-4 grid gap-3 text-xs text-[hsl(167_55%_24%)] sm:grid-cols-2">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <strong>{t('adminNotificationSeller')}:</strong>
                            {notification.sellerName || t('unknownSeller')}
                            {notification.sellerVerified && <VerifiedBadge testId={`badge-verified-notification-${notification.id}`} />}
                          </span>
                          <span><strong>{t('adminNotificationListing')}:</strong> {notification.listingTitle || t('notAvailable')}</span>
                          <span className="flex items-center gap-1.5">
                            <Clock3 size={14} />
                            <strong>{t('adminNotificationCreatedAt')}:</strong>
                            <span>{formatDate(notification.listingCreatedAt, { dateStyle: 'full', timeStyle: 'short' })}</span>
                          </span>
                          <span><strong>{t('adminNotificationPaymentStatus')}:</strong> {t(paymentStatusKey(notification.paymentStatus) as any)}</span>
                          <span><strong>{t('adminNotificationListingStatus')}:</strong> {t(listingStatusKey(notification.listingStatus) as any)}</span>
                        </span>
                      )}
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[hsl(167_55%_24%)] group-hover:text-[hsl(4_62%_58%)]">
                        {notification.type === 'admin_new_report'
                          ? t('adminNotificationOpenReports')
                          : t('adminNotificationOpenListings')}{' '}
                        <ExternalLink size={14} />
                      </span>
                    </span>
                  </div>
                </button>
              ))}
              {hasNextPage && (
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(38_15%_87%)] bg-white px-4 py-3 text-sm font-bold text-[hsl(167_55%_24%)] shadow-sm transition hover:bg-[hsl(38_44%_96%)] focus:outline-none focus:ring-2 focus:ring-[hsl(346_42%_43%)] disabled:cursor-wait disabled:opacity-60"
                >
                  {isFetchingNextPage ? <Loader2 className="animate-spin" size={16} /> : <ChevronDown size={16} />}
                  {isFetchingNextPage ? t('adminNotificationLoadingMore') : t('adminNotificationLoadMore')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}