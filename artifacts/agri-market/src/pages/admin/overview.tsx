import { useAdminMe, useAdminOverview, useUpdateListingStatus } from '@/hooks/use-admin';
import { AdminAnalyticsCharts } from '@/components/admin-analytics-charts';
import { AdminHeader, AdminBadge, AdminActionDialog, AdminTable, AdminTh, AdminTd } from '@/components/admin-ui';
import { ListingImage, RelativePublishedTime, StatCard, formatPrice } from '@/components/marketplace-ui';
import { Users, FileText, CheckCircle2, Clock, AlertTriangle, CreditCard, DollarSign, History } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/language';
import { ENABLE_PAID_LISTINGS } from '@/lib/features';
import { getAdminActionTranslationKey, getAdminResourceTranslationKey } from '@/lib/admin-activity';
import { useListingTaxonomy } from '@/lib/listing-taxonomy';
import { VerifiedBadge } from '@/components/verified-badge';

export function AdminOverview() {
  const { data, isLoading } = useAdminOverview();
  const { data: adminMe } = useAdminMe();
  const updateStatus = useUpdateListingStatus();
  const { language, t, formatDate, formatNumber, formatMoney } = useLanguage();
  const { categoryName } = useListingTaxonomy();

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-pulse w-full max-w-4xl h-96 bg-[hsl(38_22%_92%)] rounded-2xl"></div></div>;
  }

  const stats = data?.stats || {};
  const recent = data?.recentListings || [];
  const recentOperations = data?.recentOperations || [];

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)]">
      <AdminHeader 
        title={t('adminOverviewTitle')}
        description={t('adminOverviewDescription')}
      />
      
      <div className="min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <StatCard label={t('adminActiveListingsTotal')} value={formatNumber(stats.activeListings || 0)} icon={CheckCircle2} accent href="/admin/listings" />
          <StatCard label={t('adminPendingReviewListings')} value={formatNumber(stats.pendingReview || 0)} icon={Clock} href="/admin/listings" />
          <StatCard label={t('adminPendingPaymentListings')} value={formatNumber(stats.pendingPaymentListings || 0)} icon={CreditCard} href="/admin/payments" />
          <StatCard label={t('adminUsersTotal')} value={formatNumber(stats.users || 0)} icon={Users} href={adminMe?.role === 'admin' ? '/admin/users' : undefined} />
          <StatCard label={t('adminOpenReports')} value={formatNumber(stats.openReports || 0)} icon={AlertTriangle} href="/admin/reports" />
          
          <StatCard label={t('adminPendingPayments')} value={formatNumber(stats.pendingPayments || 0)} icon={CreditCard} href="/admin/payments" />
          <StatCard label={t('adminTotalRevenue')} value={formatMoney(Number(stats.revenue || 0), 'MRU')} icon={DollarSign} href="/admin/payments" />
          <StatCard label={t('adminListingsTotal')} value={formatNumber(stats.listings || 0)} icon={FileText} href="/admin/listings" />
        </div>

        <AdminAnalyticsCharts />

        {adminMe?.role === 'admin' && (
          <section aria-labelledby="admin-recent-operations-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="admin-recent-operations-title" className="flex items-center gap-2 text-lg font-bold text-[hsl(155_33%_23%)]">
                <History size={18} />
                {t('adminRecentOperations')}
              </h2>
              <Link href="/admin/audit-logs" className="text-sm font-bold text-[hsl(155_33%_23%)] hover:underline">{t('viewAll')}</Link>
            </div>
            <div className="divide-y divide-[hsl(38_22%_90%)] overflow-hidden rounded-xl border border-[hsl(38_22%_86%)] bg-white shadow-sm">
              {recentOperations.map((operation: any) => {
                const actionKey = getAdminActionTranslationKey(operation.action);
                const resourceKey = getAdminResourceTranslationKey(operation.resourceType);
                return (
                  <div key={operation.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-[hsl(155_33%_23%)]">
                        {actionKey ? t(actionKey as Parameters<typeof t>[0]) : operation.action}
                      </div>
                      <div className="text-xs text-[hsl(153_12%_43%)]">
                        {resourceKey ? t(resourceKey as Parameters<typeof t>[0]) : operation.resourceType}
                        {operation.resourceId != null && (
                          <span className="ms-1 font-numeric" dir="ltr">#{formatNumber(Number(operation.resourceId))}</span>
                        )}
                      </div>
                    </div>
                    <time className="shrink-0 text-xs text-[hsl(153_12%_43%)]" dateTime={new Date(operation.createdAt).toISOString()}>
                      {formatDate(operation.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                  </div>
                );
              })}
              {recentOperations.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-[hsl(153_12%_43%)]">{t('adminNoRecentOperations')}</p>
              )}
            </div>
          </section>
        )}

        {/* Recent Listings */}
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[hsl(155_33%_23%)]">{t('adminLatestListings')}</h2>
            <Link href="/admin/listings" className="text-sm font-bold text-[hsl(155_33%_23%)] hover:underline">{t('viewAll')}</Link>
          </div>
          
          <AdminTable>
            <thead>
              <tr>
                <AdminTh>{t('adminListing')}</AdminTh>
                <AdminTh>{t('adminSeller')}</AdminTh>
                <AdminTh>{t('price')}</AdminTh>
                <AdminTh>{t('status')}</AdminTh>
                <AdminTh>{t('adminPublishedDate')}</AdminTh>
                <AdminTh>{t('adminAction')}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {recent.map((listing: any) => (
                <tr key={listing.id} className="hover:bg-[hsl(42_37%_97%)] transition-colors">
                  <AdminTd>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[hsl(38_22%_86%)] overflow-hidden shrink-0">
                        <ListingImage
                          images={listing.images}
                          imageUrl={listing.imageUrl}
                          category={listing}
                          alt={listing.title}
                        />
                      </div>
                      <div>
                        <Link href={`/listings/${listing.id}`} target="_blank" className="font-bold text-[hsl(155_33%_23%)] hover:underline block max-w-[200px] truncate">
                          {listing.title}
                        </Link>
                        <span className="text-[11px] text-[hsl(153_12%_43%)]">{categoryName(listing.categorySlug, listing.category)}</span>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap items-center gap-1.5 font-bold">
                      <span>{listing.seller?.name || t('unknownSeller')}</span>
                      {listing.seller?.verified && <VerifiedBadge testId={`badge-verified-admin-listing-${listing.id}`} />}
                    </div>
                    <div className="text-[11px] text-[hsl(153_12%_43%)] font-numeric" dir="ltr">{listing.seller?.phone || '-'}</div>
                  </AdminTd>
                  <AdminTd>
                    <span className="font-numeric font-extrabold text-[hsl(155_33%_23%)]" dir="ltr">
                      {formatPrice(listing.price, listing.currency, language)}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    {listing.status === 'active' && <AdminBadge variant="success">{t('listingStatusActive')}</AdminBadge>}
                    {listing.status === 'pending_review' && <AdminBadge variant="warning">{t('listingStatusPendingReview')}</AdminBadge>}
                    {listing.status === 'draft' && <AdminBadge variant="neutral">{t('listingStatusDraft')}</AdminBadge>}
                    {listing.status === 'pending_payment' && <AdminBadge variant="info">{t('listingStatusPendingPayment')}</AdminBadge>}
                    {listing.status === 'rejected' && <AdminBadge variant="danger">{t('listingStatusRejected')}</AdminBadge>}
                    {listing.status === 'suspended' && <AdminBadge variant="danger">{t('listingStatusSuspended')}</AdminBadge>}
                  </AdminTd>
                  <AdminTd>
                    <RelativePublishedTime value={listing.createdAt} className="text-[12px]" />
                  </AdminTd>
                  <AdminTd>
                    <div className="flex gap-2">
                      {(listing.status === 'pending_payment' ||
                        (listing.status === 'pending_review' && ENABLE_PAID_LISTINGS)) && (
                        <Link href="/admin/payments" className="px-3 py-1.5 bg-[hsl(35_90%_50%)/0.15] text-[hsl(35_90%_45%)] text-[11px] font-bold rounded-lg hover:bg-[hsl(35_90%_50%)/0.25]">
                          {t('adminReviewPaymentToActivate')}
                        </Link>
                      )}
                      {listing.status === 'pending_review' && !ENABLE_PAID_LISTINGS && (
                        <AdminActionDialog
                          title={t('adminApproveListing')}
                          description={t('adminApproveListingDescription', { title: listing.title })}
                          confirmText={t('adminApprove')}
                          trigger={
                            <button
                              data-testid={`button-publish-listing-${listing.id}`}
                              className="px-3 py-1.5 bg-[hsl(155_33%_23%)] text-white text-[11px] font-bold rounded-lg hover:bg-[hsl(155_33%_18%)]"
                            >
                              {t('adminApprove')}
                            </button>
                          }
                          onConfirm={() => updateStatus.mutateAsync({ id: listing.id, status: 'active' })}
                        />
                      )}
                      {listing.status === 'pending_review' && (
                          <AdminActionDialog
                            title={t('adminRejectListing')}
                            description={t('adminRejectListingDescription', { title: listing.title })}
                            confirmText={t('adminReject')}
                            confirmVariant="danger"
                            requireReason
                            trigger={<button className="px-3 py-1.5 bg-[hsl(4_62%_48%)/0.1] text-[hsl(4_62%_48%)] text-[11px] font-bold rounded-lg hover:bg-[hsl(4_62%_48%)/0.2]">{t('adminReject')}</button>}
                            onConfirm={(reason) => updateStatus.mutateAsync({ id: listing.id, status: 'rejected', reason })}
                          />
                      )}
                    </div>
                  </AdminTd>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(153_12%_43%)]">
                    {t('adminNoListingsToShow')}
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </div>
      </div>
    </div>
  );
}
