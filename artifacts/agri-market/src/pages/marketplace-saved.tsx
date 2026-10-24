import { Link } from 'wouter';
import { Bookmark } from 'lucide-react';
import { getListSavedListingsQueryKey, useListSavedListings } from '@workspace/api-client-react';
import { useToggleFavorite } from '@/lib/use-favorites';
import { Stagger, StaggerItem } from '@/components/motion';
import { AppShell, EmptyState, ErrorState, ForwardArrow, ListingCard, ListingSkeleton, PageHeading } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import type { Listing } from './marketplace-shared';


export function Saved() {
  const { t } = useLanguage();
  const savedQuery = useListSavedListings({ query: { queryKey: getListSavedListingsQueryKey() } });
  const toggleFavorite = useToggleFavorite();
  const remove = (listing: Listing) => toggleFavorite.mutateAsync({ id: listing.id, data: { saved: false } });
  return <AppShell>
    <PageHeading eyebrow={t('savedArea')} title={t('saved')} description={t('savedDescription')} />
    <div className="min-w-0 rounded-2xl bg-[hsl(var(--secondary)/.22)] p-1 sm:p-2">
      {savedQuery.isLoading ? <ListingSkeleton count={4} /> : savedQuery.isError ? <ErrorState onRetry={() => savedQuery.refetch()} /> : savedQuery.data?.length ? <Stagger className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{savedQuery.data.map((listing) => <StaggerItem key={listing.id}><ListingCard listing={{ ...listing, isSaved: true }} onSave={remove} /></StaggerItem>)}</Stagger> : <EmptyState icon={Bookmark} title={t('savedEmpty')} description={t('savedEmptyDescription')} action={<Link href="/listings" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-empty-saved">{t('browseListings')} <ForwardArrow size={15} /></Link>} />}
    </div>
  </AppShell>;
}
