import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EDIT_WINDOW_MS, EDIT_WINDOW_MINUTES, formatEditWindowRemaining } from '@workspace/api-zod/listing-edit-window';
import { ListingContentEditSection } from './listing-content-edit-section';
import { LanguageProvider } from '@/lib/language';

const publishedAt = '2026-10-07T09:00:00Z';
const publishedTime = Date.parse(publishedAt);
const renderEditor = (now: number, language = 'ar') => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => language } },
  });
  try {
    return renderToStaticMarkup(createElement(LanguageProvider, { children: createElement('div', null,
  ...['price', 'contactPhone', 'whatsappPhone'].map((name) => createElement('input', { key: name, name })),
  createElement(ListingContentEditSection, {
    publishedAt, now,
    children: [
      createElement('textarea', { key: 'description', name: 'description' }),
      createElement('input', { key: 'images', name: 'images' }),
    ],
  }),
    ) }));
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
};

describe('content-edit window UI', () => {
  it('shows content fields and a remaining-time countdown before expiry', () => {
    const html = renderEditor(publishedTime + EDIT_WINDOW_MS - (7 * 60 + 32) * 1000);
    assert.match(html, /name="description"/);
    assert.match(html, /name="images"/);
    assert.match(html, /07:32/);
    assert.match(html, new RegExp(`${EDIT_WINDOW_MINUTES} دقائق`));
    for (const language of ['fr', 'en']) {
      const localized = renderEditor(publishedTime + EDIT_WINDOW_MS - (7 * 60 + 32) * 1000, language);
      assert.match(localized, /07:32/);
      assert.match(localized, new RegExp(`${EDIT_WINDOW_MINUTES} minutes`));
      assert.doesNotMatch(localized, /\{minutes\}|\{remaining\}/);
    }
  });
  it('hides photos and description exactly at expiry and afterwards', () => {
    for (const now of [publishedTime + EDIT_WINDOW_MS, publishedTime + EDIT_WINDOW_MS + 1]) {
      const html = renderEditor(now);
      assert.doesNotMatch(html, /name="description"|name="images"|content-edit-countdown/);
      assert.match(html, /content-edit-window-closed/);
      for (const name of ['price', 'contactPhone', 'whatsappPhone']) {
        assert.match(html, new RegExp(`name="${name}"`));
      }
      assert.doesNotMatch(html, /disabled/);
    }
  });
  it('hides content for invalid or future publication times', () => {
    assert.doesNotMatch(renderEditor(publishedTime - 1), /name="description"|name="images"/);
    const html = renderToStaticMarkup(createElement(ListingContentEditSection, {
      publishedAt: 'invalid', now: publishedTime, children: createElement('textarea'),
    }));
    assert.doesNotMatch(html, /textarea/);
  });
  it('formats zero and fractional final seconds without negative countdowns', () => {
    assert.equal(formatEditWindowRemaining(0), '00:00');
    assert.equal(formatEditWindowRemaining(-1), '00:00');
    assert.equal(formatEditWindowRemaining(1), '00:01');
  });
});
