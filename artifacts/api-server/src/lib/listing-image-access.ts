export type ListingImageActor = {
  id: number;
  role: string;
  status: string;
};

export type ListingImageAccessPolicy =
  | { kind: "deny" }
  | { kind: "all" }
  | { kind: "owner-or-active"; sellerId: number }
  | { kind: "active-only" };

export function getListingImageAccessPolicy(
  actor: ListingImageActor | null,
): ListingImageAccessPolicy {
  if (actor && actor.status !== "active") {
    return { kind: "deny" };
  }

  if (actor?.role === "admin" || actor?.role === "moderator") {
    return { kind: "all" };
  }

  if (actor) {
    return { kind: "owner-or-active", sellerId: actor.id };
  }

  return { kind: "active-only" };
}

export function listingImageRequiresConsent(
  policy: ListingImageAccessPolicy,
  hasPublicListing: boolean,
): boolean {
  return !hasPublicListing
    && (policy.kind === "all" || policy.kind === "owner-or-active");
}
