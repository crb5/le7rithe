import { getListCategoriesQueryKey, useListCategories } from '@workspace/api-client-react';
import { translatedName, useLanguage } from './language';

export function useListingTaxonomy() {
  const { language } = useLanguage();
  const categoriesQuery = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });
  const categories = categoriesQuery.data ?? [];

  return {
    categoryName(categorySlug: string | undefined, fallback: string) {
      const category = categories.find(
        (item) => item.slug === categorySlug || (!categorySlug && item.name === fallback),
      );
      return category ? translatedName(category, language) : fallback;
    },
    subcategoryName(categorySlug: string | undefined, subcategorySlug: string | undefined, fallback: string) {
      const category = categories.find((item) => item.slug === categorySlug);
      const subcategory = category?.subcategories.find((item) => item.slug === subcategorySlug);
      return subcategory ? translatedName(subcategory, language) : fallback;
    },
  };
}
