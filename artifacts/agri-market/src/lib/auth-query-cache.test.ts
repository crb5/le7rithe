import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearSavedStateFromPublicListingData,
  isIdentityProtectedPath,
  isPublicListingDataQueryKey,
  isPublicMarketplaceQueryKey,
  shouldShowAuthLoadingScreen,
} from './auth-query-cache';

test('only protected paths use the full-page Clerk loading state', () => {
  assert.equal(isIdentityProtectedPath('/saved'), true);
  assert.equal(isIdentityProtectedPath('/account'), true);
  assert.equal(isIdentityProtectedPath('/account/complete-signup-phone'), true);
  assert.equal(isIdentityProtectedPath('/admin/users'), true);
  assert.equal(isIdentityProtectedPath('/'), false);
  assert.equal(isIdentityProtectedPath('/sign-in'), false);
  assert.equal(isIdentityProtectedPath('/sign-up'), false);
  assert.equal(isIdentityProtectedPath('/admin/login'), false);

  assert.equal(shouldShowAuthLoadingScreen(false, false, null, false), false);
  assert.equal(shouldShowAuthLoadingScreen(false, true, 'user-1', false), false);
  assert.equal(shouldShowAuthLoadingScreen(true, false, null, false), true);
  assert.equal(shouldShowAuthLoadingScreen(true, true, 'user-1', false), true);
  assert.equal(shouldShowAuthLoadingScreen(true, true, 'user-1', true), false);
});

test('preserves only explicitly public marketplace query caches', () => {
  assert.equal(isPublicMarketplaceQueryKey(['/api/banners']), true);
  assert.equal(isPublicMarketplaceQueryKey(['/api/categories']), true);
  assert.equal(isPublicMarketplaceQueryKey(['/api/categories/land/subcategories']), true);
  assert.equal(isPublicMarketplaceQueryKey(['/api/locations']), true);
  assert.equal(isPublicMarketplaceQueryKey(['/api/listings', { page: 1 }]), true);
  assert.equal(isPublicMarketplaceQueryKey(['/api/market-pulse']), true);

  assert.equal(isPublicMarketplaceQueryKey(['/api/saved-listings']), false);
  assert.equal(isPublicMarketplaceQueryKey(['/api/notifications']), false);
  assert.equal(isPublicMarketplaceQueryKey(['/api/listings/42']), false);
  assert.equal(isPublicMarketplaceQueryKey(['admin-overview']), false);
});

test('marks listing caches for identity-state scrubbing and refresh', () => {
  assert.equal(isPublicListingDataQueryKey(['/api/listings', { featured: true }]), true);
  assert.equal(isPublicListingDataQueryKey(['/api/market-pulse']), true);
  assert.equal(isPublicListingDataQueryKey(['/api/listings/42']), false);
});

test('clears saved flags recursively without mutating public listing data', () => {
  const original = {
    items: [{ id: 1, isSaved: true }, { id: 2, isSaved: false }],
    recentListings: [{ id: 3, isSaved: true }],
  };
  const safe = clearSavedStateFromPublicListingData(original);

  assert.deepEqual(safe, {
    items: [{ id: 1, isSaved: false }, { id: 2, isSaved: false }],
    recentListings: [{ id: 3, isSaved: false }],
  });
  assert.equal(original.items[0].isSaved, true);
  assert.equal(clearSavedStateFromPublicListingData(original.items[1]), original.items[1]);
});
