import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { canonicalListingImageReference, isOwnedListingImageInput, listingImageInputId, LISTING_IMAGE_MAX_BYTES, processListingImage, readListingImageInput, withListingImageProcessing } from './listing-image-processing';

describe('new listing image processing', () => {
  it('retains canonical references when an edit mixes existing display URLs and new uploads', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    assert.equal(canonicalListingImageReference(`/api/listing-images/${id}`), `/objects/listing-images/${id}`);
    assert.equal(canonicalListingImageReference(`/objects/listing-images/${id}`), `/objects/listing-images/${id}`);
    assert.equal(canonicalListingImageReference('https://example.com/old.jpg'), 'https://example.com/old.jpg');
  });
  it('creates 1200px and 400px WebP variants, preserves proportions and strips metadata', async () => {
    const input = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#345678' } })
      .jpeg().withMetadata().toBuffer();
    const original = Buffer.from(input);
    const result = await processListingImage(input, 'image/jpeg');
    assert.deepEqual(input, original);
    for (const [variant, width, height] of [[result.full, 1200, 800], [result.thumbnail, 400, 267]] as const) {
      const metadata = await sharp(variant.data).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, height);
      assert.equal(metadata.exif, undefined);
    }
  });
  it('does not enlarge small images and correctly rotates phone EXIF orientation', async () => {
    const small = await sharp({ create: { width: 200, height: 100, channels: 4, background: '#34567880' } }).png().toBuffer();
    const result = await processListingImage(small, 'image/png');
    assert.equal(result.full.info.width, 200);
    assert.equal(result.thumbnail.info.width, 200);
    const portrait = await sharp({ create: { width: 2000, height: 3000, channels: 3, background: '#345678' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const rotated = await processListingImage(portrait, 'image/jpeg');
    assert.equal(rotated.full.info.width, 1200);
    assert.equal(rotated.full.info.height, 800);
  });
  it('rejects forged MIME, corrupt files, unsupported bytes, empty files and oversized files', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"></svg>');
    for (const [input, type] of [[svg, 'image/jpeg'], [svg, 'image/svg+xml'], [Buffer.from('not an image'), 'image/png'], [Buffer.alloc(0), 'image/webp'], [Buffer.alloc(LISTING_IMAGE_MAX_BYTES + 1), 'image/jpeg']] as const) {
      await assert.rejects(processListingImage(input, type));
    }
    const actualPng = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#345678' } }).png().toBuffer();
    await assert.rejects(processListingImage(actualPng, 'image/jpeg'));
  });
  it('checks actual streamed byte counts instead of trusting upload metadata', async () => {
    async function* chunks() { yield Buffer.alloc(LISTING_IMAGE_MAX_BYTES); yield Buffer.from('x'); }
    await assert.rejects(readListingImageInput(chunks()), /8 MB/);
  });
  it('only accepts new input paths belonging to the signed-in uploader', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const path = `/objects/listing-image-inputs/${listingImageInputId('seller-a', id)}`;
    assert.equal(isOwnedListingImageInput(path, 'seller-a'), true);
    assert.equal(isOwnedListingImageInput(path, 'seller-b'), false);
    assert.equal(isOwnedListingImageInput('/objects/listing-images/' + id, 'seller-a'), false);
    assert.equal(isOwnedListingImageInput(path + '/../other', 'seller-a'), false);
  });
  it('limits concurrent processing and releases slots after failures', async () => {
    let running = 0;
    let maximum = 0;
    await Promise.all(Array.from({ length: 8 }, (_, index) => withListingImageProcessing(async () => {
      running++;
      maximum = Math.max(maximum, running);
      await new Promise(resolve => setTimeout(resolve, 5));
      running--;
      if (index === 0) throw new Error('fixture failure');
    }).catch(() => undefined)));
    assert.equal(maximum, 2);
    assert.equal(await withListingImageProcessing(async () => 'ready'), 'ready');
  });
});
