/** Duration measured from the listing's stored publication timestamp. */
export const EDIT_WINDOW_MINUTES = 10;
export const EDIT_WINDOW_MS = EDIT_WINDOW_MINUTES * 60 * 1000;
export const LISTING_CONTENT_EDIT_CLOSED_ERROR = {
  status: 403,
  code: 'LISTING_CONTENT_EDIT_WINDOW_CLOSED',
  error: `Photos and description can only be edited within ${EDIT_WINDOW_MINUTES} minutes of publication`,
} as const;

export function getListingContentEditWindow(publishedAt: Date | string, now = Date.now()) {
  const timestamp = new Date(publishedAt).getTime();
  const age = now - timestamp;
  const editable = Number.isFinite(age) && age >= 0 && age < EDIT_WINDOW_MS;
  const remainingMs = editable ? EDIT_WINDOW_MS - age : 0;
  return { editable, remainingMs };
}

export function formatEditWindowRemaining(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function listingContentEditRestriction(
  body: { description?: unknown; images?: unknown },
  publishedAt: Date | string,
  now = Date.now(),
) {
  const requestsContent = body.description !== undefined || body.images !== undefined;
  if (!requestsContent || getListingContentEditWindow(publishedAt, now).editable) return null;
  return LISTING_CONTENT_EDIT_CLOSED_ERROR;
}
