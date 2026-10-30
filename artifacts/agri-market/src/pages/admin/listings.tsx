import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminListings, useUpdateListingStatus, useUpdateListingFeatured, useDeleteListing } from '@/hooks/use-admin';
import { useAdminFetch } from '@/hooks/use-admin';
import { AdminHeader, AdminBadge, AdminActionDialog, AdminTable, AdminTh, AdminTd, Pagination, FilterInput, FilterSelect } from '@/components/admin-ui';
import { ListingImage, formatPrice } from '@/components/marketplace-ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { Link, useLocation } from 'wouter';
import { Star, Pin, Trash2, Edit } from 'lucide-react';
import { useListAdminCategories } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/language';
import { translatedName } from '@/lib/language';
import { useListingTaxonomy } from '@/lib/listing-taxonomy';
import { ENABLE_PAID_LISTINGS } from '@/lib/features';
import { VerifiedBadge } from '@/components/verified-badge';

export function AdminListings() {
  const [location] = useLocation();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => new URLSearchParams(location.split('?')[1] || '').get('status') || '');
  const [category, setCategory] = useState('');
  
  const categoriesQuery = useListAdminCategories();
  const { data, isLoading } = useAdminListings({ page, limit: 15, q, status, category });
  const updateStatus = useUpdateListingStatus();
  const updateFeatured = useUpdateListingFeatured();
  const deleteListing = useDeleteListing();
  const queryClient = useQueryClient();
  const adminFetch = useAdminFetch();
  const setRentalVisibility = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => adminFetch(`/admin/listings/${id}/rental-visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-listings'] }),
  });
  const { language, t, formatNumber, formatDate } = useLanguage();
  const { categoryName } = useListingTaxonomy();

  const items = data?.items || [];
  const total = data?.total || 0;

  const categoryOptions = [{ label: t('allCategories'), value: '' }].concat(
    (categoriesQuery.data || []).map(c => ({ label: translatedName(c, language), value: c.slug }))
  );

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminListingsTitle')}
        description={t('adminListingsDescription')}
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:mb-6">
          <FilterInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t('adminListingsSearchPlaceholder')} />
          <FilterSelect 
            value={status} 
            onChange={(v) => { setStatus(v); setPage(1); }} 
            options={[
              { label: t('allStatuses'), value: '' },
              { label: t('listingStatusActive'), value: 'active' },
              { label: t('listingStatusPendingReview'), value: 'pending_review' },
              { label: t('listingStatusPendingPayment'), value: 'pending_payment' },
              { label: t('listingStatusRejected'), value: 'rejected' },
              { label: t('listingStatusSuspended'), value: 'suspended' },
            ]} 
          />
          <FilterSelect 
            value={category} 
            onChange={(v) => { setCategory(v); setPage(1); }} 
            options={categoryOptions} 
          />
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-pulse w-full h-64 bg-white rounded-xl"></div></div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <AdminTable>
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <AdminTh>{t('adminIdentifier')}</AdminTh>
                  <AdminTh>{t('adminListing')}</AdminTh>
                  <AdminTh>{t('adminSeller')}</AdminTh>
                  <AdminTh>{t('price')}</AdminTh>
                  <AdminTh>{t('status')}</AdminTh>
                  <AdminTh>{t('adminActions')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {items.map((listing: any) => (
                  <tr key={listing.id} className={`hover:bg-[hsl(42_37%_97%)] transition-colors ${listing.featured ? 'bg-[hsl(42_87%_61%)/0.03]' : ''}`}>
                    <AdminTd className="font-numeric text-[11px] text-[hsl(153_12%_43%)]">#{formatNumber(Number(listing.id))}</AdminTd>
                    <AdminTd>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[hsl(38_22%_86%)] overflow-hidden shrink-0 shadow-sm">
                          <ListingImage
                            images={listing.images}
                            imageUrl={listing.imageUrl}
                            category={listing}
                            alt={listing.title}
                          />
                        </div>
                        <div>
                          <Link href={`/listings/${listing.id}`} target="_blank" className="font-bold text-[hsl(155_33%_23%)] hover:underline block max-w-[250px] truncate text-sm">
                            {listing.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-[hsl(153_12%_43%)]">{categoryName(listing.categorySlug, listing.category)}</span>
                            {listing.featured && <span className="inline-flex items-center text-[10px] font-bold text-[hsl(35_90%_45%)] bg-[hsl(35_90%_50%)/0.15] px-1.5 rounded"><Star size={10} className="mr-0.5 fill-current" /> {t('featured')}</span>}
                            {listing.pinned && <span className="inline-flex items-center text-[10px] font-bold text-[hsl(202_89%_45%)] bg-[hsl(202_89%_53%)/0.15] px-1.5 rounded"><Pin size={10} className="mr-0.5 fill-current" /> {t('pinned')}</span>}
                          </div>
                        </div>
                      </div>
                    </AdminTd>
                    <AdminTd>
                      <div className="flex flex-wrap items-center gap-1.5 font-bold">
                        <span>{listing.seller?.name || t('unknownSeller')}</span>
                        {listing.seller?.verified && <VerifiedBadge testId={`badge-verified-admin-listing-${listing.id}`} />}
                      </div>
                      <div className="text-[11px] text-[hsl(153_12%_43%)] font-numeric" dir="ltr">{listing.seller?.phone || '-'}</div>
                      <div className="text-[11px] text-[hsl(153_12%_43%)]"><span className="inline-flex items-center gap-1"><WhatsAppIcon size={13} className="text-[#25D366]" />{t('whatsappNumber')}:</span> <span className="font-numeric" dir="ltr">{listing.whatsappPhone || '-'}</span></div>
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
                      {listing.rentalSeasonArchivedAt && <AdminBadge variant="warning">{t('rentalArchivedLabel')}</AdminBadge>}
                      {listing.rentalAdminHiddenAt && <AdminBadge variant="danger">{t('rentalAdminHidden')}</AdminBadge>}
                    </AdminTd>
                    <AdminTd>
                      <div className="flex items-center gap-1.5">
                        {listing.attributes?.saleType === 'rent' && <button
                          type="button"
                          onClick={() => setRentalVisibility.mutate({ id: listing.id, hidden: !listing.rentalAdminHiddenAt })}
                          disabled={setRentalVisibility.isPending}
                          className="rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-bold disabled:opacity-50"
                        >{listing.rentalAdminHiddenAt ? t('rentalAdminShow') : t('rentalAdminHide')}</button>}
                        {listing.status === 'pending_review' && ENABLE_PAID_LISTINGS && (
                          <span className="max-w-[150px] text-[10px] leading-4 text-[hsl(153_12%_43%)]" title={t('adminActivationRequiresPayment')}>
                            {t('adminActivationRequiresPayment')}
                          </span>
                        )}

                        {listing.status === 'pending_payment' && (
                          <Link
                            href="/admin/payments"
                            className="max-w-[150px] text-[10px] leading-4 font-bold text-[hsl(35_90%_45%)] hover:underline"
                            title={t('adminReviewPaymentToActivate')}
                          >
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
                                className="px-3 py-1.5 bg-[hsl(155_33%_23%)] text-white text-[11px] font-bold rounded-lg hover:bg-[hsl(155_33%_18%)] transition-colors"
                              >
                                {t('adminApprove')}
                              </button>
                            }
                            onConfirm={() => updateStatus.mutateAsync({ id: listing.id, status: 'active' })}
                          />
                        )}
                        
                        {(listing.status === 'active' || listing.status === 'pending_review') && (
                          <AdminActionDialog
                            title={listing.status === 'active' ? t('adminSuspendListing') : t('adminRejectListing')}
                            description={t(listing.status === 'active' ? 'adminSuspendListingDescription' : 'adminRejectListingReasonDescription')}
                            confirmText={listing.status === 'active' ? t('adminSuspend') : t('adminReject')}
                            confirmVariant="danger"
                            requireReason
                            trigger={<button className="px-3 py-1.5 bg-[hsl(4_62%_48%)/0.1] text-[hsl(4_62%_48%)] text-[11px] font-bold rounded-lg hover:bg-[hsl(4_62%_48%)/0.2] transition-colors">{listing.status === 'active' ? t('adminSuspend') : t('adminReject')}</button>}
                            onConfirm={(reason) => updateStatus.mutateAsync({ id: listing.id, status: listing.status === 'active' ? 'suspended' : 'rejected', reason })}
                          />
                        )}

                        <div className="w-px h-6 bg-[hsl(38_22%_86%)] mx-1" />

                        <AdminActionDialog
                          title={listing.featured ? t('adminUnfeatureListing') : t('adminFeatureListing')}
                          description={t(listing.featured ? 'adminUnfeatureListingDescription' : 'adminFeatureListingDescription', { title: listing.title })}
                          trigger={
                            <button data-testid={`button-featured-listing-${listing.id}`} className={`p-2 rounded-lg transition-colors ${listing.featured ? 'text-[hsl(35_90%_45%)] bg-[hsl(35_90%_50%)/0.15] hover:bg-[hsl(35_90%_50%)/0.25]' : 'text-[hsl(153_12%_43%)] hover:bg-[hsl(42_37%_92%)]'}`} title={listing.featured ? t('adminUnfeatureListing') : t('adminFeatureListing')} aria-label={listing.featured ? t('adminUnfeatureListing') : t('adminFeatureListing')}>
                              <Star size={16} className={listing.featured ? "fill-current" : ""} />
                            </button>
                          }
                          onConfirm={() => updateFeatured.mutateAsync({ id: listing.id, featured: !listing.featured, pinned: listing.pinned })}
                        />

                        <AdminActionDialog
                          title={t('adminDeleteListingPermanently')}
                          description={t('adminDeleteListingDescription', { title: listing.title })}
                          confirmText={t('deleteListing')}
                          confirmVariant="danger"
                          trigger={
                            <button className="p-2 text-[hsl(153_12%_43%)] hover:text-[hsl(4_62%_48%)] hover:bg-[hsl(4_62%_48%)/0.1] rounded-lg transition-colors" title={t('deleteListing')} aria-label={t('deleteListing')}>
                              <Trash2 size={16} />
                            </button>
                          }
                          onConfirm={() => deleteListing.mutateAsync(listing.id)}
                        />
                      </div>
                    </AdminTd>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                      {t('adminNoMatchingListings')}
                    </td>
                  </tr>
                )}
              </tbody>
            </AdminTable>
            <Pagination page={page} limit={15} total={total} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
