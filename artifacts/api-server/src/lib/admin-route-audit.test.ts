import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const adminSource = readFileSync(resolve(process.cwd(), "src/routes/admin.ts"), "utf8");
const marketplaceSource = readFileSync(resolve(process.cwd(), "src/routes/marketplace.ts"), "utf8");

test("every actual /admin route is registered behind its production gate, except explicit identity bootstrap routes", () => {
  const baseGate = adminSource.indexOf('router.use("/admin", requireAdmin);');
  assert.notEqual(baseGate, -1);
  const bootstrapRoutes = new Set([
    "GET /admin/me",
    "POST /admin/password/login",
    "POST /admin/password/logout",
  ]);
  const routePattern = /router\.(get|post|put|patch|delete)\(["'](\/admin[^"']*)["']/g;
  const routes = [...adminSource.matchAll(routePattern)];
  assert.equal(routes.length, 41, "Update the reviewed admin route inventory when a route is added or removed");

  for (const route of routes) {
    const method = route[1].toUpperCase();
    const path = route[2];
    const routeName = `${method} ${path}`;
    const routeIndex = route.index ?? -1;
    if (bootstrapRoutes.has(routeName)) {
      assert.ok(routeIndex < baseGate, `${routeName} must remain an explicit pre-session identity route`);
      continue;
    }
    assert.ok(routeIndex > baseGate, `${routeName} must be registered after requireAdmin`);
  }
});

test("administrator-only prefixes and marketplace category routes have explicit route middleware", () => {
  for (const prefix of [
    "/admin/password/change",
    "/admin/users",
    "/admin/packages",
    "/admin/payment-methods",
    "/admin/support-settings",
    "/admin/audit-logs",
  ]) {
    assert.ok(adminSource.includes(`router.use("${prefix}", requireAdminOnly);`), `${prefix} role gate missing`);
  }
  for (const prefix of ["/admin/categories", "/admin/subcategories"]) {
    const guard = `router.use("${prefix}", requireAdminForMarketplace);`;
    assert.ok(marketplaceSource.indexOf(guard) >= 0, `${prefix} route gate missing`);
  }
  const categoryRoutes = [...marketplaceSource.matchAll(
    /router\.(get|post|put|patch|delete)\(["'](\/admin\/(?:categories|subcategories)[^"']*)["']/g,
  )];
  assert.equal(categoryRoutes.length, 7, "Update the reviewed category route inventory when a route is added or removed");
  for (const route of categoryRoutes) {
    const routePath = route[2];
    const prefix = routePath.startsWith("/admin/categories")
      ? "/admin/categories"
      : "/admin/subcategories";
    const routeGate = `router.use("${prefix}", requireAdminForMarketplace);`;
    assert.ok(
      marketplaceSource.indexOf(routeGate) < (route.index ?? -1),
      `${route[1].toUpperCase()} ${routePath} must be registered after its gate`,
    );
  }
});

test("the actual listing and account write routes use strict request schemas", () => {
  const routeSource = readFileSync(resolve(process.cwd(), "src/routes/marketplace.ts"), "utf8");
  assert.match(routeSource, /CreateListingBody\.strict\(\)\.safeParse\(req\.body\)/);
  assert.match(routeSource, /UpdateListingBody\.strict\(\)\.safeParse\(req\.body\)/);
  assert.match(routeSource, /UpdateMyAccountProfileBody\.strict\(\)\.safeParse\(req\.body\)/);
});

test("owner-facing routes keep database predicates scoped to the simulated actor", () => {
  assert.match(marketplaceSource, /eq\(listingsTable\.id, params\.data\.id\), eq\(listingsTable\.sellerId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(listingsTable\.id, parsed\.data\.id\),\s*eq\(listingsTable\.sellerId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(messagesTable\.recipientId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(messagesTable\.senderId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(notificationsTable\.userId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(savedListingsTable\.userId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(reportsTable\.reporterId, actor\.id\)/);
  assert.match(marketplaceSource, /eq\(paymentsTable\.userId, actor\.id\)/);
  assert.match(marketplaceSource, /isPaymentProofOwnedByUser\(proofObjectPath, getAuth\(req\)\.userId!\)/);
});

test("the listing update route retains both the content window and safe currency projection", () => {
  assert.match(marketplaceSource, /listingContentEditRestriction\(parsed\.data, existingListing\.createdAt\)/);
  assert.match(marketplaceSource, /gt\(listingsTable\.createdAt, new Date\(Date\.now\(\) - EDIT_WINDOW_MS\)\)/);
  assert.match(marketplaceSource, /publishedListingUpdateValues\(parsed\.data, normalizedPhones\.phones\)/);
});
