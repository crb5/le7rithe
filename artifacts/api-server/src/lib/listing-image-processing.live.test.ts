// Explicit smoke check only: creates private NEW objects, never modifies listings or deletes files.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { listingImageInputId, processListingImage, readListingImageInput } from './listing-image-processing';
import { ObjectStorageService } from './objectStorage';

async function check() {
  const input = await readFile('attached_assets/image_1788862337169.jpg');
  const result = await processListingImage(input, 'image/jpeg');
  const metrics = {
    originalBytes: input.length,
    fullBytes: result.full.info.size,
    thumbnailBytes: result.thumbnail.info.size,
    width: result.full.info.width,
    height: result.full.info.height,
    thumbnailWidth: result.thumbnail.info.width,
    thumbnailHeight: result.thumbnail.info.height,
    storageVerified: false,
    corsVerified: false,
  };
  await writeFile('/tmp/image-performance/sample.json', JSON.stringify(metrics, null, 2));
  const storage = new ObjectStorageService();
  const owner = `image-verification-${randomUUID()}`;
  const id = randomUUID();
  const fullPath = `/objects/listing-images/${id}`;
  const thumbnailPath = `/objects/listing-images-thumbnails/${id}`;
  for (const [path, data] of [[fullPath, result.full.data], [thumbnailPath, result.thumbnail.data]] as const) {
    await storage.createPrivateImage(path, data, owner, { listingImageVersion: '1' });
    const file = await storage.getObjectEntityFile(path);
    const [metadata] = await file.getMetadata();
    assert.equal(metadata.contentType, 'image/webp');
    assert.equal(JSON.parse(String(metadata.metadata?.['custom:aclPolicy'])).visibility, 'private');
    assert.deepEqual(await readListingImageInput(file.createReadStream()), data);
  }
  await assert.rejects(storage.createPrivateImage(fullPath, Buffer.from('do not overwrite'), owner, {}));
  assert.deepEqual(await readListingImageInput((await storage.getObjectEntityFile(fullPath)).createReadStream()), result.full.data);
  metrics.storageVerified = true;
  await writeFile('/tmp/image-performance/sample.json', JSON.stringify(metrics, null, 2));
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const uploadURL = await storage.getObjectEntityUploadURL('listing-image-inputs', listingImageInputId(owner, randomUUID()));
  const preflight = await fetch(uploadURL, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(preflight.ok, true);
  assert.ok(['*', origin].includes(preflight.headers.get('Access-Control-Allow-Origin') ?? ''));
  assert.match(preflight.headers.get('Access-Control-Allow-Methods') ?? '', /PUT/);
  const upload = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: input });
  assert.equal(upload.ok, true);
  const inputPath = storage.normalizeObjectEntityPath(uploadURL);
  await storage.markObjectPrivate(inputPath, owner);
  assert.deepEqual(await readListingImageInput((await storage.getObjectEntityFile(inputPath)).createReadStream()), input);
  metrics.corsVerified = true;
  await writeFile('/tmp/image-performance/sample.json', JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics));
}
check().catch(() => { console.error('Private image storage verification failed; local processing metrics are in /tmp/image-performance/sample.json'); process.exitCode = 1; });
