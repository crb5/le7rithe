import type { ReactNode } from 'react';
import type { Listing } from '@workspace/api-client-react';
import { getListCategoriesQueryKey, useListCategories } from '@workspace/api-client-react';
import { dynamicFieldsForCategory, type DynamicField } from '@/lib/category-catalog';
import { listingDetailEntries } from '@/lib/listing-detail-fields';
import { translatedName, useLanguage, type MarketplaceLanguage } from '@/lib/language';
import { translateLocationName, translateMarketplaceOption } from '@/lib/listing-localization';
import { VerifiedBadge } from './verified-badge';

type TranslationKey = keyof typeof import('@/locales/en').default;

const dynamicLabelKeys: Record<string, TranslationKey> = {
  saleType: 'fieldSaleType',
  landCondition: 'fieldLandCondition',
  region: 'fieldRegion',
  customRegion: 'fieldCustomRegion',
  ownershipType: 'fieldOwnershipType',
  area: 'fieldArea',
  waterAvailable: 'fieldWaterAvailable',
  electricityAvailable: 'fieldElectricityAvailable',
  manufacturer: 'manufacturer',
  model: 'model',
  year: 'fieldYear',
  condition: 'condition',
  hours: 'fieldHours',
  productName: 'fieldProductName',
  reference: 'fieldReference',
  brand: 'fieldBrand',
  quantity: 'fieldQuantity',
  productionDate: 'fieldProductionDate',
  expiryDate: 'fieldExpiryDate',
  productType: 'fieldProductType',
  composition: 'fieldComposition',
  packageSize: 'fieldPackageSize',
  partName: 'fieldPartName',
  compatibleMachine: 'fieldCompatibleMachine',
  unit: 'fieldUnit',
  quality: 'fieldQuality',
  serviceName: 'fieldServiceName',
  specialization: 'fieldSpecialization',
  experience: 'fieldExperience',
  contactPhone: 'fieldContactPhone',
  servicePrice: 'fieldServicePrice',
};

const commonLabelKeys: Record<string, TranslationKey> = {
  location: 'location',
  condition: 'condition',
  year: 'fieldYear',
  manufacturer: 'manufacturer',
  model: 'model',
  hours: 'fieldHours',
  area: 'fieldArea',
  waterAvailable: 'fieldWaterAvailable',
  electricityAvailable: 'fieldElectricityAvailable',
  ownershipType: 'fieldOwnershipType',
};

function isDateField(key: string, field?: DynamicField) {
  return field?.type === 'date' || key === 'productionDate' || key === 'expiryDate';
}

function formatDetailValue(
  key: string,
  value: unknown,
  field: DynamicField | undefined,
  language: MarketplaceLanguage,
  t: (key: TranslationKey) => string,
  formatNumber: (value: number) => string,
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string,
) {
  if (typeof value === 'boolean') return value ? t('available') : t('unavailable');
  if (typeof value === 'number') return formatNumber(value);
  if (isDateField(key, field)) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : formatDate(date, { dateStyle: 'medium' });
  }
  if (typeof value === 'string' && key === 'location') return translateLocationName(value, language);
  if (typeof value === 'string') return translateMarketplaceOption(value, language);
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export function ListingDetailFields({ listing }: { listing: Listing }) {
  const { language, t, formatNumber, formatDate } = useLanguage();
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const category = categoriesQuery.data?.find((item) => item.slug === listing.categorySlug);
  const translatedCategory = category ? translatedName(category, language) : listing.category;
  const translatedSubcategory = category?.subcategories?.find((item) => item.slug === listing.subcategorySlug)
    ? translatedName(category.subcategories.find((item) => item.slug === listing.subcategorySlug)!, language)
    : listing.subcategory;
  const dynamicFields = dynamicFieldsForCategory(listing.categorySlug);
  const dynamicByKey = new Map(dynamicFields.map((field) => [field.key, field]));
  const entries = listingDetailEntries(listing, dynamicFields);
  const labelFor = (key: string) => t(dynamicLabelKeys[key] ?? commonLabelKeys[key] ?? 'additionalInformation');
  const renderEntry = ({ key, value }: { key: string; value: unknown }) => (
    <div key={key} className="min-w-0 rounded-xl bg-[hsl(var(--secondary)/.45)] px-3 py-3" data-testid={`listing-field-${key}`}>
      <dt className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{labelFor(key)}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[hsl(var(--foreground))]" dir={typeof value === 'number' || key === 'contactPhone' ? 'ltr' : undefined}>
        {formatDetailValue(key, value, dynamicByKey.get(key), language, t, formatNumber, formatDate)}
      </dd>
    </div>
  );

  return (
    <section className="mt-7 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6" data-testid="listing-details-fields">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[hsl(var(--primary))]">{t('listingDetails')}</h2>
          <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">{t('listingDetailsDescription')}</p>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-[hsl(var(--secondary)/.45)] px-3 py-3" data-testid="listing-field-category">
          <dt className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{t('mainCategory')}</dt>
          <dd className="mt-1 break-words text-sm font-semibold">{translatedCategory}</dd>
        </div>
        {listing.subcategory && (
          <div className="min-w-0 rounded-xl bg-[hsl(var(--secondary)/.45)] px-3 py-3" data-testid="listing-field-subcategory">
            <dt className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{t('subcategory')}</dt>
            <dd className="mt-1 break-words text-sm font-semibold">{translatedSubcategory}</dd>
          </div>
        )}
        {entries.map(renderEntry)}
      </dl>
    </section>
  );
}

export function ListingSellerCard({ listing, children }: { listing: Listing; children?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="mt-5 border-t border-[hsl(var(--border))] pt-4" data-testid="listing-seller-info">
      <h3 className="mb-3 text-xs font-bold text-[hsl(var(--primary))]">{t('sellerContactInfo')}</h3>
      <div className="flex min-h-10 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-bold text-[hsl(var(--primary))]">{listing.seller.initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <strong className="text-sm">{listing.seller.name}</strong>
            {listing.seller.verified && <VerifiedBadge display="label" testId={`badge-verified-seller-${listing.seller.id}`} />}
          </div>
          {!listing.seller.verified && (
            <span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">{t('unverifiedSeller')}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}