import { useState } from 'react';
import { Link } from 'wouter';
import { Edit3, Plus, Store, Trash2 } from 'lucide-react';
import { getListSellerActiveListingsQueryKey, getGetDashboardSummaryQueryKey, useDeleteListing, useGetDashboardSummary, useListSellerActiveListings, useMarkListingLeased, useMarkListingSold, useRenewRentalListing, useRevertListingSale, useUpdateListing } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, EmptyState, ErrorState, ListingImage, ListingSkeleton, PageHeading, SectionLink, formatPrice } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import { translateLocationName } from '@/lib/listing-localization';
import { useListingTaxonomy } from '@/lib/listing-taxonomy';
import { useToast } from '@/hooks/use-toast';
import type { Listing } from './marketplace-shared';
import { invalidateListingViews, SaleControls, EditListingDialog } from './marketplace-seller-shared';


export function SellerActiveListings() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categoryName } = useListingTaxonomy();
  const activeQuery = useListSellerActiveListings({
    query: { queryKey: getListSellerActiveListingsQueryKey() },
  });
  const dashboardQuery = useGetDashboardSummary();
  const deleteListing = useDeleteListing();
  const updateListing = useUpdateListing();
  const markSold = useMarkListingSold();
  const markLeased = useMarkListingLeased();
  const renewRental = useRenewRentalListing();
  const undoSale = useRevertListingSale();
  const [editing, setEditing] = useState<Listing | null>(null);

  const confirmDelete = (listing: Listing) => {
    if (!window.confirm(t('deleteListingConfirm', { title: listing.title }))) return;
    deleteListing.mutate({ id: listing.id }, {
      onSuccess: () => invalidateListingViews(queryClient, listing.id),
      onError: () => toast({ title: t('dataLoadError'), variant: 'destructive' }),
    });
  };
  const confirmMarkSold = (listing: Listing) => {
    if (listing.attributes?.saleType === 'rent') {
      if (!window.confirm(t('markAsLeasedConfirm', { title: listing.title }))) return;
      markLeased.mutate({ id: listing.id }, {
        onSuccess: () => invalidateListingViews(queryClient, listing.id),
        onError: () => toast({ title: t('leaseActionError'), variant: 'destructive' }),
      });
      return;
    }
    if (!window.confirm(t('markAsSoldConfirm', { title: listing.title }))) return;
    markSold.mutate({ id: listing.id }, {
      onSuccess: () => {
        toast({ title: t('saleMarked') });
        invalidateListingViews(queryClient, listing.id);
      },
      onError: () => toast({ title: t('saleActionError'), variant: 'destructive' }),
    });
  };
  const confirmUndoSale = (listing: Listing) => {
    undoSale.mutate({ id: listing.id }, {
      onSuccess: () => {
        toast({ title: t('saleReverted') });
        invalidateListingViews(queryClient, listing.id);
      },
      onError: () => toast({ title: t('saleActionError'), variant: 'destructive' }),
    });
  };

  return <AppShell>
    <PageHeading
      eyebrow={t('sellerSpace')}
      title={t('sellerActiveListingsTitle')}
      description={t('sellerActiveListingsDescription')}
      action={<Link href="/add-listing" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-active-listings-add"><Plus size={16} />{t('newListing')}</Link>}
    />
    <div className="mb-5">
      <SectionLink href="/dashboard">{t('dashboardTitle')}</SectionLink>
    </div>
    {activeQuery.isLoading
      ? <ListingSkeleton count={4} />
      : activeQuery.isError
        ? <ErrorState onRetry={() => activeQuery.refetch()} />
        : activeQuery.data?.length
          ? <div className="grid min-w-0 gap-3">
            {activeQuery.data.map((listing) => <article key={listing.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:gap-4 sm:p-4" data-testid={`card-seller-active-listing-${listing.id}`}>
              <Link href={`/listings/${listing.id}`} className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[hsl(var(--secondary))] sm:h-24 sm:w-32" aria-label={listing.title}>
                <ListingImage images={listing.images} imageUrl={listing.imageUrl} category={listing} alt={listing.title} loading="lazy" thumbnail />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/listings/${listing.id}`} className="line-clamp-2 text-sm font-bold text-[hsl(var(--primary))] hover:underline" data-testid={`link-seller-active-listing-${listing.id}`}>{listing.title}</Link>
                <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{categoryName(listing.categorySlug, listing.category)} · {translateLocationName(listing.location, language)}</p>
                <p className="mt-2 font-numeric text-sm font-bold" dir="ltr">{formatPrice(listing.price, listing.currency, language)}</p>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
                {listing.rentalSeasonArchivedAt ? <>
                  <span className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[10px] font-bold text-amber-900">{t('rentalArchivedLabel')}</span>
                  <button type="button" onClick={() => renewRental.mutate({ id: listing.id }, {
                    onSuccess: () => {
                      void queryClient.invalidateQueries({ queryKey: getListSellerActiveListingsQueryKey() });
                      void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                    },
                    onError: () => toast({ title: t('rentalSeasonActionError'), variant: 'destructive' }),
                  })} disabled={!dashboardQuery.data?.rentalSeasonOpen || renewRental.isPending}
                    className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                    {!dashboardQuery.data?.rentalSeasonOpen ? t('rentalSeasonClosed') : t('renewRental')}
                  </button>
                </> : <>
                {listing.rentalStatus !== 'leased' && <>
                  <button type="button" onClick={() => setEditing(listing)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]" aria-label={t('editListing')} data-testid={`button-edit-listing-${listing.id}`}><Edit3 size={15} /></button>
                  <button type="button" onClick={() => confirmDelete(listing)} disabled={deleteListing.isPending} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--primary))] disabled:opacity-50" aria-label={t('deleteListing')} data-testid={`button-delete-listing-${listing.id}`}><Trash2 size={15} /></button>
                </>}
                <SaleControls listing={listing} onMarkSold={confirmMarkSold} onUndoSale={confirmUndoSale} markPending={listing.attributes?.saleType === 'rent' ? markLeased.isPending : markSold.isPending} undoPending={undoSale.isPending} />
                </>}
              </div>
            </article>)}
          </div>
          : <EmptyState
            icon={Store}
            title={t('noActiveListings')}
            description={t('noActiveListingsDescription')}
            action={<Link href="/add-listing" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-empty-active-listings-add"><Plus size={15} />{t('newListing')}</Link>}
          />}
    {editing && <EditListingDialog
      listing={editing}
      onClose={() => setEditing(null)}
      onSaved={() => {
        setEditing(null);
        invalidateListingViews(queryClient, editing.id);
      }}
      mutation={updateListing}
    />}
  </AppShell>;
}
