import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, listingsTable, categoriesTable } from "@workspace/db";

/**
 * SEO endpoints and helpers.
 *
 * - `/robots.txt` and `/sitemap.xml` are served dynamically.
 * - Indexing is OFF unless `SEO_INDEXING=1`, so the site stays out of search
 *   until launch (flip the env + restart, no rebuild).
 * - `listingHeadTags` injects per-listing title/OG/JSON-LD into the SPA shell so
 *   shared links (WhatsApp/Facebook) and crawlers get real previews.
 */

export function indexingEnabled(): boolean {
  return process.env.SEO_INDEXING === "1";
}

export function baseUrlFrom(req: Request): string {
  const envBase = process.env.PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]
    || req.protocol
    || "https";
  return `${proto}://${req.get("host")}`;
}

const xmlEscape = (value: string): string =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

const htmlEscape = (value: string): string =>
  value.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

const imageUrlFor = (base: string, imageUrl: string | null | undefined): string => {
  if (imageUrl && imageUrl.startsWith("/objects/listing-images/")) {
    return `${base}/api/listing-images/${imageUrl.split("/").pop()}`;
  }
  if (imageUrl && /^https?:\/\//.test(imageUrl)) return imageUrl;
  return `${base}/icon-512.png`;
};

export const seoRouter: IRouter = Router();

seoRouter.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  if (!indexingEnabled()) {
    res.send("User-agent: *\nDisallow: /\n");
    return;
  }
  const base = baseUrlFrom(req);
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${base}/sitemap.xml\n`);
});

seoRouter.get("/sitemap.xml", async (req, res) => {
  const base = baseUrlFrom(req);
  const staticPaths = ["/", "/listings", "/categories", "/privacy", "/terms"];
  let listings: { id: number; updatedAt: Date | null }[] = [];
  try {
    listings = await db
      .select({ id: listingsTable.id, updatedAt: listingsTable.updatedAt })
      .from(listingsTable)
      .where(eq(listingsTable.status, "active"))
      .orderBy(desc(listingsTable.updatedAt))
      .limit(5000);
  } catch {
    // Serve a static-only sitemap if the DB is unavailable.
  }
  const entries = [
    ...staticPaths.map((p) => ({ loc: `${base}${p}`, lastmod: undefined as string | undefined })),
    ...listings.map((l) => ({
      loc: `${base}/listings/${l.id}`,
      lastmod: l.updatedAt ? l.updatedAt.toISOString().slice(0, 10) : undefined,
    })),
  ];
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) => `  <url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`)
      .join("\n") +
    `\n</urlset>\n`,
  );
});

/**
 * Returns `<head>` tags (title, meta description, OpenGraph, Twitter, JSON-LD)
 * for a public active listing, or null if it isn't publicly visible.
 */
export async function listingHeadTags(id: number, base: string): Promise<string | null> {
  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(and(eq(listingsTable.id, id), eq(listingsTable.status, "active")))
    .limit(1);
  if (!listing) return null;

  const title = `${listing.title} — Le7rithe`;
  const description = (listing.description || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const image = imageUrlFor(base, listing.imageUrl);
  const url = `${base}/listings/${listing.id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description,
    image,
    category: undefined,
    offers: {
      "@type": "Offer",
      price: Number(listing.price),
      priceCurrency: listing.currency,
      availability: "https://schema.org/InStock",
      url,
    },
  };

  return [
    `<title>${htmlEscape(title)}</title>`,
    `<meta name="description" content="${htmlEscape(description)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:title" content="${htmlEscape(title)}" />`,
    `<meta property="og:description" content="${htmlEscape(description)}" />`,
    `<meta property="og:image" content="${htmlEscape(image)}" />`,
    `<meta property="og:url" content="${htmlEscape(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ].join("\n    ");
}
