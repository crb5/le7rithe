import { useParams } from 'wouter';
import { getGetSellerProfileQueryKey, useGetSellerProfile } from '@workspace/api-client-react';
import { AppShell, ErrorState } from '@/components/marketplace-ui';
import { SellerReviews } from '@/components/seller-reviews';
import { VerifiedBadge } from '@/components/verified-badge';
import { useLanguage } from '@/lib/language';
import NotFound from './not-found';

export function SellerProfile() {
  const { t, formatDate } = useLanguage();
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const sellerQuery = useGetSellerProfile(id, {
    query: {
      queryKey: getGetSellerProfileQueryKey(id),
      enabled: validId,
      retry: (attempt, error) => (error as { status?: number }).status !== 404 && attempt < 1,
    },
  });
  const seller = sellerQuery.data;

  if (!validId || (sellerQuery.error as { status?: number } | null)?.status === 404) return <NotFound />;
  if (sellerQuery.isLoading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-4" aria-hidden="true" data-testid="seller-profile-loading">
          <div className="h-32 rounded-2xl bg-[hsl(var(--muted))]" />
          <div className="h-40 rounded-2xl bg-[hsl(var(--muted))]" />
        </div>
      </AppShell>
    );
  }
  if (sellerQuery.isError || !seller) {
    return <AppShell><ErrorState onRetry={() => sellerQuery.refetch()} message={t('sellerProfileUnavailable')} /></AppShell>;
  }

  return (
    <AppShell>
      <section
        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_8px_24px_hsl(155_20%_18%/.04)]"
        data-testid="seller-profile-header"
      >
        <span className="mb-3 block text-[11px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{t('sellerProfileEyebrow')}</span>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xl font-bold text-[hsl(var(--primary))]">
            {seller.initials}
          </span>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-[hsl(var(--primary))]" data-testid="text-seller-name">
              {seller.name}
              {seller.verified && <VerifiedBadge display="label" testId={`badge-verified-seller-${seller.id}`} />}
            </h1>
            {!seller.verified && (
              <span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">{t('unverifiedSeller')}</span>
            )}
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              {t('memberSince')} {formatDate(seller.memberSince, { dateStyle: 'medium' })}
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t('sellerListingCount', { count: seller.listingCount })}
            </p>
          </div>
        </div>
      </section>
      <SellerReviews sellerId={seller.id} />
    </AppShell>
  );
}
