import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const LISTING_IMAGE_MAX_BYTES = 8_000_000;
export const LISTING_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PIXELS = 40_000_000;

export class InvalidListingImageError extends Error {}

export function canonicalListingImageReference(path: string) {
  const match = /^\/api\/listing-images\/([0-9a-f-]{36})(?:\?variant=thumbnail)?$/i.exec(path);
  return match ? `/objects/listing-images/${match[1]}` : path;
}

export function listingImageInputId(owner: string, id: string) {
  return `${createHash('sha256').update(owner).digest('hex').slice(0, 32)}-${id}`;
}

export function isOwnedListingImageInput(path: unknown, owner: string): path is string {
  if (typeof path !== 'string') return false;
  const prefix = `/objects/listing-image-inputs/${listingImageInputId(owner, '')}`;
  return path.startsWith(prefix) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path.slice(prefix.length));
}

export async function readListingImageInput(stream: AsyncIterable<Uint8Array>) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > LISTING_IMAGE_MAX_BYTES) throw new InvalidListingImageError('Image exceeds the 8 MB limit');
    chunks.push(Buffer.from(chunk));
  }
  if (!size) throw new InvalidListingImageError('Image is empty');
  return Buffer.concat(chunks, size);
}

export async function processListingImage(input: Buffer, contentType: string) {
  if (!LISTING_IMAGE_TYPES.has(contentType) || !input.length || input.length > LISTING_IMAGE_MAX_BYTES) {
    throw new InvalidListingImageError('Only JPG, PNG and WebP images up to 8 MB are accepted');
  }
  try {
    const options = { limitInputPixels: MAX_PIXELS, failOn: 'warning' as const };
    const metadata = await sharp(input, options).metadata();
    const expectedFormat = contentType === 'image/jpeg'
      ? 'jpeg'
      : contentType === 'image/png'
        ? 'png'
        : 'webp';
    if (metadata.format !== expectedFormat || (metadata.pages ?? 1) > 1) {
      throw new InvalidListingImageError('Unsupported image content');
    }
    // Auto-orient before resizing; WebP output strips EXIF/GPS and other metadata.
    const full = await sharp(input, options).rotate()
      .resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const thumbnail = await sharp(full.data, options)
      .resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return { full, thumbnail, originalBytes: input.length };
  } catch (error) {
    if (error instanceof InvalidListingImageError) throw error;
    throw new InvalidListingImageError('Invalid or excessively large image content');
  }
}

// Bound simultaneous decoding and memory consumption across eight-photo uploads.
let active = 0;
const waiting: (() => void)[] = [];
export async function withListingImageProcessing<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 2) {
    if (waiting.length >= 16) throw new Error('Image processing is busy');
    await new Promise<void>(resolve => waiting.push(resolve));
  } else active++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
