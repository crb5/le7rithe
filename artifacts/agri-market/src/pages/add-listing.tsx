import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import {
  getListCategoriesQueryKey,
  getListLocationsQueryKey,
  useCreateListing,
  useListCategories,
  useListLocations,
  type ListingInput,
} from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { AppShell, PageHeading } from '@/components/marketplace-ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import {
  formFieldsForCategory,
  LAND_CATEGORY_SLUG,
  LAND_ONLY_FIELD_KEYS,
  regions,
} from '@/lib/category-catalog';
import { translatedName, useLanguage } from '@/lib/language';
import { ENABLE_PAID_LISTINGS } from '@/lib/features';
import { PaymentConfirmationPanel } from '@/components/payment-confirmation-panel';
import { ListingImageUploader } from '@/components/listing-image-uploader';
import { ListingFormSelect } from '@/components/listing-form-select';
import { hasAllowedMauritaniaPhonePrefix, normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { translateLocationName, translateMarketplaceOption } from '@/lib/listing-localization';

const categoriesFallback = [
  { id: 1, name: 'الآليات الزراعية', nameFr: 'Machines agricoles', nameEn: 'Agricultural machinery', slug: 'tractors', icon: 'tractor', sortOrder: 1, active: true, count: 0, subcategories: [] },
  { id: 2, name: 'الأراضي الزراعية', nameFr: 'Terrains agricoles', nameEn: 'Agricultural land', slug: 'land', icon: 'land', sortOrder: 0, active: true, count: 0, subcategories: [] },
  { id: 3, name: 'البذور', nameFr: 'Semences', nameEn: 'Seeds', slug: 'seeds', icon: 'wheat', sortOrder: 2, active: true, count: 0, subcategories: [] },
  { id: 4, name: 'الأسمدة', nameFr: 'Engrais', nameEn: 'Fertilizers', slug: 'fertilizers', icon: 'flask', sortOrder: 3, active: true, count: 0, subcategories: [] },
  { id: 5, name: 'قطع الغيار', nameFr: 'Pièces détachées', nameEn: 'Spare parts', slug: 'parts', icon: 'wrench', sortOrder: 4, active: true, count: 0, subcategories: [] },
  { id: 6, name: 'المنتجات الزراعية', nameFr: 'Produits agricoles', nameEn: 'Agricultural products', slug: 'products', icon: 'basket', sortOrder: 5, active: true, count: 0, subcategories: [] },
  { id: 7, name: 'الموارد البشرية', nameFr: 'Ressources humaines', nameEn: 'Human resources', slug: 'services', icon: 'users', sortOrder: 6, active: true, count: 0, subcategories: [] },
  { id: 8, name: 'متنوع', nameFr: 'Divers', nameEn: 'Miscellaneous', slug: 'divers', icon: 'leaf', sortOrder: 7, active: true, count: 0, subcategories: [] },
];

const fieldLabels = {
  saleType: 'fieldSaleType', landCondition: 'fieldLandCondition', region: 'fieldRegion',
  customRegion: 'fieldCustomRegion', ownershipType: 'fieldOwnershipType', area: 'fieldArea',
  waterAvailable: 'fieldWaterAvailable', electricityAvailable: 'fieldElectricityAvailable',
  manufacturer: 'manufacturer', model: 'model', year: 'fieldYear', condition: 'condition',
  hours: 'fieldHours', productName: 'fieldProductName', reference: 'fieldReference',
  brand: 'fieldBrand', quantity: 'fieldQuantity', productionDate: 'fieldProductionDate',
  expiryDate: 'fieldExpiryDate', productType: 'fieldProductType', composition: 'fieldComposition',
  packageSize: 'fieldPackageSize', partName: 'fieldPartName', compatibleMachine: 'fieldCompatibleMachine',
  unit: 'fieldUnit', quality: 'fieldQuality', serviceName: 'fieldServiceName',
  specialization: 'fieldSpecialization', experience: 'fieldExperience', contactPhone: 'fieldContactPhone',
  servicePrice: 'fieldServicePrice',
} as const;

type ListingFormState = {
  title: string;
  category: string;
  subcategory: string;
  price: string;
  location: string;
  condition: string;
  year: string;
  manufacturer: string;
  model: string;
  hours: string;
  area: string;
  waterAvailable: boolean | null;
  electricityAvailable: boolean | null;
  ownershipType: string;
  contactPhone: string;
  whatsappSameAsContact: boolean;
  whatsappPhone: string;
  description: string;
  imageUrl: string;
  attributes: Record<string, unknown>;
};

const landOnlyFieldKeys = new Set<string>(LAND_ONLY_FIELD_KEYS);

export function AddListing() {
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const locationsQuery = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const createListing = useCreateListing();
  const [form, setForm] = useState<ListingFormState>({
    title: '', category: '', subcategory: '', price: '', location: '',
    condition: 'used', year: '', manufacturer: '', model: '', hours: '', area: '',
    waterAvailable: null, electricityAvailable: null, ownershipType: '', contactPhone: '',
    whatsappSameAsContact: false, whatsappPhone: '', description: '',
    imageUrl: '', attributes: {} as Record<string, unknown>,
  });
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUploadBlocked, setImageUploadBlocked] = useState(false);
  const [createdListing, setCreatedListing] = useState<{ id: number } | null>(null);
  const [requiredSelectError, setRequiredSelectError] = useState<'category' | 'location' | null>(null);
  const [subcategoryNeedsCategory, setSubcategoryNeedsCategory] = useState(false);
  const [categoryNeedsAttention, setCategoryNeedsAttention] = useState(false);
  const [phoneValidationAttempted, setPhoneValidationAttempted] = useState(false);
  const [rejectedPhoneInputs, setRejectedPhoneInputs] = useState({ contactPhone: false, whatsappPhone: false });
  const categories = categoriesQuery.data ?? categoriesFallback;
  const selectedCategory = categories.find((item) => item.slug === form.category);
  const isLandCategory = form.category === LAND_CATEGORY_SLUG;
  const fields = formFieldsForCategory(form.category);
  const activeSubcategories = (selectedCategory?.subcategories ?? []).filter((item) => item.active);
  const subcategoryOptions = activeSubcategories.map((item) => ({ value: item.slug, label: translatedName(item, language) }));
  const subcategoryHasNoCategory = !form.category;
  const subcategoryHasNoOptions = Boolean(form.category) && subcategoryOptions.length === 0;

  useEffect(() => {
    if (!subcategoryNeedsCategory) return;
    const timeout = window.setTimeout(() => {
      setSubcategoryNeedsCategory(false);
      setCategoryNeedsAttention(false);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [subcategoryNeedsCategory]);
  const update = (key: keyof typeof form, value: string | boolean | null) =>
    setForm((current) => ({ ...current, [key]: value } as ListingFormState));
  const updatePhone = (key: 'contactPhone' | 'whatsappPhone', value: string) => {
    if (!hasAllowedMauritaniaPhonePrefix(value)) {
      setRejectedPhoneInputs((current) => ({ ...current, [key]: true }));
      setPhoneValidationAttempted(true);
      return;
    }
    setRejectedPhoneInputs((current) => ({ ...current, [key]: false }));
    update(key, value);
  };
  const updateDynamic = (key: string, value: string) => {
    if (['condition', 'year', 'manufacturer', 'model', 'hours', 'area', 'ownershipType'].includes(key)) update(key as keyof typeof form, value);
    else if (key === 'waterAvailable' || key === 'electricityAvailable') update(key, value === '' ? null : value === 'yes');
    else if (key === 'region') setForm((current) => {
      const attributes = { ...current.attributes };
      if (value) attributes[key] = value;
      else delete attributes[key];
      return {
        ...current,
        ...(value && value !== 'آخر' ? { location: value } : {}),
        attributes,
      };
    });
    else setForm((current) => {
      const attributes = { ...current.attributes };
      if (value) attributes[key] = value;
      else delete attributes[key];
      return { ...current, attributes };
    });
  };
  const dynamicValue = (key: string) => {
    if (key === 'waterAvailable' || key === 'electricityAvailable') {
      const value = form[key];
      return value === null ? '' : value ? 'yes' : 'no';
    }
    return key in form && key !== 'attributes'
      ? String(form[key as keyof typeof form] ?? '')
      : String(form.attributes[key] ?? '');
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPhoneValidationAttempted(true);
    if (rejectedPhoneInputs.contactPhone || (!form.whatsappSameAsContact && rejectedPhoneInputs.whatsappPhone)) {
      const field = rejectedPhoneInputs.contactPhone ? 'input-listing-contact-phone' : 'input-listing-whatsapp-phone';
      event.currentTarget.querySelector<HTMLInputElement>(`[data-testid="${field}"]`)?.focus();
      return;
    }
    const contactPhone = normalizeMauritaniaPhone(form.contactPhone);
    const whatsappPhone = form.whatsappSameAsContact
      ? contactPhone
      : form.whatsappPhone.trim()
        ? normalizeMauritaniaPhone(form.whatsappPhone)
        : null;
    if (!contactPhone) {
      event.currentTarget.querySelector<HTMLInputElement>('[data-testid="input-listing-contact-phone"]')?.focus();
      return;
    }
    if (form.whatsappSameAsContact && !contactPhone || form.whatsappPhone.trim() && !form.whatsappSameAsContact && !whatsappPhone) {
      event.currentTarget.querySelector<HTMLInputElement>('[data-testid="input-listing-whatsapp-phone"]')?.focus();
      return;
    }
    if (!form.category) {
      setRequiredSelectError('category');
      event.currentTarget.querySelector<HTMLButtonElement>('[data-testid="select-listing-category"]')?.focus();
      return;
    }
    if (!form.location) {
      setRequiredSelectError('location');
      event.currentTarget.querySelector<HTMLButtonElement>('[data-testid="select-listing-location"]')?.focus();
      return;
    }
    if (imageUploadBlocked) return;
    const attributes = Object.fromEntries(
      Object.entries(form.attributes).filter(([key]) => isLandCategory || !landOnlyFieldKeys.has(key)),
    );
    if (isLandCategory) {
      if (regions.includes(form.location)) {
        attributes.region = form.location;
        if (form.location !== 'آخر') delete attributes.customRegion;
      } else {
        attributes.region = 'آخر';
        attributes.customRegion = form.location;
      }
    }
    const finalLocation = isLandCategory && attributes.region === 'آخر'
      ? String(attributes.customRegion ?? '').trim() || form.location
      : form.location;
    const data: ListingInput = {
      title: form.title, category: form.category, subcategory: form.subcategory || null,
      price: Number(form.price), currency: 'MRU',
      location: finalLocation, condition: form.condition as 'new' | 'used',
      year: form.year ? Number(form.year) : null, manufacturer: form.manufacturer || null,
      model: form.model || null, hours: form.hours ? Number(form.hours) : null,
      area: isLandCategory && form.area ? Number(form.area) : null,
      waterAvailable: isLandCategory ? form.waterAvailable : null,
      electricityAvailable: isLandCategory ? form.electricityAvailable : null,
      ownershipType: isLandCategory ? form.ownershipType || null : null,
      attributes, description: form.description, contactPhone,
      whatsappPhone,
      imageUrl: imagePaths[0] || form.imageUrl || undefined,
      images: imagePaths.length ? imagePaths : form.imageUrl ? [form.imageUrl] : [],
    };
     createListing.mutate({ data }, { onSuccess: (listing) => {
       if (ENABLE_PAID_LISTINGS) setCreatedListing({ id: listing.id });
       else setLocation('/dashboard');
     } });
  };

  if (createdListing) return <AppShell><PaymentConfirmationPanel listingId={createdListing.id} onDone={() => setLocation('/dashboard')} /></AppShell>;

  return <AppShell><div dir={language === 'ar' ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-4xl min-w-0">
     <PageHeading eyebrow={t('startSelling')} title={t('addNewListing')} description={t('addListingDescription')} />
     <form onSubmit={submit} className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
       <div className="border-b border-[hsl(var(--border))] p-5 sm:p-8">
         <div className="mb-6 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--accent))]">1</span><div><h2 className="text-base font-bold text-[hsl(var(--primary))]">{t('categoryAndBasics')}</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('categoryAndBasicsHelp')}</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label sm:col-span-2">{t('listingTitle')} *<input required minLength={3} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder={t('listingTitlePlaceholder')} className="field-input" data-testid="input-listing-title" /></label>
          <label className="field-label">
            {t('mainCategory')} *
            <ListingFormSelect
              value={form.category}
              placeholder={t('selectCategory')}
              direction={language === 'ar' ? 'rtl' : 'ltr'}
              options={categories.map((item) => ({ value: item.slug, label: translatedName(item, language) }))}
              onValueChange={(categorySlug) => {
                setForm((current) => ({
                  ...current,
                  category: categorySlug,
                  subcategory: '',
                  attributes: {},
                  ...(categorySlug === LAND_CATEGORY_SLUG ? {} : {
                    area: '',
                    waterAvailable: null,
                    electricityAvailable: null,
                    ownershipType: '',
                  }),
                }));
                setSubcategoryNeedsCategory(false);
                setCategoryNeedsAttention(false);
                setRequiredSelectError((current) => current === 'category' ? null : current);
              }}
              required
              attention={categoryNeedsAttention}
              ariaInvalid={requiredSelectError === 'category'}
              ariaDescribedBy={requiredSelectError === 'category' ? 'listing-category-error' : undefined}
              testId="select-listing-category"
            />
            {requiredSelectError === 'category' && <span id="listing-category-error" role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('categorySelectionRequired')}</span>}
          </label>
          {!isLandCategory && (
            <label className="field-label">
              {t('subcategory')}
              <ListingFormSelect
                value={form.subcategory}
                placeholder={subcategoryHasNoOptions ? t('noSubcategories') : t('chooseSubcategory')}
                direction={language === 'ar' ? 'rtl' : 'ltr'}
                options={subcategoryOptions}
                onValueChange={(value) => update('subcategory', value)}
                ariaDisabled={subcategoryHasNoCategory || subcategoryHasNoOptions}
                ariaDescribedBy={subcategoryNeedsCategory ? 'listing-subcategory-help' : undefined}
                onUnavailableClick={() => {
                  if (!form.category) {
                    setSubcategoryNeedsCategory(true);
                    setCategoryNeedsAttention(true);
                  }
                }}
                clearable
                clearLabel={t('clearSelection')}
                testId="select-listing-subcategory"
              />
              {subcategoryNeedsCategory && (
                <span id="listing-subcategory-help" role="status" data-testid="status-subcategory-category-required" className="mt-1 block text-xs font-medium text-[hsl(var(--primary))]">
                  {t('chooseMainCategoryFirst')}
                </span>
              )}
            </label>
          )}
          <label className="field-label">
            {t('location')} *
            <ListingFormSelect
              value={form.location}
              placeholder={t('chooseRegion')}
              direction={language === 'ar' ? 'rtl' : 'ltr'}
              options={[
                ...regions.map((region) => ({ value: region, label: translateLocationName(region, language) })),
                ...(locationsQuery.data ?? []).filter((item) => !regions.includes(item.name)).map((item) => ({ value: item.name, label: translateLocationName(item.name, language) })),
              ]}
              onValueChange={(value) => {
                setForm((current) => {
                  const attributes = { ...current.attributes };
                  if (value !== 'آخر') delete attributes.customRegion;
                  return { ...current, location: value, attributes };
                });
                setRequiredSelectError((current) => current === 'location' ? null : current);
              }}
              required
              ariaInvalid={requiredSelectError === 'location'}
              ariaDescribedBy={requiredSelectError === 'location' ? 'listing-location-error' : undefined}
              testId="select-listing-location"
            />
            {requiredSelectError === 'location' && <span id="listing-location-error" role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('locationSelectionRequired')}</span>}
          </label>
            <label className="field-label min-w-0">{t('price')} *<div dir={language === 'ar' ? 'rtl' : 'ltr'} className="flex min-w-0 gap-0"><input required min="0" type="number" value={form.price} onChange={(event) => update('price', event.target.value)} className={`field-input min-w-0 flex-1 ${language === 'ar' ? 'rounded-l-none' : 'rounded-r-none'}`} data-testid="input-listing-price" /><span className={`field-input flex w-24 shrink-0 items-center justify-center font-numeric ${language === 'ar' ? 'rounded-r-none border-r-0' : 'rounded-l-none border-l-0'}`} dir="ltr" data-testid="listing-currency">MRU</span></div></label>
           <label className="field-label">
             {t('listingContactPhone')} *
             <div className="mt-1 flex" dir="ltr">
               <span aria-hidden="true" className="field-input flex w-16 shrink-0 items-center justify-center rounded-r-none font-numeric">+222</span>
                <input value={form.contactPhone} onChange={(event) => updatePhone('contactPhone', event.target.value)} type="tel" dir="ltr" className="field-input min-w-0 flex-1 rounded-l-none border-l-0 text-left font-numeric" autoComplete="tel-national" placeholder="36 12 34 56" aria-invalid={rejectedPhoneInputs.contactPhone || (phoneValidationAttempted && !normalizeMauritaniaPhone(form.contactPhone))} data-testid="input-listing-contact-phone" />
             </div>
              {(rejectedPhoneInputs.contactPhone || (phoneValidationAttempted && !normalizeMauritaniaPhone(form.contactPhone))) && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
           </label>
           <div className="sm:col-span-2">
             <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.whatsappSameAsContact} onChange={(event) => {
                  update('whatsappSameAsContact', event.target.checked);
                  if (event.target.checked) setRejectedPhoneInputs((current) => ({ ...current, whatsappPhone: false }));
                }} className="mt-0.5 accent-[hsl(var(--primary))]" data-testid="checkbox-whatsapp-same-contact" />
                <span className="inline-flex items-center gap-1.5"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('whatsappSameAsContact')}</span>
             </label>
             {!form.whatsappSameAsContact && (
               <label className="field-label mt-3 block">
                  <span className="inline-flex items-center gap-1.5"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('whatsappAlternativePhone')}</span>
                 <div className="mt-1 flex" dir="ltr">
                   <span aria-hidden="true" className="field-input flex w-16 shrink-0 items-center justify-center rounded-r-none font-numeric">+222</span>
                    <input value={form.whatsappPhone} onChange={(event) => updatePhone('whatsappPhone', event.target.value)} type="tel" dir="ltr" className="field-input min-w-0 flex-1 rounded-l-none border-l-0 text-left font-numeric" autoComplete="tel-national" placeholder="36 12 34 56" aria-invalid={rejectedPhoneInputs.whatsappPhone || (phoneValidationAttempted && Boolean(form.whatsappPhone.trim()) && !normalizeMauritaniaPhone(form.whatsappPhone))} data-testid="input-listing-whatsapp-phone" />
                 </div>
                  {(rejectedPhoneInputs.whatsappPhone || (phoneValidationAttempted && Boolean(form.whatsappPhone.trim()) && !normalizeMauritaniaPhone(form.whatsappPhone))) && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
               </label>
             )}
             {phoneValidationAttempted && form.whatsappSameAsContact && !normalizeMauritaniaPhone(form.contactPhone) && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
           </div>
        </div>
      </div>
       <div className="border-b border-[hsl(var(--border))] p-5 sm:p-8">
         <div className="mb-6 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">2</span><div><h2 className="text-base font-bold text-[hsl(var(--primary))]">{t('categorySpecificFields')}</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('categorySpecificFieldsHelp')}</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              if (field.key === 'customRegion' && form.location !== 'آخر') return null;
              return (
                <label key={field.key} className="field-label">
                  {t(fieldLabels[field.key as keyof typeof fieldLabels] ?? 'fieldProductName')}
                  {field.type === 'select' ? (
                    <ListingFormSelect
                      value={dynamicValue(field.key)}
                      placeholder={t('select')}
                      direction={language === 'ar' ? 'rtl' : 'ltr'}
                      options={(field.options ?? []).map((option) => ({
                        value: option.value,
                        label: translateMarketplaceOption(option.value, language),
                      }))}
                      onValueChange={(value) => updateDynamic(field.key, value)}
                      clearable={field.key !== 'condition'}
                      clearLabel={t('clearSelection')}
                      testId={`category-field-${field.key}`}
                    />
                  ) : (
                    <input data-testid={`category-field-${field.key}`} type={field.type} value={dynamicValue(field.key)} onChange={(event) => updateDynamic(field.key, event.target.value)} placeholder={field.key === 'customRegion' ? t('fieldCustomRegion') : field.key === 'ownershipType' ? t('fieldOwnershipType') : undefined} className="field-input" />
                  )}
                </label>
              );
            })}
          </div>
        <label className="field-label mt-5">{t('description')} *<textarea required minLength={10} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder={t('descriptionPlaceholder')} className="field-input min-h-[140px] resize-y leading-6" data-testid="textarea-listing-description" /></label>
        <ListingImageUploader onChange={setImagePaths} onUploadStateChange={setImageUploadBlocked} />
      </div>
        <div className="flex flex-col-reverse justify-between gap-4 bg-[hsl(var(--secondary)/.35)] p-5 sm:flex-row sm:items-center sm:p-8"><p className="flex items-center gap-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck size={16} className="shrink-0 text-[hsl(var(--primary))]" />{t('listingReview')}</p><button type="submit" disabled={createListing.isPending || imageUploadBlocked} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto" data-testid="button-submit-listing">{createListing.isPending && <LoaderCircle size={15} className="animate-spin" />}{t('publishListing')}</button></div>
    </form>
  </div></AppShell>;
}