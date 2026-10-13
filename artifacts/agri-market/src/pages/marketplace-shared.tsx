import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type Listing as ApiListing } from '@workspace/api-client-react';
import { ListingImage, type ListingImageCategory } from '@/components/marketplace-ui';
import { dynamicFiltersForCategory } from '@/lib/category-catalog';
import { useLanguage } from '@/lib/language';
import { translateMarketplaceOption } from '@/lib/listing-localization';
import { ListingFormSelect } from '@/components/listing-form-select';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';


export type Listing = ApiListing;


export const ALL_FILTER_VALUE = '__all_filter_option__';


export const categoriesFallback = [
  { id: 2, name: 'الأراضي الزراعية', nameFr: 'Terrains agricoles', nameEn: 'Agricultural land', slug: 'land', icon: 'land', sortOrder: 0, active: true, count: 0, subcategories: [] },
  { id: 1, name: 'الآليات الزراعية', nameFr: 'Machines agricoles', nameEn: 'Agricultural machinery', slug: 'tractors', icon: 'tractor', sortOrder: 1, active: true, count: 0, subcategories: [] },
  { id: 3, name: 'البذور', nameFr: 'Semences', nameEn: 'Seeds', slug: 'seeds', icon: 'wheat', sortOrder: 2, active: true, count: 0, subcategories: [] },
  { id: 4, name: 'الأسمدة', nameFr: 'Engrais', nameEn: 'Fertilizers', slug: 'fertilizers', icon: 'flask', sortOrder: 3, active: true, count: 0, subcategories: [] },
  { id: 5, name: 'قطع الغيار', nameFr: 'Pièces détachées', nameEn: 'Spare parts', slug: 'parts', icon: 'wrench', sortOrder: 4, active: true, count: 0, subcategories: [] },
  { id: 6, name: 'المنتجات الزراعية', nameFr: 'Produits agricoles', nameEn: 'Agricultural products', slug: 'products', icon: 'basket', sortOrder: 5, active: true, count: 0, subcategories: [] },
  { id: 7, name: 'الموارد البشرية', nameFr: 'Ressources humaines', nameEn: 'Human resources', slug: 'services', icon: 'users', sortOrder: 6, active: true, count: 0, subcategories: [] },
  { id: 8, name: 'متنوع', nameFr: 'Divers', nameEn: 'Miscellaneous', slug: 'divers', icon: 'leaf', sortOrder: 7, active: true, count: 0, subcategories: [] },
];


export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border-t border-[hsl(var(--border))] py-5 first:border-0 first:pt-0"><label className="mb-3 block text-xs font-bold text-[hsl(var(--primary))]">{title}</label>{children}</div>;
}


export function ListingImageLightbox({
  gallery,
  activeImage,
  title,
  category,
  onChange,
  onClose,
}: {
  gallery: string[];
  activeImage: number;
  title: string;
  category?: ListingImageCategory;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const swipeStartXRef = useRef<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const activeImageRef = useRef(activeImage);
  activeImageRef.current = activeImage;
  useBodyScrollLock(true, lightboxRef);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft') {
        onChange(Math.max(0, activeImageRef.current - 1));
      } else if (event.key === 'ArrowRight') {
        onChange(Math.min(gallery.length - 1, activeImageRef.current + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gallery.length, onChange, onClose]);

  const previous = () => onChange(Math.max(0, activeImage - 1));
  const next = () => onChange(Math.min(gallery.length - 1, activeImage + 1));
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeStartXRef.current = event.clientX;
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartXRef.current === null) return;
    const distance = event.clientX - swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (Math.abs(distance) < 45) return;
    if (distance > 0) previous();
    else next();
  };

  return (
    <div
      ref={lightboxRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="listing-image-lightbox"
    >
      <div className="flex h-full w-full max-w-7xl flex-col items-center justify-between gap-3">
        <div className="flex w-full items-center justify-between gap-3 text-white">
          <span className="rounded-full bg-black/45 px-3 py-1.5 text-sm font-semibold tabular-nums" dir="ltr">
            {activeImage + 1} / {gallery.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={t('close')}
            data-testid="button-close-image-lightbox"
            autoFocus
          >
            <X size={24} />
          </button>
        </div>

        <div
          className="relative flex min-h-0 w-full flex-1 items-center justify-center touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeStartXRef.current = null; }}
          data-testid="listing-image-lightbox-viewport"
        >
          <ListingImage
            images={[gallery[activeImage], ...gallery.filter((_, index) => index !== activeImage)]}
            category={category}
            alt={`${title} ${activeImage + 1}`}
            className="h-full w-full"
            imageClassName="max-h-full max-w-full select-none object-contain"
            draggable={false}
            testId="img-lightbox-active"
          />
          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={previous}
                disabled={activeImage === 0}
                className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 disabled:pointer-events-none disabled:opacity-25 sm:left-3"
                aria-label={t('previous')}
                data-testid="button-lightbox-previous"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                onClick={next}
                disabled={activeImage === gallery.length - 1}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 disabled:pointer-events-none disabled:opacity-25 sm:right-3"
                aria-label={t('next')}
                data-testid="button-lightbox-next"
              >
                <ChevronRight size={26} />
              </button>
            </>
          )}
        </div>

        <div className="h-8 w-full shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}


export function DynamicFilterControl({
  field,
  value,
  onChange,
}: {
  field: ReturnType<typeof dynamicFiltersForCategory>[number];
  value: string;
  onChange: (value: string) => void;
}) {
  const { language, t } = useLanguage();
  const labelKeys: Record<string, keyof typeof import('@/locales/en').default> = {
    saleType: 'fieldSaleType',
    landCondition: 'fieldLandCondition',
    region: 'fieldRegion',
    reference: 'fieldReference',
    brand: 'fieldBrand',
    productType: 'fieldProductType',
    condition: 'condition',
    manufacturer: 'manufacturer',
    model: 'model',
    year: 'fieldYear',
  };
  const placeholderKeys: Record<string, keyof typeof import('@/locales/en').default> = {
    customRegion: 'fieldCustomRegion',
    ownershipType: 'fieldOwnershipType',
  };
  const title = t(labelKeys[field.key] ?? 'fieldProductName');

  return (
    <FilterGroup title={title}>
      {field.type === 'select' ? (
        <ListingFormSelect
          value={value || ALL_FILTER_VALUE}
          placeholder={t('all')}
          direction={language === 'ar' ? 'rtl' : 'ltr'}
          options={[
            { value: ALL_FILTER_VALUE, label: t('all') },
            ...(field.options ?? []).map((option) => ({
              value: option.value,
              label: translateMarketplaceOption(option.value, language),
            })),
          ]}
          onValueChange={(selectedValue) =>
            onChange(selectedValue === ALL_FILTER_VALUE ? '' : selectedValue)
          }
          testId={`select-filter-${field.key}`}
        />
      ) : (
        <input
          type={field.type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholderKeys[field.key] ? t(placeholderKeys[field.key]) : undefined}
          className="field-input"
        />
      )}
    </FilterGroup>
  );
}
