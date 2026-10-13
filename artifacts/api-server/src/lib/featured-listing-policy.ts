export type FeaturedListingVisibilityInput = {
  status: string;
  featured: boolean;
  hasConfirmedFeaturedPayment: boolean;
};

export function isFeaturedListingVisible(
  listing: FeaturedListingVisibilityInput,
): boolean {
  return (
    listing.status === "active" &&
    listing.featured &&
    listing.hasConfirmedFeaturedPayment
  );
}