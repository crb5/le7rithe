import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { getGetDashboardSummaryQueryKey, getGetListingQueryKey, getListListingsQueryKey, getListSellerActiveListingsQueryKey, useUpdateListing } from '@workspace/api-client-react';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { ListingEditPhotos } from '@/components/listing-edit-photos';
import { ListingContentEditSection } from '@/components/listing-content-edit-section';
import { EDIT_WINDOW_MINUTES, getListingContentEditWindow } from '@workspace/api-zod/listing-edit-window';
import { useQueryClient } from '@tanstack/react-query';
import { ListingImage, getListingImageSources } from '@/components/marketplace-ui';
import { formFieldsForCategory, regions } from '@/lib/category-catalog';
import { useLanguage } from '@/lib/language';
import { canonicalizeLocationName, translateLocationName, translateMarketplaceOption } from '@/lib/listing-localization';
import { useListingTaxonomy } from '@/lib/listing-taxonomy';
import { getMauritaniaPhoneInputValue, hasAllowedMauritaniaPhonePrefix, normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { useToast } from '@/hooks/use-toast';
import { listingFieldValue } from '@/lib/listing-detail-fields';
import { ListingFormSelect } from '@/components/listing-form-select';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import type { Listing } from './marketplace-shared';


export const invalidateListingViews = (queryClient: ReturnType<typeof useQueryClient>, listingId: number) => {
  queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  queryClient.invalidateQueries({ queryKey: getListSellerActiveListingsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getListListingsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
};


export function SaleCountdown({ until, onExpired }: { until: string | null; onExpired?: () => void }) {
  const [remaining, setRemaining] = useState(() => until ? Math.max(0, new Date(until).getTime() - Date.now()) : 0);
  useEffect(() => {
    if (!until) {
      setRemaining(0);
      return;
    }
    const update = () => {
      const next = Math.max(0, new Date(until).getTime() - Date.now());
      setRemaining(next);
      if (next === 0) onExpired?.();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [onExpired, until]);
  if (remaining <= 0) return null;
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return <span dir="ltr">{minutes}:{seconds}</span>;
}


export function SaleControls({
  listing,
  onMarkSold,
  onUndoSale,
  markPending,
  undoPending,
}: {
  listing: Listing;
  onMarkSold: (listing: Listing) => void;
  onUndoSale: (listing: Listing) => void;
  markPending: boolean;
  undoPending: boolean;
}) {
  const { t } = useLanguage();
  const [windowOpen, setWindowOpen] = useState(Boolean(listing.canRevertSale));
  const isRental = listing.attributes?.saleType === 'rent';
  if (isRental) {
    if (listing.rentalStatus === 'leased') {
      return <span className="rounded-lg bg-[hsl(var(--destructive)/.12)] px-2.5 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))]">{t('leased')}</span>;
    }
    return <button type="button" onClick={() => onMarkSold(listing)} disabled={markPending} className="rounded-lg bg-[hsl(var(--accent))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary))] disabled:opacity-50" data-testid={`button-mark-leased-${listing.id}`}>{markPending ? t('saving') : t('markAsLeased')}</button>;
  }
  const isSold = listing.saleStatus === 'sold';
  useEffect(() => setWindowOpen(Boolean(listing.canRevertSale)), [listing.canRevertSale, listing.id]);
  if (!isSold) {
    return <button type="button" onClick={() => onMarkSold(listing)} disabled={markPending} className="rounded-lg bg-[hsl(var(--accent))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary))] disabled:opacity-50" data-testid={`button-mark-sold-${listing.id}`}>{markPending ? t('saving') : t('markAsSold')}</button>;
  }
  return <div className="flex flex-wrap items-center justify-end gap-2">
    <span className="rounded-lg bg-[hsl(var(--destructive)/.12)] px-2.5 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))]">{t('sold')}</span>
    {windowOpen && listing.saleRevertUntil ? <button type="button" onClick={() => onUndoSale(listing)} disabled={undoPending} className="rounded-lg border border-[hsl(var(--primary)/.18)] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary))] disabled:opacity-50" data-testid={`button-undo-sale-${listing.id}`}>{undoPending ? t('saving') : <>{t('undoSale')} · <SaleCountdown until={listing.saleRevertUntil} onExpired={() => setWindowOpen(false)} /></>}</button> : <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('saleFinal')}</span>}
  </div>;
}

export type EditableListingForm = {
  title: string;
  price: string;
  location: string;
  condition: 'new' | 'used';
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
  attributes: Record<string, unknown>;
};


export function EditListingDialog({ listing, onClose, onSaved, mutation }: { listing: Listing; onClose: () => void; onSaved: () => void; mutation: ReturnType<typeof useUpdateListing> }) {
  const { t, language } = useLanguage();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useBodyScrollLock(true, dialogRef);
  const { toast } = useToast();
  const { categoryName, subcategoryName } = useListingTaxonomy();
  const [originalImages] = useState(() => [...new Set([
    ...getListingImageSources(listing.images),
    ...getListingImageSources(undefined, listing.imageUrl),
  ])]);
  const [editedImages, setEditedImages] = useState(originalImages);
  const [contentUploadBlocked, setContentUploadBlocked] = useState(false);
  const [contentClock, setContentClock] = useState(Date.now);
  const contentWindowOpen = getListingContentEditWindow(listing.createdAt, contentClock).editable;
  useEffect(() => {
    const timer = window.setInterval(() => setContentClock(Date.now()), 1000);
    const remaining = getListingContentEditWindow(listing.createdAt).remainingMs;
    const deadlineTimer = remaining > 0 ? window.setTimeout(() => setContentClock(Date.now()), remaining) : undefined;
    return () => {
      window.clearInterval(timer);
      if (deadlineTimer !== undefined) window.clearTimeout(deadlineTimer);
    };
  }, [listing.createdAt]);
  const fields = formFieldsForCategory(listing.categorySlug).filter((field) => field.key !== 'customRegion');
  const originalContactPhone = getMauritaniaPhoneInputValue(listing.contactPhone ?? '');
  const originalWhatsappPhone = getMauritaniaPhoneInputValue(listing.whatsappPhone ?? '');
  const normalizedSavedContactPhone = normalizeMauritaniaPhone(listing.contactPhone ?? '');
  const normalizedSavedWhatsappPhone = normalizeMauritaniaPhone(listing.whatsappPhone ?? '');
  const initialWhatsappSameAsContact = Boolean(
    listing.whatsappPhone
      && (listing.whatsappPhone === listing.contactPhone
        || (normalizedSavedWhatsappPhone && normalizedSavedWhatsappPhone === normalizedSavedContactPhone)),
  );
  const [form, setForm] = useState<EditableListingForm>(() => ({
    title: listing.title,
    price: String(listing.price),
    location: String(listingFieldValue(listing, 'location') ?? ''),
    condition: listing.condition,
    year: listing.year == null ? '' : String(listing.year),
    manufacturer: listing.manufacturer ?? '',
    model: listing.model ?? '',
    hours: listing.hours == null ? '' : String(listing.hours),
    area: listing.area == null ? '' : String(listing.area),
    waterAvailable: listing.waterAvailable ?? null,
    electricityAvailable: listing.electricityAvailable ?? null,
    ownershipType: listing.ownershipType ?? '',
    contactPhone: originalContactPhone,
    whatsappSameAsContact: initialWhatsappSameAsContact,
    whatsappPhone: initialWhatsappSameAsContact ? '' : originalWhatsappPhone,
    description: listing.description ?? '',
    attributes: { ...listing.attributes },
  }));
  const [phoneValidationAttempted, setPhoneValidationAttempted] = useState(false);
  const [rejectedPhoneInputs, setRejectedPhoneInputs] = useState({ contactPhone: false, whatsappPhone: false });
  const contactPhoneChanged = form.contactPhone !== originalContactPhone;
  const contactPhoneInvalid = (contactPhoneChanged && !normalizeMauritaniaPhone(form.contactPhone))
    || rejectedPhoneInputs.contactPhone;
  const whatsappSameNeedsValidation = form.whatsappSameAsContact
    && (!initialWhatsappSameAsContact || contactPhoneChanged);
  const whatsappAlternativeChanged = !form.whatsappSameAsContact
    && (initialWhatsappSameAsContact
      ? Boolean(form.whatsappPhone.trim())
      : form.whatsappPhone !== originalWhatsappPhone);
  const whatsappPhoneInvalid = (
    whatsappSameNeedsValidation
      ? !normalizeMauritaniaPhone(form.contactPhone)
      : whatsappAlternativeChanged && !normalizeMauritaniaPhone(form.whatsappPhone)
  ) || (form.whatsappSameAsContact ? rejectedPhoneInputs.contactPhone : rejectedPhoneInputs.whatsappPhone);

  const update = <K extends keyof EditableListingForm>(key: K, value: EditableListingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updatePhone = (key: 'contactPhone' | 'whatsappPhone', value: string) => {
    if (!hasAllowedMauritaniaPhonePrefix(value)) {
      setRejectedPhoneInputs((current) => ({ ...current, [key]: true }));
      setPhoneValidationAttempted(true);
      return;
    }
    setRejectedPhoneInputs((current) => ({ ...current, [key]: false }));
    update(key, value);
  };
  const dynamicValue = (key: string) => {
    if (key === 'waterAvailable' || key === 'electricityAvailable') {
      const value = form[key] as boolean | null;
      return value == null ? '' : value ? 'yes' : 'no';
    }
    if (key in form && key !== 'attributes') return String(form[key as keyof EditableListingForm] ?? '');
    return String(form.attributes[key] ?? '');
  };
  const updateDynamic = (key: string, value: string) => {
    if (key === 'condition') update('condition', value as 'new' | 'used');
    else if (['year', 'manufacturer', 'model', 'hours', 'area', 'ownershipType'].includes(key)) update(key as keyof EditableListingForm, value as never);
    else if (key === 'waterAvailable' || key === 'electricityAvailable') update(key, value === '' ? null : value === 'yes');
     else if (key === 'region') {
       setForm((current) => {
         const attributes = { ...current.attributes };
         if (value) attributes[key] = value;
         else delete attributes[key];
         return {
           ...current,
           ...(value && value !== 'آخر' ? { location: value } : {}),
           attributes,
         };
       });
    } else {
       setForm((current) => {
         const attributes = { ...current.attributes };
         if (value) attributes[key] = value;
         else delete attributes[key];
         return { ...current, attributes };
       });
    }
  };
  const submit = () => {
    const canEditContent = getListingContentEditWindow(listing.createdAt).editable;
    if (!canEditContent && contentWindowOpen
      && (form.description !== (listing.description ?? '') || JSON.stringify(editedImages) !== JSON.stringify(originalImages))) {
      setContentClock(Date.now());
      toast({ title: t('contentEditWindowClosed', { minutes: EDIT_WINDOW_MINUTES }), variant: 'destructive' });
      return;
    }
    if (mutation.isPending || (canEditContent && contentUploadBlocked)) return;
    const descriptionChanged = canEditContent && form.description !== (listing.description ?? '');
    const imagesChanged = canEditContent && JSON.stringify(editedImages) !== JSON.stringify(originalImages);
    if (descriptionChanged && form.description.trim().length < 10) {
      toast({ title: t('dataLoadError'), variant: 'destructive' });
      return;
    }
    setPhoneValidationAttempted(true);
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return;
    let normalizedContactPhone: string | undefined;
    if (contactPhoneChanged || !listing.contactPhone) {
      const normalized = normalizeMauritaniaPhone(form.contactPhone);
      if (!normalized) return;
      normalizedContactPhone = normalized;
    }
    let whatsappPhoneUpdate: string | null | undefined;
    if (form.whatsappSameAsContact) {
      if (whatsappSameNeedsValidation) {
        const samePhone = normalizeMauritaniaPhone(form.contactPhone);
        if (!samePhone) return;
        whatsappPhoneUpdate = samePhone;
      }
    } else if (initialWhatsappSameAsContact) {
      whatsappPhoneUpdate = form.whatsappPhone.trim()
        ? normalizeMauritaniaPhone(form.whatsappPhone)
        : null;
      if (form.whatsappPhone.trim() && !whatsappPhoneUpdate) return;
    } else if (whatsappAlternativeChanged) {
      whatsappPhoneUpdate = form.whatsappPhone.trim()
        ? normalizeMauritaniaPhone(form.whatsappPhone)
        : null;
      if (form.whatsappPhone.trim() && !whatsappPhoneUpdate) return;
    }
    mutation.mutate({
      id: listing.id,
      data: {
        price,
        currency: 'MRU',
        contactPhone: normalizedContactPhone ?? listing.contactPhone ?? form.contactPhone,
        ...(whatsappPhoneUpdate === undefined ? {} : { whatsappPhone: whatsappPhoneUpdate }),
        ...(descriptionChanged ? { description: form.description } : {}),
        ...(imagesChanged ? { images: editedImages } : {}),
      },
    }, {
      onSuccess: onSaved,
      onError: (error) => toast({
        title: (descriptionChanged || imagesChanged) && (error as { status?: number }).status === 403
          ? t('contentEditWindowClosed', { minutes: EDIT_WINDOW_MINUTES }) : t('dataLoadError'),
        variant: 'destructive',
      }),
    });
  };
  const commonDynamicKeys = new Set(['condition', 'year', 'manufacturer', 'model', 'hours', 'area', 'ownershipType', 'waterAvailable', 'electricityAvailable']);
  const dynamicLabelKeys: Record<string, keyof typeof import('@/locales/en').default> = {
    saleType: 'fieldSaleType', landCondition: 'fieldLandCondition', region: 'fieldRegion', customRegion: 'fieldCustomRegion',
    ownershipType: 'fieldOwnershipType', area: 'fieldArea', waterAvailable: 'fieldWaterAvailable', electricityAvailable: 'fieldElectricityAvailable',
    manufacturer: 'manufacturer', model: 'model', year: 'fieldYear', condition: 'condition', hours: 'fieldHours',
    productName: 'fieldProductName', reference: 'fieldReference', brand: 'fieldBrand', quantity: 'fieldQuantity',
    productionDate: 'fieldProductionDate', expiryDate: 'fieldExpiryDate', productType: 'fieldProductType', composition: 'fieldComposition',
    packageSize: 'fieldPackageSize', partName: 'fieldPartName', compatibleMachine: 'fieldCompatibleMachine', unit: 'fieldUnit',
    quality: 'fieldQuality', serviceName: 'fieldServiceName', specialization: 'fieldSpecialization', experience: 'fieldExperience',
    contactPhone: 'fieldContactPhone', servicePrice: 'fieldServicePrice',
  };
  return <div ref={dialogRef} dir={language === 'ar' ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[hsl(var(--primary)/.45)] p-4 backdrop-blur-sm">
    <div className="mobile-modal-panel my-4 w-full max-w-3xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl sm:p-7">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-[hsl(var(--primary))]">{t('editListing')}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('editListingDescription', { minutes: EDIT_WINDOW_MINUTES })}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--secondary))]" aria-label={t('close')} data-testid="button-close-edit"><X size={18} /></button></div>
      <div className="mb-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.2)] p-3" data-testid="listing-edit-locked-details">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--secondary))]">
            <ListingImage images={listing.images} imageUrl={listing.imageUrl} category={listing} alt={listing.title} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" data-testid="text-edit-listing-title">{listing.title}</p>
            <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{categoryName(listing.categorySlug, listing.category)}</p>
            <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{translateLocationName(listing.location, language)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('publishedListingNotice')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2" data-testid="published-listing-edit-fields">
         <label className="field-label min-w-0">{t('price')} *<div dir={language === 'ar' ? 'rtl' : 'ltr'} className="mt-1 flex min-w-0 gap-0"><input required min="0" step="any" type="number" value={form.price} onChange={(event) => update('price', event.target.value)} className={`field-input min-w-0 flex-1 ${language === 'ar' ? 'rounded-l-none' : 'rounded-r-none'}`} data-testid="input-edit-price" /><span className={`field-input flex w-24 shrink-0 items-center justify-center font-numeric ${language === 'ar' ? 'rounded-r-none border-r-0' : 'rounded-l-none border-l-0'}`} dir="ltr" data-testid="edit-listing-currency">MRU</span></div></label>
        <label className="field-label sm:col-span-2">
          {t('listingContactPhone')}
          <div className="mt-1 flex" dir="ltr">
            <span aria-hidden="true" className="field-input flex w-16 shrink-0 items-center justify-center rounded-r-none font-numeric">+222</span>
            <input required={contactPhoneChanged || !listing.contactPhone} value={form.contactPhone} onChange={(event) => updatePhone('contactPhone', event.target.value)} type="tel" dir="ltr" className="field-input min-w-0 flex-1 rounded-l-none border-l-0 text-left font-numeric" autoComplete="tel-national" placeholder="36 12 34 56" aria-invalid={phoneValidationAttempted && contactPhoneInvalid} data-testid="input-edit-contact-phone" />
          </div>
          {phoneValidationAttempted && contactPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
        </label>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.whatsappSameAsContact} onChange={(event) => {
              update('whatsappSameAsContact', event.target.checked);
              if (event.target.checked) setRejectedPhoneInputs((current) => ({ ...current, whatsappPhone: false }));
            }} className="mt-0.5 accent-[hsl(var(--primary))]" data-testid="checkbox-edit-whatsapp-same-contact" />
            <span className="inline-flex items-center gap-1.5"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('whatsappSameAsContact')}</span>
          </label>
          {!form.whatsappSameAsContact && <label className="field-label mt-3 block">
            <span className="inline-flex items-center gap-1.5"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('whatsappAlternativePhone')}</span>
            <div className="mt-1 flex" dir="ltr">
              <span aria-hidden="true" className="field-input flex w-16 shrink-0 items-center justify-center rounded-r-none font-numeric">+222</span>
              <input value={form.whatsappPhone} onChange={(event) => updatePhone('whatsappPhone', event.target.value)} type="tel" dir="ltr" className="field-input min-w-0 flex-1 rounded-l-none border-l-0 text-left font-numeric" autoComplete="tel-national" placeholder="36 12 34 56" aria-invalid={phoneValidationAttempted && whatsappPhoneInvalid} data-testid="input-edit-whatsapp-phone" />
            </div>
            {phoneValidationAttempted && whatsappPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
          </label>}
          {phoneValidationAttempted && form.whatsappSameAsContact && whatsappPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
        </div>
      </div>
      {false && <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label sm:col-span-2">{t('listingTitle')}<input required minLength={3} value={form.title} onChange={(event) => update('title', event.target.value)} className="field-input" data-testid="input-edit-title" /></label>
        <label className="field-label">{t('mainCategory')}<input value={categoryName(listing.categorySlug, listing.category)} readOnly className="field-input cursor-not-allowed bg-[hsl(var(--muted)/.4)]" data-testid="input-edit-category" /></label>
        <label className="field-label">{t('subcategory')}<input value={listing.subcategory ? subcategoryName(listing.categorySlug, listing.subcategorySlug ?? '', listing.subcategory ?? '') : t('notAvailable')} readOnly className="field-input cursor-not-allowed bg-[hsl(var(--muted)/.4)]" data-testid="input-edit-subcategory" /></label>
        <label className="field-label min-w-0">{t('price')}<div dir={language === 'ar' ? 'rtl' : 'ltr'} className="flex min-w-0 gap-0"><input required min="0" type="number" value={form.price} onChange={(event) => update('price', event.target.value)} className={`field-input min-w-0 flex-1 ${language === 'ar' ? 'rounded-l-none' : 'rounded-r-none'}`} data-testid="input-edit-price" /><span className={`field-input flex w-24 shrink-0 items-center justify-center font-numeric ${language === 'ar' ? 'rounded-r-none border-r-0' : 'rounded-l-none border-l-0'}`} dir="ltr" data-testid="edit-listing-currency">MRU</span></div></label>
        <label className="field-label">{t('location')}<input required value={translateLocationName(form.location, language)} onChange={(event) => update('location', canonicalizeLocationName(event.target.value, language))} className="field-input" list="edit-listing-regions" data-testid="input-edit-location" /><datalist id="edit-listing-regions">{regions.map((region) => <option key={region} value={translateLocationName(region, language)} />)}</datalist></label>
         <label className="field-label">
           {t('condition')}
            <ListingFormSelect
              value={form.condition}
              placeholder={t('select')}
              direction={language === 'ar' ? 'rtl' : 'ltr'}
              options={[
                { value: 'new', label: t('new') },
                { value: 'used', label: t('used') },
              ]}
              onValueChange={(value) => update('condition', value as EditableListingForm['condition'])}
              testId="select-edit-condition"
            />
         </label>
        <label className="field-label">{t('fieldYear')}<input type="number" value={form.year} onChange={(event) => update('year', event.target.value)} className="field-input" data-testid="input-edit-year" /></label>
        <label className="field-label">{t('manufacturer')}<input value={form.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} className="field-input" data-testid="input-edit-manufacturer" /></label>
        <label className="field-label">{t('model')}<input value={form.model} onChange={(event) => update('model', event.target.value)} className="field-input" data-testid="input-edit-model" /></label>
        <label className="field-label">{t('fieldHours')}<input type="number" value={form.hours} onChange={(event) => update('hours', event.target.value)} className="field-input" data-testid="input-edit-hours" /></label>
        <label className="field-label">{t('fieldArea')}<input type="number" step="any" value={form.area} onChange={(event) => update('area', event.target.value)} className="field-input" data-testid="input-edit-area" /></label>
        <label className="field-label">{t('fieldOwnershipType')}<input value={form.ownershipType} onChange={(event) => update('ownershipType', event.target.value)} className="field-input" data-testid="input-edit-ownership" /></label>
          <label className="field-label">
            {t('fieldWaterAvailable')}
            <ListingFormSelect
              value={form.waterAvailable == null ? '' : form.waterAvailable ? 'yes' : 'no'}
              placeholder={t('select')}
              direction={language === 'ar' ? 'rtl' : 'ltr'}
              options={[
                { value: 'yes', label: t('available') },
                { value: 'no', label: t('unavailable') },
              ]}
              onValueChange={(value) => update('waterAvailable', value === '' ? null : value === 'yes')}
              clearable
              clearLabel={t('clearSelection')}
              testId="select-edit-water"
            />
          </label>
          <label className="field-label">
            {t('fieldElectricityAvailable')}
            <ListingFormSelect
              value={form.electricityAvailable == null ? '' : form.electricityAvailable ? 'yes' : 'no'}
              placeholder={t('select')}
              direction={language === 'ar' ? 'rtl' : 'ltr'}
              options={[
                { value: 'yes', label: t('available') },
                { value: 'no', label: t('unavailable') },
              ]}
              onValueChange={(value) => update('electricityAvailable', value === '' ? null : value === 'yes')}
              clearable
              clearLabel={t('clearSelection')}
              testId="select-edit-electricity"
            />
          </label>
          {fields.filter((field) => !commonDynamicKeys.has(field.key)).map((field) => (
            <label key={field.key} className="field-label">
              {t(dynamicLabelKeys[field.key] ?? 'additionalInformation')}
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
                  testId={`select-edit-${field.key}`}
                />
              ) : (
                <input type={field.type} value={dynamicValue(field.key)} onChange={(event) => updateDynamic(field.key, event.target.value)} className="field-input" data-testid={`input-edit-${field.key}`} />
              )}
            </label>
          ))}
         <label className="field-label sm:col-span-2">
           {t('listingContactPhone')}
           <div className="mt-1 flex" dir="ltr">
             <span aria-hidden="true" className="field-input flex w-16 shrink-0 items-center justify-center rounded-r-none font-numeric">+222</span>
             <input required={contactPhoneChanged} value={form.contactPhone} onChange={(event) => updatePhone('contactPhone', event.target.value)} type="tel" dir="ltr" className="field-input min-w-0 flex-1 rounded-l-none border-l-0 text-left font-numeric" autoComplete="tel-national" placeholder="36 12 34 56" aria-invalid={phoneValidationAttempted && contactPhoneInvalid} data-testid="input-edit-contact-phone" />
           </div>
           {phoneValidationAttempted && contactPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
         </label>
         <div className="sm:col-span-2">
           <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
             <input type="checkbox" checked={form.whatsappSameAsContact} onChange={(event) => {
               update('whatsappSameAsContact', event.target.checked);
               if (event.target.checked) setRejectedPhoneInputs((current) => ({ ...current, whatsappPhone: false }));
             }} className="mt-0.5 accent-[hsl(var(--primary))]" data-testid="checkbox-edit-whatsapp-same-contact" />
              <span className="inline-flex items-center gap-1.5"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('whatsappSameAsContact')}</span>
           </label>
           {!form.whatsappSameAsContact && (
             <label className="field-label mt-3 block">
                <span className="inline-flex items-center gap-1.5"><WhatsAppIcon size={15} className="text-[#25D366]" />{t('whatsappAlternativePhone')}</span>
               <div className="mt-1 flex" dir="ltr">
                 <span aria-hidden="true" className="field-input flex w-16 shrink-0 items-center justify-center rounded-r-none font-numeric">+222</span>
                 <input value={form.whatsappPhone} onChange={(event) => updatePhone('whatsappPhone', event.target.value)} type="tel" dir="ltr" className="field-input min-w-0 flex-1 rounded-l-none border-l-0 text-left font-numeric" autoComplete="tel-national" placeholder="36 12 34 56" aria-invalid={phoneValidationAttempted && whatsappPhoneInvalid} data-testid="input-edit-whatsapp-phone" />
               </div>
               {phoneValidationAttempted && whatsappPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
             </label>
           )}
           {phoneValidationAttempted && form.whatsappSameAsContact && whatsappPhoneInvalid && <span role="alert" className="mt-1 block text-xs font-medium text-[hsl(var(--destructive))]">{t('mauritaniaPhoneInvalid')}</span>}
         </div>
        <label className="field-label sm:col-span-2">{t('description')}<textarea required minLength={10} value={form.description} onChange={(event) => update('description', event.target.value)} className="field-input min-h-[120px] resize-y" data-testid="textarea-edit-description" /></label>
      </div>}
      <ListingContentEditSection publishedAt={listing.createdAt} now={contentClock}>
        <label className="field-label">{t('description')}<textarea minLength={10} maxLength={10000} value={form.description} onChange={(event) => update('description', event.target.value)} className="field-input min-h-[120px] resize-y" data-testid="textarea-edit-description-window" /></label>
        <ListingEditPhotos initialImages={originalImages} onChange={setEditedImages} onBlocked={setContentUploadBlocked} />
      </ListingContentEditSection>
      <button type="button" onClick={submit} disabled={mutation.isPending || (contentWindowOpen && contentUploadBlocked) || !form.price.trim() || !Number.isFinite(Number(form.price)) || Number(form.price) < 0} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-save-edit">{mutation.isPending && <LoaderCircle size={15} className="animate-spin" />}{mutation.isPending ? t('saving') : t('saveChanges')}</button>
    </div>
  </div>;
}
