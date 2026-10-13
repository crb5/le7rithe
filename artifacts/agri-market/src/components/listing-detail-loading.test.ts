import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { LanguageProvider } from '@/lib/language';
import { ListingDescription } from './listing-description';
import { ListingDetailLoading, detailGalleryClass, detailGridClass } from './listing-detail-loading';

describe('listing detail loading geometry', () => {
  let previousWindow: PropertyDescriptor | undefined;
  beforeEach(() => {
    previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true,
      value: { localStorage: { getItem: () => 'ar' } } });
  });
  afterEach(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  it('uses the same responsive gallery/grid geometry as the real page', () => {
    const html = renderToStaticMarkup(createElement(LanguageProvider, {
      children: createElement(ListingDetailLoading),
    }));
    assert.ok(html.includes(detailGalleryClass));
    assert.ok(html.includes(detailGridClass));
    assert.doesNotMatch(html, /(?:^|[\s"])(?:h-\[(?:360|420)px\]|max-w-6xl)(?=[\s"]|$)/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-hidden="true"/);
    assert.equal((html.match(/<aside/g) ?? []).length, 1);
    const page = readFileSync(new URL('../pages/listing-detail.tsx', import.meta.url), 'utf8');
    for (const geometry of ['detailBreadcrumbClass', 'detailGalleryClass', 'detailGridClass']) {
      const rendered = geometry === 'detailGalleryClass'
        ? 'className={`${detailGalleryClass} group max-w-full`}'
        : `className={${geometry}}`;
      assert.ok(page.includes(rendered));
    }
  });

  it('clamps long descriptions before measurement, without creating absent content', () => {
    const render = (description: string | null) => renderToStaticMarkup(createElement(LanguageProvider, {
      children: createElement(ListingDescription, { description }),
    }));
    assert.match(render('A real description'), /max-height:9em/);
    assert.match(render('A real description'), /min-h-\[1\.8em\]/);
    assert.equal(render(null), '');
    assert.equal(render('   '), '');
  });

  it('keeps the header and floating actions out of document flow', () => {
    const css = readFileSync(new URL('./Header.css', import.meta.url), 'utf8');
    assert.match(css, /\.marketplace-header-shell\s*\{[^}]*position: fixed;/);
    assert.match(css, /\.market-content-shell\s*\{[^}]*padding-block-start:/);
    const shell = readFileSync(new URL('./marketplace-ui.tsx', import.meta.url), 'utf8');
    for (const testId of ['link-floating-support', 'link-mobile-add']) {
      const link = shell.split('<Link').find(fragment => fragment.includes(`data-testid="${testId}"`));
      assert.ok(link?.includes('className={`fixed '));
      assert.ok(link?.includes('transition-[transform,translate,opacity]'));
    }
  });
});
