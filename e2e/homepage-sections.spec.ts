import { expect, test, type Page, type Route } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

type HomepageListing = {
  id: number;
  title: string;
  category: string;
  categorySlug: string;
  subcategory: null;
  subcategorySlug: null;
  price: number;
  currency: string;
  location: string;
  condition: 'new' | 'used';
  year: number;
  manufacturer: null;
  model: null;
  hours: null;
  area: null;
  waterAvailable: null;
  electricityAvailable: null;
  ownershipType: null;
  contactPhone: null;
  attributes: Record<string, never>;
  description: string;
  imageUrl: string;
  images: string[];
  seller: {
    id: number;
    name: string;
    initials: string;
    verified: boolean;
    phone: null;
  };
  createdAt: string;
  featured: boolean;
  isSaved: boolean;
  saleStatus: 'available';
  soldAt: null;
  saleRevertUntil: null;
  canRevertSale: boolean;
};

type HomepageFixture = {
  featuredItems?: HomepageListing[];
  latestItems?: HomepageListing[];
  latestPages?: Record<number, HomepageListing[]>;
  latestTotal?: number;
  latestPageDelayMs?: number;
  featuredStatus?: number;
  latestStatus?: number;
  categoriesStatus?: number;
};

function listing(id: number, title: string, featured: boolean): HomepageListing {
  return {
    id,
    title,
    category: 'Agricultural machinery',
    categorySlug: 'tractors',
    subcategory: null,
    subcategorySlug: null,
    price: 1500,
    currency: 'MRU',
    location: 'Nouakchott',
    condition: 'used',
    year: 2022,
    manufacturer: null,
    model: null,
    hours: null,
    area: null,
    waterAvailable: null,
    electricityAvailable: null,
    ownershipType: null,
    contactPhone: null,
    attributes: {},
    description: 'A listing used by the homepage section regression.',
    imageUrl: '',
    images: [],
    seller: {
      id: 900,
      name: 'Homepage test seller',
      initials: 'HT',
      verified: true,
      phone: null,
    },
    createdAt: '2026-09-01T12:00:00.000Z',
    featured,
    isSaved: false,
    saleStatus: 'available',
    soldAt: null,
    saleRevertUntil: null,
    canRevertSale: false,
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockHomepageApi(page: Page, fixture: HomepageFixture = {}) {
  const latestRequests: Array<{ page: number; limit: number }> = [];
  await page.addInitScript(() => {
    (globalThis as any).localStorage.setItem('marketplace-language', 'en');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await fulfillJson(route, 405, { error: 'Read-only homepage test fixture' });
      return;
    }

    const url = new URL(request.url());
    if (url.pathname === '/api/listings') {
      const isFeaturedRequest = url.searchParams.get('featured') === 'true';
      const status = isFeaturedRequest
        ? fixture.featuredStatus ?? 200
        : fixture.latestStatus ?? 200;
      const requestedPage = Number(url.searchParams.get('page') ?? 1);
      const requestedLimit = Number(url.searchParams.get('limit') ?? 12);
      if (!isFeaturedRequest) {
        latestRequests.push({ page: requestedPage, limit: requestedLimit });
        if (requestedPage > 1 && fixture.latestPageDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, fixture.latestPageDelayMs));
        }
      }
      const items = isFeaturedRequest
        ? fixture.featuredItems ?? []
        : fixture.latestPages?.[requestedPage] ?? (requestedPage === 1 ? fixture.latestItems ?? [] : []);
      const total = fixture.latestTotal ?? fixture.latestItems?.length ?? items.length;
      await fulfillJson(
        route,
        status,
        status === 200
          ? { items, total: isFeaturedRequest ? (fixture.featuredItems ?? []).length : total, page: requestedPage, limit: requestedLimit }
          : { error: 'Homepage listing fixture failure' },
      );
      return;
    }

    if (url.pathname === '/api/categories') {
      await fulfillJson(
        route,
        fixture.categoriesStatus ?? 200,
        fixture.categoriesStatus === undefined || fixture.categoriesStatus === 200
          ? []
          : { error: 'Homepage category fixture failure' },
      );
      return;
    }

    if (url.pathname === '/api/locations' || url.pathname === '/api/banners') {
      await fulfillJson(route, 200, []);
      return;
    }

    await fulfillJson(route, 404, { error: 'Unexpected API request in homepage test' });
  });
  return latestRequests;
}

test.describe('homepage section order and listing states', () => {
  test.skip(!baseURL, 'Set E2E_BASE_URL to run the homepage section regression.');

  test('keeps Hero, Featured, Categories, and Latest offers in order without repeating featured listings', async ({ page }) => {
    const featured = listing(901, 'Homepage featured fixture', true);
    const latest = listing(902, 'Homepage latest fixture', false);
    await mockHomepageApi(page, {
      featuredItems: [featured],
      // Deliberately include the featured listing in the API response for latest offers.
      latestItems: [featured, latest],
    });

    await page.goto('/');

    const sections = [
      'section-home-hero',
      'section-featured-listings',
      'section-categories',
      'section-latest-offers',
    ];
    const sectionSelector = sections.map((id) => `[data-testid="${id}"]`).join(', ');
    await expect(page.getByTestId('section-featured-listings')).toBeVisible();
    await expect(page.getByTestId('section-latest-offers')).toBeVisible();
    await expect(page.getByTestId('card-listing-902')).toBeVisible();

    const renderedSectionOrder = await page.locator(sectionSelector).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid')),
    );
    expect(renderedSectionOrder).toEqual(sections);
    await expect(
      page.getByTestId('section-latest-offers').getByTestId('card-listing-901'),
    ).toHaveCount(0);
  });

  test('shows the latest-offers empty state and category fallback when listings are empty', async ({ page }) => {
    await mockHomepageApi(page, {
      featuredItems: [],
      latestItems: [],
    });

    await page.goto('/');

    await expect(page.getByTestId('section-featured-listings')).toHaveCount(0);
    await expect(
      page.getByTestId('section-latest-offers').getByRole('heading', {
        name: 'No published offers yet',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('link-category-tractors')).toBeVisible();
  });

  test('loads homepage offers in 30-item pages and appends them without replacing the first page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const firstPage = Array.from({ length: 30 }, (_, index) =>
      listing(1000 + index, `First page offer ${index + 1}`, false),
    );
    const secondPage = Array.from({ length: 30 }, (_, index) =>
      listing(1030 + index, `Second page offer ${index + 1}`, false),
    );
    const latestRequests = await mockHomepageApi(page, {
      latestPages: { 1: firstPage, 2: secondPage },
      latestTotal: 60,
      latestPageDelayMs: 350,
    });

    await page.goto('/');

    const section = page.getByTestId('section-latest-offers');
    const cards = section.locator('[data-testid^="card-listing-"]');
    const showMore = page.getByTestId('button-latest-offers-show-more');
    await expect(cards).toHaveCount(30);
    await expect(page.getByTestId('card-listing-1000')).toBeVisible();
    await expect(page.getByTestId('card-listing-1029')).toBeVisible();
    await expect(page.getByTestId('card-listing-1030')).toHaveCount(0);
    await expect(showMore).toHaveText('View More');
    expect(latestRequests).toEqual([{ page: 1, limit: 30 }]);

    const secondPageResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith('/api/listings')
        && url.searchParams.get('featured') !== 'true'
        && url.searchParams.get('page') === '2'
        && url.searchParams.get('limit') === '30';
    });
    await showMore.click();
    await expect(showMore).toBeDisabled();
    await expect(showMore).toContainText('Loading…');
    await expect(showMore.locator('svg.animate-spin')).toBeVisible();
    await secondPageResponse;

    await expect(cards).toHaveCount(60);
    await expect(page.getByTestId('card-listing-1000')).toBeVisible();
    await expect(page.getByTestId('card-listing-1030')).toBeVisible();
    await expect(page.getByTestId('button-latest-offers-show-more')).toHaveCount(0);
    await expect(page).toHaveURL('/');
    expect(latestRequests).toEqual([
      { page: 1, limit: 30 },
      { page: 2, limit: 30 },
    ]);
  });

  test('shows retry states on listing errors and retains fallback categories when category loading fails', async ({ page }) => {
    await mockHomepageApi(page, {
      featuredStatus: 503,
      latestStatus: 503,
      categoriesStatus: 503,
    });

    await page.goto('/');

    await expect(
      page.getByTestId('section-featured-listings').getByTestId('button-retry'),
    ).toBeVisible();
    await expect(
      page.getByTestId('section-latest-offers').getByTestId('button-retry'),
    ).toBeVisible();
    await expect(page.getByTestId('link-category-tractors')).toBeVisible();
  });
});