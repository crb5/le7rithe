import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Combine,
  FlaskConical,
  LandPlot,
  Leaf,
  Package,
  Shovel,
  ShoppingBasket,
  Sprout,
  Tractor,
  Users,
  Wrench,
} from 'lucide-react';
import {
  listingPlaceholderIconForCategory,
  listingPlaceholderMap,
} from '@/lib/listing-placeholder-map';
import {
  firstAvailableListingImage,
  formatPrice,
  getListingImageSources,
  iconForCategory,
  ListingImage,
  listingImageIconForCategory,
  markListingImageFailed,
} from './marketplace-ui';
import {
  canonicalizeLocationName,
  translateLocationName,
  translateMarketplaceOption,
} from '../lib/listing-localization';

describe('marketplace value localization', () => {
  it('translates every predefined Mauritanian location and common aliases without changing stored names', () => {
    const locations = [
      ['روصو', 'Rosso', 'Rosso'],
      ['كرمسين', 'Keur Macène', 'Keur Macène'],
      ['اركيز', 'R’Kiz', "R'Kiz"],
      ['انتيكان', 'Antékan', 'Antekan'],
      ['بوگي', 'Boghé', 'Boghé'],
      ['لكصيب', 'Lexeïba', 'Lexeiba'],
      ['آخر', 'Autre', 'Other'],
      ['نواكشوط', 'Nouakchott', 'Nouakchott'],
      ['نواذيبو', 'Nouadhibou', 'Nouadhibou'],
    ] as const;

    for (const [arabic, french, english] of locations) {
      assert.equal(translateLocationName(arabic, 'fr'), french);
      assert.equal(translateLocationName(arabic, 'en'), english);
      assert.equal(canonicalizeLocationName(french, 'fr'), arabic);
      assert.equal(canonicalizeLocationName(english, 'en'), arabic);
    }

    assert.equal(translateLocationName('بوكي، موريتانيا', 'fr'), 'Boghé، Mauritanie');
    assert.equal(translateLocationName('بوغي, موريتانيا', 'en'), 'Boghé, Mauritania');
    assert.equal(canonicalizeLocationName('Rosso, Mauritanie', 'fr'), 'روصو, موريتانيا');
  });

  it('leaves unknown locations in Arabic and localizes fixed listing option values', () => {
    assert.equal(translateLocationName('قرية غير معروفة', 'fr'), 'قرية غير معروفة');
    assert.equal(translateMarketplaceOption('sale', 'fr'), 'À vendre');
    assert.equal(translateMarketplaceOption('reclaimed', 'en'), 'Reclaimed');
    assert.equal(translateMarketplaceOption('غير مستصلحة', 'fr'), 'Non aménagé');
  });
});

describe('iconForCategory', () => {
  it('maps every current catalog category to its intended icon family', () => {
    const categories = [
      { slug: 'tractors', expected: Tractor },
      { slug: 'seeds', expected: Sprout },
      { slug: 'land', expected: LandPlot },
      { slug: 'parts', expected: Wrench },
      { slug: 'fertilizers', expected: FlaskConical },
      { slug: 'products', expected: ShoppingBasket },
      { slug: 'services', expected: Users },
    ];

    for (const { slug, expected } of categories) {
      assert.strictEqual(iconForCategory(slug), expected, `expected ${slug} to use ${expected.displayName ?? expected.name}`);
    }
  });

  it('uses translated category titles when the slug is not descriptive', () => {
    const translatedTitles = [
      ['الآليات الزراعية', Tractor],
      ['Machines agricoles', Tractor],
      ['Agricultural machinery', Tractor],
      ['البذور', Sprout],
      ['Semences', Sprout],
      ['Seeds', Sprout],
      ['الأراضي الزراعية', LandPlot],
      ['Terrains agricoles', LandPlot],
      ['Agricultural land', LandPlot],
      ['قطع غيار الآليات الزراعية', Wrench],
      ['Pièces détachées', Wrench],
      ['Agricultural spare parts', Wrench],
      ['الأسمدة', FlaskConical],
      ['Engrais', FlaskConical],
      ['Fertilizers', FlaskConical],
      ['تسويق المنتجات الزراعية', ShoppingBasket],
      ['Produits agricoles', ShoppingBasket],
      ['Agricultural products', ShoppingBasket],
      ['الموارد البشرية الزراعية', Users],
      ['Ressources humaines agricoles', Users],
      ['Agricultural human resources', Users],
    ] as const;

    for (const [title, expected] of translatedTitles) {
      assert.strictEqual(iconForCategory(title), expected, `expected "${title}" to use ${expected.displayName ?? expected.name}`);
    }
  });

  it('falls back to the generic agriculture icon for unknown categories', () => {
    assert.strictEqual(iconForCategory('something new'), Leaf);
  });
});

describe('listing price formatting', () => {
  it('continues to show explicit currencies on older listings', () => {
    assert.equal(formatPrice(500000, 'MRU', 'ar').split(' ').at(-1), 'MRU');
    assert.equal(formatPrice(500000, 'USD', 'fr').split(' ').at(-1), 'USD');
    assert.equal(formatPrice(500000, 'EUR', 'en').split(' ').at(-1), 'EUR');
  });
});

describe('listing image placeholder icons', () => {
  it('maps every active category and subcategory slug to one of the supplied drawings', () => {
    const cases: Array<[string, string | undefined, string | null]> = [
      ['land', 'land-sale', 'farmland'],
      ['land', 'land-rent', 'farmland'],
      ['tractors', 'tractor', null],
      ['tractors', 'harvester', 'harvester'],
      ['tractors', 'plough', 'plow'],
      ['tractors', 'seeder', 'seeder'],
      ['tractors', 'trailer', 'trailer'],
      ['tractors', 'machinery-other', 'other'],
      ['tractors', undefined, 'other'],
      ['seeds', undefined, 'seeds'],
      ['seeds', 'rice', 'rice'],
      ['seeds', 'rice-three-months', 'rice'],
      ['seeds', 'rice-four-months', 'rice'],
      ['seeds', 'vegetable-seeds', 'vegetables'],
      ['seeds', 'feed-seeds', 'fodder'],
      ['fertilizers', undefined, 'fertilizer'],
      ['fertilizers', 'npk', 'npk'],
      ['fertilizers', 'micronutrients', 'micronutrients'],
      ['fertilizers', 'foliar', 'foliar'],
      ['parts', 'tractor-parts', 'spare-parts'],
      ['parts', 'pump-parts', 'spare-parts'],
      ['parts', 'parts-other', 'spare-parts'],
      ['products', 'rice', 'other'],
      ['products', 'vegetables', 'other'],
      ['products', 'feed', 'other'],
      ['services', 'study-office', 'studies'],
      ['services', 'expert', 'expert'],
      ['services', 'engineer', 'engineer'],
      ['services', 'technician', 'technician'],
      ['services', 'worker', 'worker'],
      ['divers', undefined, 'other'],
    ];

    for (const [categorySlug, subcategorySlug, expected] of cases) {
      assert.equal(
        listingPlaceholderIconForCategory({ categorySlug, subcategorySlug }),
        expected,
        `expected ${categorySlug}/${subcategorySlug ?? '(default)'} to map to ${expected}`,
      );
    }

    const mappedNames = new Set(
      Object.values(listingPlaceholderMap).flatMap((config) => [
        config.default,
        ...Object.values(config.subcategories).filter((name): name is NonNullable<typeof name> => name !== null),
      ]),
    );
    assert.deepEqual(
      [...mappedNames].sort(),
      [
        'engineer', 'expert', 'farmland', 'fertilizer', 'fodder', 'foliar', 'harvester',
        'micronutrients', 'npk', 'other', 'plow', 'rice', 'seeder', 'seeds',
        'spare-parts', 'studies', 'technician', 'trailer', 'vegetables', 'worker',
      ].sort(),
    );
  });

  it('resolves translated category and subcategory labels in Arabic, French, and English', () => {
    const translatedCases = [
      [{ categorySlug: 'tractors', category: 'الآليات الزراعية', subcategory: 'حصادة' }, 'harvester'],
      [{ categorySlug: 'tractors', category: 'Machines agricoles', subcategory: 'Moissonneuse' }, 'harvester'],
      [{ categorySlug: 'tractors', category: 'Agricultural machinery', subcategory: 'Harvester' }, 'harvester'],
      [{ categorySlug: 'seeds', category: 'البذور', subcategory: 'الخضروات' }, 'vegetables'],
      [{ categorySlug: 'seeds', category: 'Semences', subcategory: 'Légumes' }, 'vegetables'],
      [{ categorySlug: 'seeds', category: 'Seeds', subcategory: 'Vegetable seeds' }, 'vegetables'],
      [{ categorySlug: 'fertilizers', category: 'الأسمدة', subcategory: 'عناصر صغرى' }, 'micronutrients'],
      [{ categorySlug: 'fertilizers', category: 'Engrais', subcategory: 'Oligo-éléments' }, 'micronutrients'],
      [{ categorySlug: 'fertilizers', category: 'Fertilizers', subcategory: 'Micronutrients' }, 'micronutrients'],
    ] as const;

    for (const [category, expected] of translatedCases) {
      assert.equal(listingPlaceholderIconForCategory(category), expected);
    }
  });

  it('renders the mapped public SVG when a listing has no usable photo', () => {
    const markup = renderToStaticMarkup(createElement(ListingImage, {
      images: [null, ''],
      imageUrl: ' ',
      category: { categorySlug: 'seeds', subcategorySlug: 'feed-seeds' },
      alt: 'Feed seeds',
    }));

    assert.match(markup, /<img[^>]+src="\/assets\/placeholders\/fodder\.svg"/);
    assert.match(markup, /data-placeholder-icon="fodder"/);
    assert.match(markup, /alt="Feed seeds"/);
  });

  it('maps listing categories and subcategories across Arabic, French, and English', () => {
    const categories = [
      ['tractors', Tractor],
      ['الجرارات', Tractor],
      ['land', LandPlot],
      ['أراضي زراعية', LandPlot],
      ['harvesters', Combine],
      ['moissonneuses', Combine],
      ['الحصادات', Combine],
      ['ploughs', Shovel],
      ['المحاريث', Shovel],
      ['seeds', Sprout],
      ['البذور', Sprout],
      ['fertilizers', Package],
      ['engrais', Package],
      ['parts', Wrench],
      ['قطع غيار الآليات', Wrench],
    ] as const;

    for (const [category, expected] of categories) {
      assert.strictEqual(listingImageIconForCategory(category), expected, `expected "${category}" to use ${expected.displayName ?? expected.name}`);
    }
  });

  it('prefers a specific subcategory over broad machinery names', () => {
    assert.strictEqual(
      listingImageIconForCategory({
        category: 'Machines agricoles',
        categorySlug: 'farm-machinery',
        subcategorySlug: 'harvesters',
      }),
      Combine,
    );
    assert.strictEqual(
      listingImageIconForCategory({
        category: 'Agricultural machinery',
        categorySlug: 'farm-machinery',
        subcategorySlug: 'spare-parts',
      }),
      Wrench,
    );
  });

  it('uses the generic agriculture icon for unknown categories', () => {
    assert.strictEqual(listingImageIconForCategory('new category'), Leaf);
  });
});

describe('listing image source selection', () => {
  it('keeps the legacy URL first, then accepts image arrays and ignores empty values', () => {
    assert.deepEqual(
      getListingImageSources(['', null, ' /first.jpg ', '/second.jpg'], '/legacy.jpg'),
      ['/legacy.jpg', '/first.jpg', '/second.jpg'],
    );
    assert.deepEqual(getListingImageSources('/single.jpg'), ['/single.jpg']);
    assert.deepEqual(getListingImageSources(null, '  '), []);
  });

  it('renders the same primary legacy URL used before the fallback change', () => {
    const markup = renderToStaticMarkup(createElement(ListingImage, {
      images: ['', '/first-valid-photo.jpg', '/second-photo.jpg'],
      imageUrl: '/legacy-photo.jpg',
      category: 'tractors',
      alt: 'Farm tractor',
    }));

    assert.match(markup, /<img[^>]+src="\/legacy-photo\.jpg"/);
    assert.doesNotMatch(markup, /bg-\[linear-gradient/);
  });

  it('uses the first array image when there is no legacy URL', () => {
    const markup = renderToStaticMarkup(createElement(ListingImage, {
      images: ['', '/first-valid-photo.jpg', '/second-photo.jpg'],
      category: 'tractors',
    }));

    assert.match(markup, /<img[^>]+src="\/first-valid-photo\.jpg"/);
    assert.doesNotMatch(markup, /bg-\[linear-gradient/);
  });

  it('tries the next image after an error and shows the fallback only after all fail', () => {
    const sources = getListingImageSources(['/broken-first.jpg', '/valid-second.jpg']);
    assert.equal(firstAvailableListingImage(sources), '/broken-first.jpg');
    assert.equal(firstAvailableListingImage(sources, new Set(['/broken-first.jpg'])), '/valid-second.jpg');
    assert.equal(firstAvailableListingImage(sources, new Set(sources)), undefined);

    const markup = renderToStaticMarkup(createElement(ListingImage, {
      images: [null, ''],
      imageUrl: ' ',
      category: { categorySlug: 'tractors', subcategorySlug: 'tractor' },
    }));
    assert.doesNotMatch(markup, /<img/);
    assert.match(markup, /bg-\[linear-gradient/);
    assert.match(markup, /lucide-tractor/);
  });

  it('clears failed-image state when a listing source list changes', () => {
    const firstListingFailure = markListingImageFailed(
      { sourceKey: '', sources: new Set<string>() },
      'listing-a',
      '/broken-a.jpg',
    );
    const nextListingFailure = markListingImageFailed(
      firstListingFailure,
      'listing-b',
      '/broken-b.jpg',
    );

    assert.deepEqual([...nextListingFailure.sources], ['/broken-b.jpg']);
    assert.equal(firstAvailableListingImage(['/new-listing.jpg'], nextListingFailure.sources), '/new-listing.jpg');
  });
});
