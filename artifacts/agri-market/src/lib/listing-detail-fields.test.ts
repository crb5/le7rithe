import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Listing } from '@workspace/api-client-react';
import {
  dynamicFieldsForCategory,
  dynamicFiltersForCategory,
  formFieldsForCategory,
  LAND_ONLY_FIELD_KEYS,
} from './category-catalog';
import { listingDetailEntries, listingFieldValue } from './listing-detail-fields';

const completeLandListing = {
  id: 42,
  title: 'مزرعة تجريبية',
  category: 'الأراضي الزراعية',
  categorySlug: 'land',
  subcategory: 'ضفة النهر',
  subcategorySlug: 'river',
  price: 123456.5,
  currency: 'MRU',
  location: 'روصو',
  condition: 'used',
  year: 2020,
  manufacturer: 'مصنع تجريبي',
  model: 'موديل 7',
  hours: 450,
  area: 12.5,
  waterAvailable: false,
  electricityAvailable: true,
  ownershipType: 'ملكية خاصة',
  contactPhone: '+222 36 00 00 00',
  attributes: {
    saleType: 'sale',
    landCondition: 'reclaimed',
    region: 'روصو',
    customRegion: '',
    quantity: 8,
    productionDate: '2026-01-15',
    unknownFutureField: 'must remain visible',
  },
  description: 'وصف تجريبي كامل للإعلان.',
  imageUrl: '',
  images: [],
  seller: { id: 8, name: 'صاحب التجربة', initials: 'ص ت', verified: true, phone: '+222 36 00 00 00' },
  createdAt: '2026-01-15T10:00:00.000Z',
  featured: false,
  isSaved: false,
  saleStatus: 'available',
  soldAt: null,
  saleRevertUntil: null,
  canRevertSale: false,
} as Listing;

describe('listing detail field projection', () => {
  it('keeps every typed and dynamic value, including false, zero-like values, and future attributes', () => {
    const entries = listingDetailEntries(completeLandListing, dynamicFieldsForCategory('land'));
    const byKey = new Map(entries.map((entry) => [entry.key, entry.value]));

    assert.equal(byKey.get('location'), 'روصو');
    assert.equal(byKey.get('area'), 12.5);
    assert.equal(byKey.get('waterAvailable'), false);
    assert.equal(byKey.get('electricityAvailable'), true);
    assert.equal(byKey.get('saleType'), 'sale');
    assert.equal(byKey.get('quantity'), 8);
    assert.equal(byKey.get('productionDate'), '2026-01-15');
    assert.equal(byKey.get('unknownFutureField'), 'must remain visible');
  });

  it('uses the saved custom region and preserves typed fields when older records also contain attributes', () => {
    const listing = {
      ...completeLandListing,
      location: 'منطقة مخصصة',
      attributes: { ...completeLandListing.attributes, region: 'آخر', area: 99 },
    } as Listing;

    assert.equal(listingFieldValue(listing, 'customRegion'), 'منطقة مخصصة');
    assert.equal(listingFieldValue(listing, 'area'), 12.5);
    const entries = listingDetailEntries(listing, dynamicFieldsForCategory('land'));
    const keys = new Set(entries.map((entry) => entry.key));
    assert.equal(keys.has('location'), true);
    assert.equal(keys.has('region'), false);
    assert.equal(keys.has('customRegion'), false);
    assert.equal(listing.attributes?.region, 'آخر');
  });

  it('keeps region out of category forms and filters while retaining the legacy field definition for existing data', () => {
    const landFields = formFieldsForCategory('land');
    const serviceFields = formFieldsForCategory('services');

    assert.equal(landFields.some((field) => field.key === 'region'), false);
    assert.equal(landFields.some((field) => field.key === 'customRegion'), true);
    assert.equal(dynamicFieldsForCategory('land').some((field) => field.key === 'region'), false);
    assert.equal(dynamicFiltersForCategory('land').some((field) => field.key === 'region'), false);
    assert.equal(serviceFields.some((field) => field.key === 'contactPhone'), false);
    assert.equal(serviceFields.some((field) => field.key === 'servicePrice'), false);
    assert.equal(completeLandListing.attributes?.region, 'روصو');
  });

  it('falls back to legacy region attributes for the single location detail when location is missing', () => {
    const listing = {
      ...completeLandListing,
      location: '',
      attributes: { ...completeLandListing.attributes, region: 'آخر', customRegion: 'قرية قديمة' },
    } as Listing;

    assert.equal(listingFieldValue(listing, 'location'), 'قرية قديمة');
    const entries = listingDetailEntries(listing, dynamicFieldsForCategory('land'));
    assert.equal(entries.find((entry) => entry.key === 'location')?.value, 'قرية قديمة');
  });

  it('hides all land-only fields for other categories, even when stale typed values or attributes exist', () => {
    const tractorListing = {
      ...completeLandListing,
      category: 'الآليات الزراعية',
      categorySlug: 'tractors',
      attributes: {
        ...completeLandListing.attributes,
        area: 99,
        landCondition: 'reclaimed',
        region: 'روصو',
        customRegion: 'منطقة مخصصة',
        ownershipType: 'ملكية خاصة',
        waterAvailable: false,
        electricityAvailable: true,
      },
    } as Listing;
    const entries = listingDetailEntries(tractorListing, dynamicFieldsForCategory('tractors'));
    const keys = new Set(entries.map((entry) => entry.key));

    for (const key of LAND_ONLY_FIELD_KEYS) {
      assert.equal(keys.has(key), false, `${key} should not appear for tractors`);
    }
    assert.equal(keys.has('condition'), true);
    assert.equal(keys.has('saleType'), true);
  });
});