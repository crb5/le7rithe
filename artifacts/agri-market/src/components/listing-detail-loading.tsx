import { useLanguage } from '@/lib/language';

// Shared geometry: the loading gallery must never use a fixed pixel height
// different from the responsive gallery it will be replaced with.
export const detailGridClass = 'grid min-w-0 max-w-full gap-8 xl:grid-cols-[minmax(0,1fr)_370px]';
export const detailGalleryClass = 'relative aspect-[16/9] md:aspect-[3/1] max-h-[420px] overflow-hidden rounded-[14px]';
export const detailBreadcrumbClass = 'mb-6 flex min-h-4 items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]';

function Placeholder({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[hsl(var(--muted))] motion-reduce:animate-none ${className}`} />;
}

export function ListingDetailLoading() {
  const { t } = useLanguage();
  return (
    <div role="status" aria-label={t('loading')} data-testid="listing-detail-loading">
      <div aria-hidden="true">
        <div className={detailBreadcrumbClass}><Placeholder className="h-4 w-40" /></div>
        <div className={detailGridClass}>
          <div>
            <div className="overflow-hidden rounded-3xl">
              <Placeholder className={`${detailGalleryClass} rounded-none`} />
            </div>
            <div className="mt-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Placeholder className="mb-2 h-4 w-40" />
                  <Placeholder className="h-9 w-2/3" />
                </div>
                <div className="flex items-center gap-2">
                  <Placeholder className="h-11 w-11" />
                  <Placeholder className="h-[46px] w-[46px]" />
                </div>
              </div>
              <section className="mt-5 min-w-0">
                <Placeholder className="mb-3 h-6 w-24" />
                <div className="rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_2px_8px_hsl(var(--primary)/.06)] sm:p-6">
                  <div className="h-36 space-y-4 pt-1">
                    {[0, 1, 2, 3, 4].map(line => <Placeholder key={line} className="h-3 w-full" />)}
                  </div>
                  <Placeholder className="mt-3 h-11 w-28" />
                </div>
              </section>
            </div>
            <section className="mt-7 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6">
              <Placeholder className="h-6 w-32" />
              <Placeholder className="mb-4 mt-1 h-5 w-2/3" />
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3, 4, 5].map(field => <Placeholder key={field} className="h-[65px]" />)}
              </div>
            </section>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <Placeholder className="h-6 w-24" />
              <Placeholder className="mt-1 h-8 w-40" />
              <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
                <Placeholder className="mb-3 h-4 w-32" />
                <div className="flex min-h-10 items-center gap-3">
                  <Placeholder className="h-10 w-10 rounded-full" />
                  <Placeholder className="h-9 w-36" />
                </div>
                <Placeholder className="mt-4 h-10 w-full rounded-xl" />
                <Placeholder className="mt-3 h-[41px] w-full rounded-xl" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
