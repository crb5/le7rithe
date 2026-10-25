import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { useLocation } from 'wouter';
import { Search, SlidersHorizontal, Star } from 'lucide-react';
import { getListCategoriesQueryKey, getListListingsQueryKey, getListRegionsQueryKey, useListCategories, useListListings, useListRegions } from '@workspace/api-client-react';
import { useToggleFavorite } from '@/lib/use-favorites';
import { Stagger, StaggerItem } from '@/components/motion';
import { AppShell, EmptyState, ErrorState, ListingCard, ListingSkeleton, PageHeading, SearchBar } from '@/components/marketplace-ui';
import { dynamicFiltersForCategory } from '@/lib/category-catalog';
import { translatedName, useLanguage } from '@/lib/language';
import { translateLocationName } from '@/lib/listing-localization';
import { ListingFormSelect } from '@/components/listing-form-select';
import { categoriesFallback, FilterGroup, ALL_FILTER_VALUE, DynamicFilterControl } from './marketplace-shared';
import type { Listing } from './marketplace-shared';


export function Listings() {
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const queryParams = new URLSearchParams(window.location.search);
  const featuredOnly = queryParams.get('featured') === 'true';
  const [q, setQ] = useState(queryParams.get('q') ?? '');
  const [category, setCategory] = useState(queryParams.get('category') ?? '');
  const [subcategory, setSubcategory] = useState(queryParams.get('subcategory') ?? '');
  const [subcategoryNeedsCategory, setSubcategoryNeedsCategory] = useState(false);
  const [location, setFilterLocation] = useState(queryParams.get('location') ?? '');
  const [condition, setCondition] = useState(() => {
    const value = queryParams.get('condition');
    return value === 'new' || value === 'used' ? value : '';
  });
  const [sort, setSort] = useState(() => {
    const value = queryParams.get('sort');
    return value === 'price_asc' || value === 'price_desc' ? value : 'newest';
  });
  const [page, setPageState] = useState(1);
  const [loadedItems, setLoadedItems] = useState<Listing[]>([]);
  const appliedQueryRef = useRef('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const key of ['saleType', 'reference', 'brand', 'productType', 'condition', 'manufacturer', 'model', 'year']) {
      const value = queryParams.get(key);
      if (value) values[key] = value;
    }
    return values;
  });
  const [filtersOpen, setFiltersOpen] = useState(() => queryParams.get('filters') === 'open');
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const locationsQuery = useListRegions({ query: { queryKey: getListRegionsQueryKey() } });
  const categories = categoriesQuery.data ?? categoriesFallback;
  const selectedCategory = categories.find((item) => item.slug === category);
  const activeSubcategories = selectedCategory?.subcategories.filter((item) => item.active) ?? [];
  const dynamicFilters = dynamicFiltersForCategory(category);
  const params = useMemo(() => ({ q: q || undefined, category: category || undefined, subcategory: subcategory || undefined, location: location || undefined, saleType: dynamicValues.saleType || undefined, reference: dynamicValues.reference || undefined, brand: dynamicValues.brand || undefined, productType: dynamicValues.productType || undefined, condition: (dynamicValues.condition || condition || undefined) as 'new' | 'used' | undefined, manufacturer: dynamicValues.manufacturer || undefined, model: dynamicValues.model || undefined, year: dynamicValues.year ? Number(dynamicValues.year) : undefined, sort: sort as 'newest' | 'price_asc' | 'price_desc', featured: featuredOnly ? true : undefined, page, limit: 50 }), [q, category, subcategory, location, dynamicValues, condition, sort, featuredOnly, page]);
  const filterKey = useMemo(() => JSON.stringify({ ...params, page: undefined }), [params]);
  const listingsQuery = useListListings(params, { query: { queryKey: getListListingsQueryKey(params) } });
  const toggleFavorite = useToggleFavorite();
  const setPage = (next: SetStateAction<number>) => {
    if (typeof next === 'function' && listingsQuery.isFetching) return;
    setPageState(next);
  };
  useEffect(() => {
    setLoadedItems([]);
    appliedQueryRef.current = '';
    if (page !== 1) setPage(1);
  }, [filterKey]);
  useEffect(() => {
    const data = listingsQuery.data;
    if (!data || data.page !== page) return;
    const requestKey = `${filterKey}:${page}`;
    if (appliedQueryRef.current === requestKey) return;
    appliedQueryRef.current = requestKey;
    setLoadedItems((current) => {
      if (page === 1) return data.items;
      const existingIds = new Set(current.map((item) => item.id));
      return [...current, ...data.items.filter((item) => !existingIds.has(item.id))];
    });
  }, [filterKey, listingsQuery.data, page]);
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (category) next.set('category', category);
    if (subcategory) next.set('subcategory', subcategory);
    if (location) next.set('location', location);
    for (const [key, value] of Object.entries(dynamicValues)) if (value) next.set(key, value);
    if (condition && !dynamicValues.condition) next.set('condition', condition);
    if (sort !== 'newest') next.set('sort', sort);
    if (featuredOnly) next.set('featured', 'true');
    if (filtersOpen) next.set('filters', 'open');
    const nextSearch = next.toString();
    if (nextSearch !== window.location.search.replace(/^\?/, '')) {
      setLocation(`/listings${nextSearch ? `?${nextSearch}` : ''}`);
    }
  }, [q, category, subcategory, location, dynamicValues, condition, sort, featuredOnly, filtersOpen, page, setLocation]);
  const clearFilters = () => { setQ(''); setCategory(''); setSubcategory(''); setSubcategoryNeedsCategory(false); setFilterLocation(''); setCondition(''); setDynamicValues({}); setSort('newest'); setPage(1); };
  const items = loadedItems;
  const total = listingsQuery.data?.total ?? 0;
  const limit = listingsQuery.data?.limit ?? 50;
  const hasMore = page * limit < total;
  const isLoadingFirstPage = page === 1 && (listingsQuery.isLoading || (listingsQuery.isFetching && items.length === 0));
  const listingErrorMessage = import.meta.env.DEV && listingsQuery.error instanceof Error ? listingsQuery.error.message : undefined;
    return (
      <AppShell>
        <PageHeading
          eyebrow={t('openMarket')}
          title={featuredOnly ? t('featuredListings') : t('allListings')}
          description={t('browseListingsDescription')}
          action={
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary))] lg:hidden"
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal size={16} />
              {t('filters')}
            </button>
          }
        />
        <div className="mb-7 rounded-2xl bg-[hsl(var(--secondary)/.45)] p-2 sm:p-3">
          <SearchBar
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            onSubmit={() => setPage(1)}
          />
        </div>
        <div className="grid min-w-0 gap-7 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside
            className={`${filtersOpen ? 'block' : 'hidden'} rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 lg:block`}
            data-testid="listing-filters-panel"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold text-[hsl(var(--primary))]">{t('filterResults')}</h3>
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                data-testid="button-clear-filters"
              >
                {t('clearAll')}
              </button>
            </div>
            <FilterGroup title={t('mainCategory')}>
              <ListingFormSelect
                value={category || ALL_FILTER_VALUE}
                placeholder={t('allCategories')}
                direction={language === 'ar' ? 'rtl' : 'ltr'}
                options={[
                  { value: ALL_FILTER_VALUE, label: t('allCategories') },
                  ...categories.map((item) => ({
                    value: item.slug,
                    label: translatedName(item, language),
                  })),
                ]}
                onValueChange={(value) => {
                  setCategory(value === ALL_FILTER_VALUE ? '' : value);
                  setSubcategory('');
                  setSubcategoryNeedsCategory(false);
                  setDynamicValues({});
                }}
                testId="select-category"
              />
            </FilterGroup>
            <FilterGroup title={t('subcategory')}>
              <ListingFormSelect
                value={subcategory || ALL_FILTER_VALUE}
                placeholder={t('allSubcategories')}
                direction={language === 'ar' ? 'rtl' : 'ltr'}
                options={[
                  { value: ALL_FILTER_VALUE, label: t('allSubcategories') },
                  ...activeSubcategories.map((item) => ({
                    value: item.slug,
                    label: translatedName(item, language),
                  })),
                ]}
                ariaDisabled={!category || activeSubcategories.length === 0}
                ariaDescribedBy={subcategoryNeedsCategory ? 'filter-subcategory-help' : undefined}
                onUnavailableClick={() => {
                  if (!category) setSubcategoryNeedsCategory(true);
                }}
                onValueChange={(value) => {
                  setSubcategory(value === ALL_FILTER_VALUE ? '' : value);
                  setSubcategoryNeedsCategory(false);
                }}
                testId="select-subcategory"
              />
              {subcategoryNeedsCategory && (
                <span
                  id="filter-subcategory-help"
                  role="status"
                  data-testid="status-filter-subcategory-category-required"
                  className="mt-1 block text-xs font-medium text-[hsl(var(--primary))]"
                >
                  {t('chooseMainCategoryFirst')}
                </span>
              )}
            </FilterGroup>
            <FilterGroup title={t('location')}>
              <ListingFormSelect
                value={location || ALL_FILTER_VALUE}
                placeholder={t('allRegions')}
                direction={language === 'ar' ? 'rtl' : 'ltr'}
                options={[
                  { value: ALL_FILTER_VALUE, label: t('allRegions') },
                  ...(locationsQuery.data ?? []).map((item) => ({
                    value: item.name,
                    label: translateLocationName(item.name, language),
                  })),
                ]}
                onValueChange={(value) => setFilterLocation(value === ALL_FILTER_VALUE ? '' : value)}
                testId="select-location"
              />
            </FilterGroup>
            {dynamicFilters.map((field) => (
              <DynamicFilterControl
                key={field.key}
                field={field}
                value={dynamicValues[field.key] ?? ''}
                onChange={(value) =>
                  setDynamicValues((current) => ({ ...current, [field.key]: value }))
                }
              />
            ))}
            {!dynamicFilters.some((field) => field.key === 'condition') && (
              <FilterGroup title={t('condition')}>
                <div className="space-y-2">
                  {[
                    ['', t('all')],
                    ['new', t('new')],
                    ['used', t('used')],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 text-xs text-[hsl(var(--foreground))]"
                    >
                      <input
                        type="radio"
                        name="condition"
                        value={value}
                        checked={condition === value}
                        onChange={() => setCondition(value)}
                        className="accent-[hsl(var(--primary))]"
                        data-testid={`radio-condition-${value || 'all'}`}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </FilterGroup>
            )}
          </aside>
          <div className="min-w-0">
            <div className="mb-5 grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                <strong className="text-[hsl(var(--primary))]">
                  {t(listingsQuery.data?.total === 1 ? 'oneListingAvailable' : 'availableListings', { count: listingsQuery.data?.total ?? 0 })}
                </strong>
              </p>
              <ListingFormSelect
                value={sort}
                placeholder={t('newestFirst')}
                direction={language === 'ar' ? 'rtl' : 'ltr'}
                options={[
                  { value: 'newest', label: t('newestFirst') },
                  { value: 'price_asc', label: t('lowestPrice') },
                  { value: 'price_desc', label: t('highestPrice') },
                ]}
                onValueChange={(value) => {
                  setSort(value);
                  setPage(1);
                }}
                testId="select-sort"
              />
            </div>
            {listingsQuery.isLoading ? (
              <ListingSkeleton count={8} />
            ) : listingsQuery.isError ? (
              <ErrorState
                message={listingErrorMessage}
                onRetry={() => listingsQuery.refetch()}
              />
            ) : items.length ? (
              <>
                <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((listing) => (
                    <StaggerItem key={listing.id}>
                      <ListingCard
                        listing={listing}
                        onSave={(item) => toggleFavorite.mutateAsync({ id: item.id, data: { saved: !item.isSaved } })}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
                <ListingPagination
                  page={page}
                  limit={listingsQuery.data?.limit ?? 12}
                  total={listingsQuery.data?.total ?? 0}
                  onPageChange={setPage}
                  pending={listingsQuery.isFetching}
                />
              </>
            ) : (
              <EmptyState
                icon={featuredOnly ? Star : Search}
                title={featuredOnly ? t('noFeaturedListings') : t('noResults')}
                description={
                  featuredOnly
                    ? t('noFeaturedListingsDescription')
                    : t('noResultsDescription')
                }
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"
                    data-testid="button-empty-clear"
                  >
                    {t('showAllListings')}
                  </button>
                }
              />
            )}
          </div>
        </div>
      </AppShell>
    );
}


export function ListingPagination({ page, limit, total, onPageChange, pending }: { page: number; limit: number; total: number; onPageChange: (page: SetStateAction<number>) => void; pending: boolean }) {
  const { t } = useLanguage();
  const clickGuard = useRef(false);
  useEffect(() => { clickGuard.current = pending; }, [page, pending]);
  if (page * limit >= total) return null;

  return <div className="mt-10 flex justify-center border-t border-[hsl(var(--border))] pt-7" data-testid="listing-pagination">
    <button type="button" onClick={() => { if (clickGuard.current) return; clickGuard.current = true; onPageChange((current) => current + 1); }} disabled={pending} aria-busy={pending} className="inline-flex min-w-40 items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-60" data-testid="button-show-more">{pending ? t('loading') : t('showMore')}</button>
  </div>;
}
