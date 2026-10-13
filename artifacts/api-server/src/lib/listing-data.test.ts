import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CreateListingBody, UpdateListingBody, UpdateMyAccountProfileBody } from '@workspace/api-zod';
import { listingContentEditable, listingFromBody, publishedListingUpdateValues } from './listing-data';
import { EDIT_WINDOW_MS, EDIT_WINDOW_MINUTES, listingContentEditRestriction } from '@workspace/api-zod/listing-edit-window';

describe('listingFromBody', () => {
  it('maps every listing field to the database shape without dropping false, zero, or attributes', () => {
    const body = {
      title: 'إعلان اختبار كامل',
      category: 'land',
      subcategory: 'river',
      price: 0,
      currency: 'ALT',
      location: 'روصو',
      condition: 'used' as const,
      year: 2020,
      manufacturer: 'مصنع تجريبي',
      model: 'موديل 0',
      hours: 0,
      area: 0,
      waterAvailable: false,
      electricityAvailable: true,
      ownershipType: 'ملكية خاصة',
      attributes: {
        saleType: 'sale',
        landCondition: 'reclaimed',
        reference: 'REF-0',
        productionDate: '2026-01-15',
        unknownFutureField: 'preserve me',
      },
      description: 'وصف اختبار طويل بما يكفي للتحقق.',
      contactPhone: '+222 36 00 00 00',
      whatsappPhone: '+222 41 22 33 44',
      imageUrl: 'https://example.com/main.jpg',
      images: ['https://example.com/main.jpg', 'https://example.com/second.jpg'],
    };

    const values = listingFromBody(body, 7, 3, 9);

    assert.deepEqual(values, {
      sellerId: 7,
      contactPhone: body.contactPhone,
      whatsappPhone: body.whatsappPhone,
      title: body.title,
      categoryId: 3,
      subcategoryId: 9,
      price: '0',
      currency: 'MRU',
      location: body.location,
      condition: body.condition,
      year: body.year,
      manufacturer: body.manufacturer,
      model: body.model,
      hours: 0,
      area: '0',
      waterAvailable: false,
      electricityAvailable: true,
      ownershipType: body.ownershipType,
      attributes: body.attributes,
      description: body.description,
      imageUrl: body.images[0],
      images: body.images,
    });
  });
});

describe('mass-assignment boundaries', () => {
  it('rejects status, role, and featured fields on listing creation', () => {
    const body = {
      title: 'Tractor',
      category: 'equipment',
      price: 100,
      currency: 'MRU',
      location: 'Nouakchott',
      condition: 'used' as const,
      description: 'A listing description long enough.',
      contactPhone: '+22220000000',
    };
    assert.equal(CreateListingBody.strict().safeParse({ ...body, status: 'active' }).success, false);
    assert.equal(CreateListingBody.strict().safeParse({ ...body, role: 'admin' }).success, false);
    assert.equal(CreateListingBody.strict().safeParse({ ...body, featured: true }).success, false);
  });

  it('rejects role/status/featured injection on account updates and role injection on listing updates', () => {
    assert.equal(UpdateMyAccountProfileBody.strict().safeParse({ name: 'A User', role: 'admin' }).success, false);
    assert.equal(UpdateMyAccountProfileBody.strict().safeParse({ name: 'A User', status: 'active' }).success, false);
    assert.equal(UpdateMyAccountProfileBody.strict().safeParse({ name: 'A User', featured: true }).success, false);
    assert.equal(UpdateListingBody.strict().safeParse({
      price: 10, currency: 'MRU', contactPhone: '+22220000000', role: 'admin',
    }).success, false);
  });
});

describe('publishedListingUpdateValues', () => {
  it('writes only price, currency, and phone values that were actually changed', () => {
    const body = UpdateListingBody.parse({
      price: 12500,
      currency: 'ALT',
      contactPhone: '+222 36 12 34 56',
      whatsappPhone: '+222 41 23 45 67',
      title: 'Must stay unchanged',
      category: 'must-stay-unchanged',
      status: 'pending_review',
      revision: 99,
      expiresAt: null,
    });

    assert.deepEqual(body, {
      price: 12500,
      currency: 'ALT',
      contactPhone: '+222 36 12 34 56',
      whatsappPhone: '+222 41 23 45 67',
    });
    assert.deepEqual(publishedListingUpdateValues(body, {}), {
      price: '12500',
      currency: 'MRU',
    });
    assert.deepEqual(publishedListingUpdateValues(body, {
      contactPhone: '+222 36 12 34 56',
      whatsappPhone: null,
    }), {
      price: '12500',
      currency: 'MRU',
      contactPhone: '+222 36 12 34 56',
      whatsappPhone: null,
    });
  });
});

describe('limited content edits', () => {
  it('closes exactly at the shared deadline and rejects invalid or future timestamps', () => {
    const now = Date.parse('2026-10-07T10:00:00Z');
    assert.equal(listingContentEditable(new Date(now), now), true);
    assert.equal(listingContentEditable(new Date(now - EDIT_WINDOW_MS + 1), now), true);
    assert.equal(listingContentEditable(new Date(now - EDIT_WINDOW_MS), now), false);
    assert.equal(listingContentEditable(new Date(now - EDIT_WINDOW_MS - 1), now), false);
    assert.equal(listingContentEditable(new Date(now + 1), now), false);
    assert.equal(listingContentEditable('invalid', now), false);
  });
  it('accepts content before the deadline and returns a clear 403 at or after it', () => {
    const publishedAt = new Date('2026-10-07T09:00:00Z');
    for (const content of [{ description: 'An updated description' }, { images: [] }]) {
      assert.equal(listingContentEditRestriction(content, publishedAt, publishedAt.getTime() + EDIT_WINDOW_MS - 1), null);
      for (const now of [publishedAt.getTime() + EDIT_WINDOW_MS, publishedAt.getTime() + EDIT_WINDOW_MS + 1]) {
        const denied = listingContentEditRestriction(content, publishedAt, now);
        assert.equal(denied?.status, 403);
        assert.equal(denied?.code, 'LISTING_CONTENT_EDIT_WINDOW_CLOSED');
        assert.match(denied?.error ?? '', new RegExp(`${EDIT_WINDOW_MINUTES} minutes`));
      }
    }
  });
  it('does not apply the deadline to price, phone, or WhatsApp', () => {
    const body = UpdateListingBody.parse({
      price: 25, currency: 'MRU', contactPhone: '+22220000000', whatsappPhone: '+22230000000',
    });
    assert.equal(listingContentEditRestriction(body, new Date(0), EDIT_WINDOW_MS * 100), null);
    assert.deepEqual(publishedListingUpdateValues(body, {
      contactPhone: body.contactPhone, whatsappPhone: body.whatsappPhone,
    }), { price: '25', currency: 'MRU', contactPhone: body.contactPhone, whatsappPhone: body.whatsappPhone });
  });
  it('writes explicitly supplied content without allowing title or moderation edits', () => {
    const body = UpdateListingBody.parse({
      price: 20, currency: 'MRU', contactPhone: '+22220000000',
      description: 'Updated description', images: ['/objects/new-photo'],
      title: 'Locked title', status: 'active',
    });
    assert.deepEqual(publishedListingUpdateValues(body, {}), {
      price: '20', currency: 'MRU', description: 'Updated description',
      images: ['/objects/new-photo'], imageUrl: '/objects/new-photo',
    });
    assert.equal(UpdateListingBody.safeParse({ ...body, images: Array(9).fill('/objects/photo') }).success, false);
  });
});