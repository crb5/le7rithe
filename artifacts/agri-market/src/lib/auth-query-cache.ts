import type { QueryKey } from '@tanstack/react-query';

export function shouldShowAuthLoadingScreen(
  isProtectedRoute: boolean,
  isLoaded: boolean,
  userId: string | null | undefined,
  isUserLoaded: boolean,
): boolean {
  return isProtectedRoute && (!isLoaded || (Boolean(userId) && !isUserLoaded));
}

export function isIdentityProtectedPath(path: string): boolean {
  return path === '/add-listing'
    || [
      '/saved',
      '/support',
      '/notifications',
      '/payments',
      '/dashboard',
      '/dashboard/active-listings',
      '/account',
    ].includes(path)
    || /^\/reports\/[^/]+$/.test(path)
    || /^\/admin(?:\/|$)/.test(path) && path !== '/admin/login';
}

const PUBLIC_MARKETPLACE_QUERY_PATHS = new Set([
  '/api/banners',
  '/api/categories',
  '/api/locations',
  '/api/listings',
  '/api/market-pulse',
]);

export function isPublicMarketplaceQueryKey(queryKey: QueryKey): boolean {
  const path = queryKey[0];
  return typeof path === 'string' && (
    PUBLIC_MARKETPLACE_QUERY_PATHS.has(path)
    || /^\/api\/categories\/[^/]+\/subcategories$/.test(path)
  );
}

export function isPublicListingDataQueryKey(queryKey: QueryKey): boolean {
  return queryKey[0] === '/api/listings' || queryKey[0] === '/api/market-pulse';
}

/** Strip identity-specific saved state while keeping the public listing payload cached. */
export function clearSavedStateFromPublicListingData<T>(data: T): T {
  if (Array.isArray(data)) {
    let changed = false;
    const next = data.map((item) => {
      const safeItem = clearSavedStateFromPublicListingData(item);
      changed ||= safeItem !== item;
      return safeItem;
    });
    return (changed ? next : data) as T;
  }
  if (!data || typeof data !== 'object') return data;

  const record = data as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = { ...record };
  if (record.isSaved === true) {
    next.isSaved = false;
    changed = true;
  }
  for (const [key, value] of Object.entries(record)) {
    const safeValue = clearSavedStateFromPublicListingData(value);
    if (safeValue !== value) {
      next[key] = safeValue;
      changed = true;
    }
  }
  return (changed ? next : data) as T;
}
