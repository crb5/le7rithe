export const SALE_REVERT_WINDOW_MS = 5 * 60 * 1000;

export function saleRevertUntil(soldAt: Date): Date {
  return new Date(soldAt.getTime() + SALE_REVERT_WINDOW_MS);
}

export function canRevertSale(soldAt: Date, now = new Date()): boolean {
  return now.getTime() < saleRevertUntil(soldAt).getTime();
}