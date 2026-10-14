import { useAuth } from '@/lib/auth';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getGetMyLegalConsentQueryKey, useSetListingFavorite, type Listing } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';
import { patchFavoriteCache } from './favorite-cache';

export const favoriteMutationKey = ['listing-favorite'];
export const favoriteSignInRequiredEvent = 'marketplace:favorite-sign-in-required';
type FavoriteContext = { snapshots: Array<[QueryKey, unknown]> };

const isFavoriteQuery = (queryKey: QueryKey) => {
  const path = queryKey[0];
  return typeof path === 'string'
    && (path === '/api/saved-listings' || /^\/api\/listings(?:\/\d+)?$/.test(path));
};

export function useToggleFavorite() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const mutation = useSetListingFavorite({
    mutation: {
      mutationKey: favoriteMutationKey,
      onMutate: ({ id, data }): FavoriteContext => {
        // Start cancellation first, but don't await it: the button's visual state
        // must update in this turn, not after in-flight reads finish cancelling.
        void queryClient.cancelQueries({ predicate: (query) => isFavoriteQuery(query.queryKey) });
        const snapshots = queryClient.getQueriesData({ predicate: (query) => isFavoriteQuery(query.queryKey) });
        const listing = snapshots.flatMap(([, value]) => {
          const rows = Array.isArray(value) ? value : value && typeof value === 'object' && 'items' in value && Array.isArray(value.items) ? value.items : [];
          return rows.filter((row): row is Listing => Boolean(row && typeof row === 'object' && 'id' in row && row.id === id));
        })[0];
        snapshots.forEach(([queryKey, old]) => {
          queryClient.setQueryData(
            queryKey,
            patchFavoriteCache(old, id, data.saved, listing, queryKey[0] === '/api/saved-listings'),
          );
        });
        return { snapshots };
      },
      onError: (error, _variables, context) => {
        context?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value));
        const status = error && typeof error === 'object' && 'status' in error
          && typeof error.status === 'number'
          ? error.status
          : null;
        const data = error && typeof error === 'object' && 'data' in error
          && error.data && typeof error.data === 'object'
          ? error.data as Record<string, unknown>
          : null;
        const code = typeof data?.code === 'string' ? data.code : null;
        const message = typeof data?.error === 'string' ? data.error : null;
        if (code === 'LEGAL_CONSENT_REQUIRED') {
          void queryClient.invalidateQueries({ queryKey: getGetMyLegalConsentQueryKey() });
        }
        const reason = code === 'LEGAL_CONSENT_REQUIRED'
          ? t('favoriteConsentRequired')
          : message === 'Account is suspended'
            ? t('favoriteAccountSuspended')
            : message === 'Cross-site request blocked'
              ? t('favoriteRequestBlocked')
              : status !== null
                ? `HTTP ${status}`
                : error instanceof TypeError
                  ? 'Network'
                  : 'Client';
        toast({ title: t('favoriteUpdateError'), description: reason, variant: 'destructive' });
        void queryClient.invalidateQueries({ predicate: (query) => isFavoriteQuery(query.queryKey) });
      },
    },
  });
  const requestSignIn = () => {
    window.dispatchEvent(new CustomEvent(favoriteSignInRequiredEvent, {
      detail: { redirectPath: window.location.pathname + window.location.search },
    }));
  };
  return {
    ...mutation,
    mutate: (variables: Parameters<typeof mutation.mutate>[0], options?: Parameters<typeof mutation.mutate>[1]) => {
      if (!userId) {
        requestSignIn();
        return;
      }
      if (queryClient.isMutating({ mutationKey: favoriteMutationKey })) return;
      mutation.mutate(variables, options);
    },
    mutateAsync: (...args: Parameters<typeof mutation.mutateAsync>) => {
      if (!userId) {
        requestSignIn();
        return Promise.resolve(undefined);
      }
      if (queryClient.isMutating({ mutationKey: favoriteMutationKey })) return Promise.resolve(undefined);
      return mutation.mutateAsync(...args);
    },
  };
}
