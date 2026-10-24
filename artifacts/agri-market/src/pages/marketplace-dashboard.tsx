import { useState } from 'react';
import { Link } from 'wouter';
import { BarChart3, Bookmark, Edit3, MoreHorizontal, Plus, Store, Trash2 } from 'lucide-react';
import { getGetDashboardSummaryQueryKey, useDeleteListing, useGetDashboardSummary, useMarkListingLeased, useMarkListingSold, useRenewRentalListing, useRevertListingSale, useUpdateListing } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, EmptyState, ErrorState, ListingImage, PageHeading, RelativePublishedTime, StatCard, formatPrice } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import { useToast } from '@/hooks/use-toast';
import type { Listing } from './marketplace-shared';
import { invalidateListingViews, SaleControls, EditListingDialog } from './marketplace-seller-shared';


export function Dashboard() {
  const { language, t, formatDate } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const deleteListing = useDeleteListing();
  const updateListing = useUpdateListing();
  const markSold = useMarkListingSold();
  const markLeased = useMarkListingLeased();
  const renewRental = useRenewRentalListing();
  const undoSale = useRevertListingSale();
  const [editing, setEditing] = useState<Listing | null>(null);
  const summary = summaryQuery.data!;
  // The dashboard render below is the single active implementation.
  const confirmDelete = (listing: Listing) => { if (window.confirm(t('deleteListingConfirm', { title: listing.title }))) deleteListing.mutate({ id: listing.id }, { onSuccess: () => invalidateListingViews(queryClient, listing.id) }); };
  const confirmMarkSold = (listing: Listing) => {
    if (listing.attributes?.saleType === 'rent') {
      if (!window.confirm(t('markAsLeasedConfirm', { title: listing.title }))) return;
      markLeased.mutate({ id: listing.id }, {
        onSuccess: () => {
          toast({ title: t('leased') });
          invalidateListingViews(queryClient, listing.id);
        },
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
  if (summaryQuery.isLoading) {
    return <AppShell><PageHeading eyebrow={t('sellerSpace')} title={t('dashboardTitle')} description={t('dashboardDescription')} action={<Link href="/add-listing" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-dashboard-add"><Plus size={16} />{t('newListing')}</Link>} /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />)}</div></AppShell>;
  }
  if (summaryQuery.isError || !summary) {
    return <AppShell><PageHeading eyebrow={t('sellerSpace')} title={t('dashboardTitle')} description={t('dashboardDescription')} /><ErrorState onRetry={() => summaryQuery.refetch()} /></AppShell>;
  }
  return <AppShell>
    <PageHeading eyebrow={t('sellerSpace')} title={t('dashboardTitle')} description={t('dashboardDescription')} action={<Link href="/add-listing" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-dashboard-add"><Plus size={16} />{t('newListing')}</Link>} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label={t('activeListings')} value={summary.listingCount} icon={Store} accent href="/dashboard/active-listings" />
      <StatCard label={t('saved')} value={summary.savedCount} icon={Bookmark} href="/saved" />
    </div>
    <div className="mt-8 grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_8px_24px_hsl(155_20%_18%/.04)]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5"><div><h2 className="font-bold text-[hsl(var(--primary))]">{t('recentListings')}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('recentListingsDescription')}</p></div><MoreHorizontal size={18} className="text-[hsl(var(--muted-foreground))]" /></div>
        <div>{summary.recentListings?.length ? summary.recentListings.map((listing) => <div key={listing.id} className="flex flex-wrap items-center gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0">
          <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--secondary))]">
            <ListingImage images={listing.images} imageUrl={listing.imageUrl} category={listing} alt="" loading="lazy" thumbnail />
          </div>
            <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold">{listing.title}</h3><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{formatPrice(listing.price, listing.currency, language)} · <RelativePublishedTime value={listing.createdAt} />{listing.rentalSeasonArchivedAt ? <> · <span className="font-bold text-amber-800">{t('rentalArchivedLabel')}</span></> : listing.attributes?.saleType === 'rent' && listing.rentalStatus === 'leased' ? <> · <span className="font-bold text-[hsl(var(--destructive))]">{t('leased')}</span></> : listing.saleStatus === 'sold' ? <> · <span className="font-bold text-[hsl(var(--destructive))]">{t('sold')}</span></> : null}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-1">{!listing.rentalSeasonArchivedAt && listing.saleStatus === 'available' && listing.rentalStatus !== 'leased' && <><button type="button" onClick={() => setEditing(listing)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]" aria-label={t('editListing')} data-testid={`button-edit-listing-${listing.id}`}><Edit3 size={15} /></button><button type="button" onClick={() => confirmDelete(listing)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))]" aria-label={t('deleteListing')} data-testid={`button-delete-listing-${listing.id}`}><Trash2 size={15} /></button></>}{!listing.rentalSeasonArchivedAt && <SaleControls listing={listing} onMarkSold={confirmMarkSold} onUndoSale={confirmUndoSale} markPending={listing.attributes?.saleType === 'rent' ? markLeased.isPending : markSold.isPending} undoPending={undoSale.isPending} />}</div>
        </div>) : <div className="p-8"><EmptyState title={t('noListingsYet')} description={t('noListingsYetDescription')} /></div>}</div>
      </section>
      <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-bold text-[hsl(var(--primary))]">{t('categoryDistribution')}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('categoryDistributionDescription')}</p></div><BarChart3 size={18} className="text-[hsl(var(--primary))]" /></div><div className="space-y-5">{summary.categoryCounts?.map((item, index) => <div key={item.category}><div className="mb-2 flex justify-between text-xs"><span>{item.category}</span><strong className="font-numeric" dir="ltr">{item.count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className={`h-full rounded-full ${index === 0 ? 'bg-[hsl(var(--primary))]' : index === 1 ? 'bg-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--chart-4))]'}`} style={{ width: `${Math.min(100, Math.max(8, item.count / Math.max(1, summary.listingCount) * 100))}%` }} /></div></div>)}</div></section>
    </div>
    {summary.archivedRentalListings.length > 0 && <section className="mt-7 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="border-b border-[hsl(var(--border))] p-5"><h2 className="font-bold text-[hsl(var(--primary))]">{t('archivedRentalCount')} ({summary.archivedRentalListings.length})</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('rentalSeasonArchiveNote')}</p></div>
      {summary.archivedRentalListings.map((listing) => <div key={listing.id} className="flex flex-wrap items-center gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0">
        <ListingImage images={listing.images} imageUrl={listing.imageUrl} category={listing} alt="" loading="lazy" thumbnail className="h-14 w-16 overflow-hidden rounded-lg" />
        <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold">{listing.title}</h3><p className="mt-1 text-[10px] text-amber-800">{t('rentalArchivedLabel')}</p></div>
        <button type="button" onClick={() => renewRental.mutate({ id: listing.id }, { onSuccess: () => invalidateListingViews(queryClient, listing.id), onError: () => toast({ title: t('rentalSeasonActionError'), variant: 'destructive' }) })} disabled={!summary.rentalSeasonOpen || summary.renewalFee > 0 || renewRental.isPending} className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">{!summary.rentalSeasonOpen ? t('rentalSeasonClosed') : t('renewRental')}</button>
      </div>)}
    </section>}
    {editing && <EditListingDialog listing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidateListingViews(queryClient, editing.id); }} mutation={updateListing} />}
  </AppShell>;
  /*
   return <AppShell><PageHeading eyebrow={t('sellerSpace')} title={t('dashboardTitle')} description={t('dashboardDescription')} action={<Link href="/add-listing" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-dashboard-add"><Plus size={16} />{t('newListing')}</Link>} />{summaryQuery.isLoading ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1,2,3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />)}</div> : summaryQuery.isError || !summary ? <ErrorState onRetry={() => summaryQuery.refetch()} /> : <><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label={t('activeListings')} value={summary.listingCount} icon={Store} accent /><StatCard label={t('newMessages')} value={summary.messageCount} icon={MessageCircle} /><StatCard label={t('saved')} value={summary.savedCount} icon={Bookmark} /></div><div className="mt-7 grid gap-7 xl:grid-cols-[1fr_330px]"><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5"><div><h2 className="font-bold text-[hsl(var(--primary))]">{t('recentListings')}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('recentListingsDescription')}</p></div><MoreHorizontal size={18} className="text-[hsl(var(--muted-foreground))]" /></div><div>{summary.recentListings?.length ? summary.recentListings.map((listing) => <div key={listing.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0"><div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--secondary))]">{listing.imageUrl ? <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[hsl(var(--primary))]"><Tractor size={22} /></div>}</div><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold">{listing.title}</h3><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{formatPrice(listing.price, listing.currency, language)} · {relativeDate(listing.createdAt, language)}{listing.expiresAt ? <> · {t('listingExpiresAtShort')}: <span dir="ltr">{formatDate(listing.expiresAt, { dateStyle: 'medium', timeStyle: 'short' })}</span></> : null}</p></div><div className="flex gap-1"><button type="button" onClick={() => setEditing(listing)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]" aria-label={t('editListing')} data-testid={`button-edit-listing-${listing.id}`}><Edit3 size={15} /></button><button type="button" onClick={() => confirmDelete(listing)} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))]" aria-label={t('deleteListing')} data-testid={`button-delete-listing-${listing.id}`}><Trash2 size={15} /></button></div></div>) : <div className="p-8"><EmptyState title={t('noListingsYet')} description={t('noListingsYetDescription')} /></div>}</div></section><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-bold text-[hsl(var(--primary))]">{t('categoryDistribution')}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('categoryDistributionDescription')}</p></div><BarChart3 size={18} className="text-[hsl(var(--primary))]" /></div><div className="space-y-5">{summary.categoryCounts?.map((item, index) => <div key={item.category}><div className="mb-2 flex justify-between text-xs"><span>{item.category}</span><strong className="font-numeric" dir="ltr">{item.count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className={`h-full rounded-full ${index === 0 ? 'bg-[hsl(var(--primary))]' : index === 1 ? 'bg-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--chart-4))]'}`} style={{ width: `${Math.min(100, Math.max(8, item.count / Math.max(1, summary.listingCount) * 100))}%` }} /></div></div>)}</div></section></div></>}{editing && <EditListingDialog listing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); }} mutation={updateListing} />}</AppShell>;
  */
}
