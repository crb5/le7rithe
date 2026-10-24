export const SITE_NAME = 'le7rithe';

const LEGACY_SITE_NAME = 'لحريثه';

export function withCurrentSiteName<T extends Record<string, string>>(translations: T): T {
  return Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [
      key,
      value.replaceAll(LEGACY_SITE_NAME, SITE_NAME),
    ]),
  ) as T;
}