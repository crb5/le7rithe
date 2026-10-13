import type { Listing } from '@workspace/api-client-react';

export function patchFavoriteCache(
  value: unknown,
  id: number,
  saved: boolean,
  listing?: Listing,
  savedList = false,
): unknown {
  if (Array.isArray(value)) {
    if (savedList && !saved) {
      return value.filter((item) => !(item && typeof item === 'object' && 'id' in item && item.id === id));
    }
    const next = value.map((item) => item && typeof item === 'object' && 'id' in item && item.id === id
      ? { ...item, isSaved: saved }
      : item);
    if (
      savedList
      && saved
      && listing
      && !next.some((item) => item && typeof item === 'object' && 'id' in item && item.id === id)
    ) {
      next.unshift({ ...listing, isSaved: true });
    }
    return next;
  }
  if (!value || typeof value !== 'object') return value;
  if ('items' in value && Array.isArray(value.items)) {
    return { ...value, items: patchFavoriteCache(value.items, id, saved, listing, savedList) };
  }
  if ('id' in value && value.id === id) return { ...value, isSaved: saved };
  return value;
}
