import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { patchFavoriteCache } from './favorite-cache.js';

const first = { id: 11, title: 'First', isSaved: false };
const second = { id: 22, title: 'Second', isSaved: false };

describe('favorite cache patches', () => {
  it('changes only the matching listing and preserves the feed order and length', () => {
    const updated = patchFavoriteCache([first, second], 22, true, first) as typeof first[];
    assert.deepEqual(updated, [first, { ...second, isSaved: true }]);
    assert.equal(updated.length, 2);
  });

  it('does not insert a listing missing from a feed page', () => {
    const page = { page: 1, items: [first, second] };
    const updated = patchFavoriteCache(page, 33, true, { id: 33, title: 'Third' }) as typeof page;
    assert.deepEqual(updated, page);
    assert.notEqual(updated, page);
  });

  it('keeps saved-list membership behavior separate from feed updates', () => {
    const listing = { id: 33, title: 'Third', isSaved: false };
    const added = patchFavoriteCache([first], 33, true, listing, true) as typeof first[];
    assert.deepEqual(added, [{ ...listing, isSaved: true }, first]);
    const removed = patchFavoriteCache(added, 33, false, listing, true) as typeof first[];
    assert.deepEqual(removed, [first]);
  });
});
