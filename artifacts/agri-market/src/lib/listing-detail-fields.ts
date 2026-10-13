import type { Listing } from '@workspace/api-client-react';
import {
  LAND_CATEGORY_SLUG,
  LAND_ONLY_FIELD_KEYS,
  type DynamicField,
} from './category-catalog';

export type ListingDetailEntry = {
  key: string;
  value: unknown;
};

const commonFieldKeys = [
  'location',
  'condition',
  'year',
  'manufacturer',
  'model',
  'hours',
  'area',
  'waterAvailable',
  'electricityAvailable',
  'ownershipType',
] as const;

const getRecord = (listing: Listing) => listing as unknown as Record<string, unknown>;
const landOnlyFieldKeys = new Set<string>(LAND_ONLY_FIELD_KEYS);

export function listingFieldValue(listing: Listing, key: string): unknown {
  const record = getRecord(listing);
  const attributes = (listing.attributes ?? {}) as Record<string, unknown>;

  if (key === 'location' && !listing.location) {
    const legacyRegion = attributes.region;
    if (legacyRegion === 'آخر') return attributes.customRegion || listing.location;
    return legacyRegion || attributes.customRegion || listing.location;
  }
  if (key === 'region') return attributes.region || listing.location;
  if (key === 'customRegion') return attributes.customRegion || (attributes.region === 'آخر' ? listing.location : undefined);

  const typedValue = record[key];
  return typedValue ?? attributes[key];
}

export function listingDetailEntries(listing: Listing, dynamicFields: DynamicField[]): ListingDetailEntry[] {
  const entries: ListingDetailEntry[] = [];
  const seenKeys = new Set<string>();
  const add = (key: string, value: unknown) => {
    if (listing.categorySlug !== LAND_CATEGORY_SLUG && landOnlyFieldKeys.has(key)) return;
    if (listing.categorySlug === LAND_CATEGORY_SLUG && (key === 'region' || key === 'customRegion')) return;
    if (value === undefined || value === null || value === '' || seenKeys.has(key)) return;
    seenKeys.add(key);
    entries.push({ key, value });
  };

  for (const key of commonFieldKeys) add(key, listingFieldValue(listing, key));
  for (const field of dynamicFields) add(field.key, listingFieldValue(listing, field.key));

  for (const [key, value] of Object.entries(listing.attributes ?? {})) {
    add(key, value);
  }

  return entries;
}

export const listingCommonFieldKeys = commonFieldKeys;