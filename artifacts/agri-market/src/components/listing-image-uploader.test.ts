import assert from 'node:assert/strict';
import { it } from 'node:test';
import { uploadImage } from './listing-image-uploader';

const inputPath = '/objects/listing-image-inputs/input-fixture';
const finalPath = '/objects/listing-images/11111111-1111-4111-8111-111111111111';
const messages = { storageUnavailable: 'storage unavailable', genericError: 'upload failed' };

it('finishes processing before returning a photo path and refreshes authentication after the PUT', async () => {
  const previous = globalThis.fetch;
  const calls: { url: string; body: unknown; authorization: string | null }[] = [];
  let tokens = 0;
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    calls.push({ url, body: options?.body, authorization: new Headers(options?.headers).get('Authorization') });
    const stage = calls.length;
    return new Response(stage === 1
      ? JSON.stringify({ uploadURL: 'https://storage.example.test/input', objectPath: inputPath })
      : stage === 3 ? JSON.stringify({ objectPath: finalPath }) : null, { status: 200 });
  };
  try {
    const file = new File(['fixture'], 'photo.jpg', { type: 'image/jpeg' });
    assert.equal(await uploadImage(file, file.name, messages, async () => `fixture-token-${++tokens}`), finalPath);
    assert.equal(calls[1].body, file);
    assert.equal(calls[1].authorization, null);
    assert.equal(calls[2].url, '/api/listing-image/uploads/process');
    assert.deepEqual(JSON.parse(String(calls[2].body)), { objectPath: inputPath });
    assert.equal(calls[2].authorization, 'Bearer fixture-token-2');
  } finally { globalThis.fetch = previous; }
});

it('does not return the unprocessed original when the server rejects image processing', async () => {
  const previous = globalThis.fetch;
  let stage = 0;
  globalThis.fetch = async () => {
    stage++;
    return stage === 1
      ? Response.json({ uploadURL: 'https://storage.example.test/input', objectPath: inputPath })
      : stage === 2 ? new Response(null, { status: 200 }) : Response.json({ error: 'Invalid image' }, { status: 400 });
  };
  try {
    await assert.rejects(uploadImage(new File(['invalid'], 'photo.jpg', { type: 'image/jpeg' }), 'photo.jpg', messages, async () => null), /upload failed/);
    assert.equal(stage, 3);
  } finally { globalThis.fetch = previous; }
});
