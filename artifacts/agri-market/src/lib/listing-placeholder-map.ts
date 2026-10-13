export type ListingPlaceholderCategory = string | Partial<{
  slug: string;
  category: string;
  categorySlug: string;
  subcategory: string | null;
  subcategorySlug: string | null;
  name: string;
  nameFr: string;
  nameEn: string;
}>;

export type ListingPlaceholderIconName =
  | 'engineer'
  | 'expert'
  | 'farmland'
  | 'fertilizer'
  | 'fodder'
  | 'foliar'
  | 'harvester'
  | 'micronutrients'
  | 'npk'
  | 'other'
  | 'plow'
  | 'rice'
  | 'seeder'
  | 'seeds'
  | 'spare-parts'
  | 'studies'
  | 'technician'
  | 'trailer'
  | 'vegetables'
  | 'worker';

type CategoryPlaceholderConfig = {
  default: ListingPlaceholderIconName;
  subcategories: Record<string, ListingPlaceholderIconName | null>;
};

// Keys below are the category and subcategory slugs in marketplace_categories
// and marketplace_subcategories. A null subcategory entry deliberately keeps
// the existing tractor placeholder.
export const listingPlaceholderMap = {
  land: {
    default: 'farmland',
    subcategories: {
      'land-sale': 'farmland',
      'land-rent': 'farmland',
    },
  },
  tractors: {
    default: 'other',
    subcategories: {
      tractor: null,
      harvester: 'harvester',
      plough: 'plow',
      seeder: 'seeder',
      trailer: 'trailer',
      'machinery-other': 'other',
    },
  },
  seeds: {
    default: 'seeds',
    subcategories: {
      rice: 'rice',
      'rice-three-months': 'rice',
      'rice-four-months': 'rice',
      'vegetable-seeds': 'vegetables',
      'feed-seeds': 'fodder',
    },
  },
  fertilizers: {
    default: 'fertilizer',
    subcategories: {
      npk: 'npk',
      micronutrients: 'micronutrients',
      foliar: 'foliar',
    },
  },
  parts: {
    default: 'spare-parts',
    subcategories: {
      'tractor-parts': 'spare-parts',
      'pump-parts': 'spare-parts',
      'parts-other': 'spare-parts',
    },
  },
  products: {
    default: 'other',
    subcategories: {
      rice: 'other',
      vegetables: 'other',
      feed: 'other',
    },
  },
  services: {
    default: 'other',
    subcategories: {
      'study-office': 'studies',
      expert: 'expert',
      engineer: 'engineer',
      technician: 'technician',
      worker: 'worker',
    },
  },
  divers: { default: 'other', subcategories: {} },
  machines: { default: 'other', subcategories: {} },
  irrigation: { default: 'other', subcategories: {} },
  equipment: { default: 'other', subcategories: {} },
} as const satisfies Record<string, CategoryPlaceholderConfig>;

type CategoryKind = 'land' | 'tractors' | 'seeds' | 'fertilizers' | 'parts' | 'services';

function normalize(value: string | null | undefined): string {
  return value
    ?.normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .trim() ?? '';
}

function categoryKindFromLabels(labels: string): CategoryKind | undefined {
  if (/spare parts?|pieces detachees|قطع(?:\s|[-_]?)غيار|غيار/u.test(labels)) return 'parts';
  if (/agricultural land|terrains? agricoles?|land|terrain|terre|الأراضي الزراعية|اراضي|أراضي/u.test(labels)) return 'land';
  if (/agricultural machinery|machines? agricoles?|tractors?|tracteurs?|الآليات الزراعية|الجرارات|جرارات/u.test(labels)) return 'tractors';
  if (/human resources|ressources humaines|الموارد البشرية الزراعية/u.test(labels)) return 'services';
  if (/fertili[sz]ers?|engrais|الأسمدة|اسمدة|سماد/u.test(labels)) return 'fertilizers';
  if (/seeds?|semences?|البذور|بذور|بذر/u.test(labels)) return 'seeds';
  return undefined;
}

function localizedSubcategoryIcon(
  kind: CategoryKind,
  label: string,
): ListingPlaceholderIconName | null | undefined {
  if (kind === 'land' && /for sale|a vendre|for rent|a louer|للبيع|للإيجار/u.test(label)) {
    return 'farmland';
  }

  if (kind === 'tractors') {
    if (/\btractor\b|\btracteur\b|جرارات?|الجرار/u.test(label)) return null;
    if (/harvesters?|moissonneuses?|حصادة|حصادات?|حاصدة|حاصدات?/u.test(label)) return 'harvester';
    if (/ploughs?|\bplows?\b|charrues?|offset|محاريث|محراث/u.test(label)) return 'plow';
    if (/seeders?|semoirs?|بذارات?|بذارة/u.test(label)) return 'seeder';
    if (/trailers?|remorques?|مقطورات?|مقطورة/u.test(label)) return 'trailer';
    if (/machinery-other|autre|other|آخر/u.test(label)) return 'other';
  }

  if (kind === 'seeds') {
    if (/rice|riz|أرز/u.test(label)) return 'rice';
    if (/vegetable|legumes|الخضروات/u.test(label)) return 'vegetables';
    if (/feed|forage|fourrage|الأعلاف|اعلاف/u.test(label)) return 'fodder';
  }

  if (kind === 'fertilizers') {
    if (/\bnpk\b|عناصر كبرى/u.test(label)) return 'npk';
    if (/micronutrients?|oligo.elements?|عناصر صغرى/u.test(label)) return 'micronutrients';
    if (/foliar|foliaires?|ورقية/u.test(label)) return 'foliar';
  }

  if (kind === 'services') {
    if (/study.office|consulting office|bureau d'etudes|مكتب دراسات/u.test(label)) return 'studies';
    if (/\bexpert\b|خبير/u.test(label)) return 'expert';
    if (/\bengineer\b|ingenieur|مهندس/u.test(label)) return 'engineer';
    if (/technician|technicien|فني/u.test(label)) return 'technician';
    if (/\bworker\b|ouvrier|عامل/u.test(label)) return 'worker';
  }

  return undefined;
}

export function listingPlaceholderIconForCategory(
  category: ListingPlaceholderCategory = '',
): ListingPlaceholderIconName | null {
  const details = typeof category === 'string' ? { slug: category, category } : category;
  const categorySlug = normalize(details.categorySlug || details.slug);
  const subcategorySlug = normalize(details.subcategorySlug);
  const categoryLabels = normalize([
    details.category,
    details.name,
    details.nameFr,
    details.nameEn,
  ].filter(Boolean).join(' '));
  const subcategoryLabels = normalize([
    details.subcategory,
    details.subcategorySlug,
  ].filter(Boolean).join(' '));
  const config = listingPlaceholderMap[categorySlug as keyof typeof listingPlaceholderMap];

  if (config && Object.prototype.hasOwnProperty.call(config.subcategories, subcategorySlug)) {
    return config.subcategories[subcategorySlug as keyof typeof config.subcategories];
  }

  const kind = (categorySlug in listingPlaceholderMap ? categorySlug : categoryKindFromLabels(categoryLabels)) as CategoryKind | undefined;
  if (kind === 'parts') return 'spare-parts';

  const localizedSubcategory = kind
    ? localizedSubcategoryIcon(kind, subcategoryLabels)
    : undefined;
  if (localizedSubcategory !== undefined) return localizedSubcategory;

  if (!subcategorySlug && !subcategoryLabels) {
    if (config) return config.default;
    if (kind === 'land') return 'farmland';
    if (kind === 'seeds') return 'seeds';
    if (kind === 'fertilizers') return 'fertilizer';
    return 'other';
  }

  return 'other';
}