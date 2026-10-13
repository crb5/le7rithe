import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePendingLegalConsent } from './legal-consent-flow';

test('pending consent preserves a supported locale and an internal return path', () => {
  for (const locale of ['ar', 'fr', 'en'] as const) {
    assert.deepEqual(
      parsePendingLegalConsent(JSON.stringify({ locale, redirectPath: '/add-listing?draft=1' })),
      { locale, redirectPath: '/add-listing?draft=1' },
    );
  }
});

test('pending consent rejects malformed values and non-local return destinations', () => {
  assert.equal(parsePendingLegalConsent(null), null);
  assert.equal(parsePendingLegalConsent('{bad json'), null);
  assert.equal(parsePendingLegalConsent(JSON.stringify({ locale: 'es', redirectPath: '/' })), null);
  assert.equal(parsePendingLegalConsent(JSON.stringify({ locale: 'en', redirectPath: 'https://example.com' })), null);
  assert.equal(parsePendingLegalConsent(JSON.stringify({ locale: 'en', redirectPath: '//example.com' })), null);
});
