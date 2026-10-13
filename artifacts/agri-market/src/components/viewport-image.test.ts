import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ViewportImage, listingThumbnailUrl } from './viewport-image';

it('uses card variants only for internal listing images and leaves legacy external images untouched', () => {
  const path = '/api/listing-images/11111111-1111-4111-8111-111111111111';
  assert.equal(listingThumbnailUrl(path), path + '?variant=thumbnail');
  assert.equal(listingThumbnailUrl(path + '?x=1'), path + '?x=1&variant=thumbnail');
  assert.equal(listingThumbnailUrl('https://example.com/old.jpg'), 'https://example.com/old.jpg');
  assert.equal(listingThumbnailUrl('/listing-placeholders/tractor.webp'), '/listing-placeholders/tractor.webp');
});
it('reserves an aspect ratio and initially defers images pending actual viewport measurement', () => {
  const html = renderToStaticMarkup(createElement(ViewportImage, { src: '/photo.webp', className: 'h-full w-full object-cover' }));
  assert.match(html, /aspect-ratio:auto 1 \/ 1/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /h-full w-full object-cover/);
});

it('keeps new motion CSS-only, finite, reduced-motion safe and free of layout keyframes', () => {
  const css = readFileSync(new URL('../motion.css', import.meta.url), 'utf8');
  const keyframes = css.slice(css.indexOf('@keyframes card-enter'), css.indexOf('/* Drawer direction'));
  assert.doesNotMatch(keyframes, /\b(width|height|top|left|right|margin|padding|filter|box-shadow)\s*:/);
  assert.doesNotMatch(css, /will-change\s*:|infinite/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /transition: none !important/);
  assert.match(css, /\.animate-rise, \.animate-fade \{ animation: none !important/);
  const observer = readFileSync(new URL('./viewport-image.tsx', import.meta.url), 'utf8');
  assert.match(observer, /new IntersectionObserver/);
  assert.match(observer, /intersection\?\.unobserve\(entry.target\)/);
  assert.match(observer, /getBoundingClientRect\(\)\.top \+ scrollY >= innerHeight/);
  assert.match(observer, /if \(!scrollY\) return/);
  assert.match(observer, /Math\.min\(2, 4 - document\.getAnimations\(\)\.length\)/);
  assert.doesNotMatch(observer, /requestAnimationFrame|framer-motion/);
});
