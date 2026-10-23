import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  LoaderCircle,
  Phone,
  X,
} from 'lucide-react';
import {
  getGetListingQueryKey,
  useGetListing,
  type Listing as ApiListing,
} from '@workspace/api-client-react';
import { AppShell, ErrorState, getListingImageSources, ListingImage, formatPrice, relativeDate } from '@/components/marketplace-ui';
import { ListingDetailFields, ListingSellerCard } from '@/components/listing-detail-fields';
import { ListingDescription } from '@/components/listing-description';
import { SellerReviews } from '@/components/seller-reviews';
import { ListingDetailLoading, detailBreadcrumbClass, detailGalleryClass, detailGridClass } from '@/components/listing-detail-loading';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { useLanguage } from '@/lib/language';
import { useListingTaxonomy } from '@/lib/listing-taxonomy';
import { LAND_CATEGORY_SLUG } from '@/lib/category-catalog';
import { ListingImageLightbox } from './marketplace';
import { normalizeMauritaniaPhone } from '@/lib/mauritania-phone';
import { useToggleFavorite } from '@/lib/use-favorites';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import NotFound from './not-found';

type Listing = ApiListing & { whatsappPhone?: string | null };

export function ListingDetail() {
  const { language, t } = useLanguage();
  const { categoryName } = useListingTaxonomy();
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const queryClient = useQueryClient();
  const listingQuery = useGetListing(id, {
    query: {
      queryKey: getGetListingQueryKey(id),
      enabled: validId,
      retry: (attempt, error) => (error as { status?: number }).status !== 404 && attempt < 1,
    },
  });
  const toggleFavorite = useToggleFavorite();
  const [reportOpen, setReportOpen] = useState(false);
  const reportDialogRef = useRef<HTMLDivElement | null>(null);
  useBodyScrollLock(reportOpen, reportDialogRef, 'div.fixed.inset-0.z-50.flex');
  const [reportReason, setReportReason] = useState('fraud');
  const [reportDetails, setReportDetails] = useState('');
  const [reportPending, setReportPending] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const activeThumbnailRef = useRef<HTMLButtonElement | null>(null);
  const mainImageSwipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressSwipeClickRef = useRef(false);
  const suppressSwipeClickTimerRef = useRef<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const listing = listingQuery.data as Listing | undefined;
  const gallery = listing ? [...new Set([
    ...getListingImageSources(listing.images),
    ...getListingImageSources(undefined, listing.imageUrl),
  ])] : [];

  useEffect(() => {
    if (gallery.length < 2 || galleryPaused || lightboxOpen) return;
    const timeout = window.setTimeout(() => {
      setActiveImage((current) => (current + 1) % gallery.length);
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [activeImage, gallery.length, galleryPaused, lightboxOpen]);

  useEffect(() => {
    const thumbnail = activeThumbnailRef.current;
    const strip = thumbnail?.parentElement;
    if (!thumbnail || !strip) return;
    const stripRect = strip.getBoundingClientRect();
    const visibleLeft = stripRect.left + strip.clientLeft;
    const visibleRight = visibleLeft + strip.clientWidth;
    const thumbnailRect = thumbnail.getBoundingClientRect();
    const scrollDelta = thumbnailRect.left < visibleLeft
      ? thumbnailRect.left - visibleLeft
      : thumbnailRect.right > visibleRight
        ? thumbnailRect.right - visibleRight
        : 0;
    if (scrollDelta !== 0) {
      strip.scrollBy({
        left: scrollDelta,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  }, [activeImage, listing?.id]);

  if (!validId || (listingQuery.error as { status?: number } | null)?.status === 404) return <NotFound />;
  if (listingQuery.isLoading) {
    return <AppShell><ListingDetailLoading /></AppShell>;
  }
  if (listingQuery.isError || !listing) {
    return <AppShell><ErrorState onRetry={() => listingQuery.refetch()} message={t('listingUnavailable')} /></AppShell>;
  }

  const isRental = listing.attributes?.saleType === 'rent';
  const isLand = listing.categorySlug === LAND_CATEGORY_SLUG;
  const isSold = isRental ? listing.rentalStatus === 'leased' : listing.saleStatus === 'sold';
  const whatsappPhone = listing.whatsappPhone
    ? normalizeMauritaniaPhone(listing.whatsappPhone)
    : null;
  const listingUrl = new URL(window.location.pathname, window.location.origin).toString();
  const whatsappMessage = t('whatsappListingMessage', { title: listing.title, url: listingUrl });
  const openLightbox = (index: number) => {
    setActiveImage(index);
    setLightboxOpen(true);
  };
  const handleMainImagePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' || (event.pointerType === 'pen' && event.button !== 0)) return;
    setGalleryPaused(true);
    mainImageSwipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleMainImagePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setGalleryPaused(false);
    const start = mainImageSwipeStartRef.current;
    mainImageSwipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return;

    suppressSwipeClickRef.current = true;
    if (suppressSwipeClickTimerRef.current !== null) window.clearTimeout(suppressSwipeClickTimerRef.current);
    suppressSwipeClickTimerRef.current = window.setTimeout(() => {
      suppressSwipeClickRef.current = false;
      suppressSwipeClickTimerRef.current = null;
    }, 0);
    if (gallery.length > 1) {
      const movesToNext = language === 'ar' ? deltaX > 0 : deltaX < 0;
      setActiveImage((current) => movesToNext
        ? Math.min(gallery.length - 1, current + 1)
        : Math.max(0, current - 1));
    }
  };
  const handleMainImageClick = () => {
    if (suppressSwipeClickRef.current) {
      suppressSwipeClickRef.current = false;
      if (suppressSwipeClickTimerRef.current !== null) window.clearTimeout(suppressSwipeClickTimerRef.current);
      suppressSwipeClickTimerRef.current = null;
      return;
    }
    openLightbox(activeImage);
  };

  const submitReport = async () => {
    if (reportDetails.trim().length < 10 || reportPending) return;
    setReportPending(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, reason: reportReason, details: reportDetails.trim() }),
      });
      if (!response.ok) throw new Error(t('dataLoadError'));
      setReportDetails('');
      setReportOpen(false);
    } finally {
      setReportPending(false);
    }
  };

  return (
    <AppShell>
      <div className={detailBreadcrumbClass}>
        <Link href="/listings" className="hover:text-[hsl(var(--primary))]" data-testid="link-back-listings">{t('allListings')}</Link>
        <ChevronDown size={13} className="rotate-90" />
        <span>{categoryName(listing.categorySlug, listing.category)}</span>
      </div>
      <div className={detailGridClass} data-testid="listing-detail-grid">
        <div className="min-w-0 max-w-full" data-testid="listing-detail-content">
          <div className="min-w-0 max-w-full overflow-hidden" data-testid="listing-image-gallery">
            <div
              className={`${detailGalleryClass} group max-w-full`}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setGalleryPaused(true); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse') setGalleryPaused(false); }}
            >
              {gallery[activeImage] && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  <ListingImage
                    images={[gallery[activeImage]]}
                    category={listing}
                    alt=""
                    imageClassName="scale-110 object-cover opacity-60 blur-2xl"
                    draggable={false}
                  />
                </div>
              )}
              {gallery[activeImage] ? (
                <button
                  type="button"
                  disabled={toggleFavorite.isPending}
                  aria-busy={toggleFavorite.isPending}
                  onClick={handleMainImageClick}
                  onPointerDown={handleMainImagePointerDown}
                  onPointerUp={handleMainImagePointerUp}
                  onPointerCancel={() => { mainImageSwipeStartRef.current = null; setGalleryPaused(false); }}
                  className="group relative z-10 block h-full w-full cursor-zoom-in listing-main-image-swipe-target select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-inset"
                  aria-label={`${t('viewImage')} ${activeImage + 1} / ${gallery.length}`}
                  data-testid="button-open-main-image"
                >
                  <ListingImage
                    key={`${activeImage}:${gallery[activeImage]}`}
                    images={[gallery[activeImage], ...gallery.filter((_, index) => index !== activeImage)]}
                    category={listing}
                    alt={listing.title}
                    imageClassName="listing-gallery-image-enter max-h-full max-w-full select-none object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    draggable={false}
                    testId="img-detail-main"
                  />
                </button>
              ) : (
                <ListingImage category={listing} alt={listing.title} testId="img-detail-main" />
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute start-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-white/65 text-[hsl(var(--primary))] shadow-sm backdrop-blur-md hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] md:grid"
                    aria-label={t('homepageBannerPrevious')}
                    onClick={() => setActiveImage((current) => (current - 1 + gallery.length) % gallery.length)}
                    data-testid="listing-gallery-previous"
                  >
                    <ChevronLeft size={20} className={language === 'ar' ? 'rotate-180' : ''} />
                  </button>
                  <button
                    type="button"
                    className="absolute end-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-white/65 text-[hsl(var(--primary))] shadow-sm backdrop-blur-md hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] md:grid"
                    aria-label={t('homepageBannerNext')}
                    onClick={() => setActiveImage((current) => (current + 1) % gallery.length)}
                    data-testid="listing-gallery-next"
                  >
                    <ChevronRight size={20} className={language === 'ar' ? 'rotate-180' : ''} />
                  </button>
                  <div className="absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5" role="group" aria-label={t('homepageBannerSlides')} data-testid="listing-gallery-dots">
                    {gallery.map((image, index) => (
                      <button
                        type="button"
                        key={`${image}-${index}`}
                        className={`h-1.5 rounded-full transition-[width,background-color] ${activeImage === index ? 'w-6 bg-[hsl(var(--primary))]' : 'w-1.5 bg-white/70'}`}
                        aria-label={`${t('homepageBannerSlide')} ${index + 1} / ${gallery.length}`}
                        aria-current={activeImage === index ? 'true' : undefined}
                        onClick={() => setActiveImage(index)}
                        data-testid={`listing-gallery-dot-${index}`}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="pointer-events-none absolute start-4 top-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
                {isLand ? (
                  <span
                    dir="auto"
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold leading-5 shadow-sm ${
                      isSold ? 'bg-[hsl(var(--destructive))] text-white'
                        : isRental ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--primary))] text-white'
                    }`}
                    data-testid={`badge-listing-offer-${listing.id}`}
                  >{isSold ? (isRental ? t('leased') : t('sold')) : (isRental ? t('forRent') : t('forSale'))}</span>
                ) : <>
                  <span className="whitespace-nowrap rounded-lg bg-[hsl(var(--accent))] px-3 py-1.5 text-[11px] font-bold leading-5 text-[hsl(var(--primary))] shadow-sm">{listing.condition === 'new' ? t('new') : t('used')}</span>
                  {isSold && <span className="whitespace-nowrap rounded-lg bg-[hsl(var(--destructive))] px-3 py-1.5 text-[11px] font-bold leading-5 text-white shadow-sm">{isRental ? t('leased') : t('sold')}</span>}
                </>}
              </div>
            </div>
            {gallery.length > 1 && (
              <div className="flex max-w-full gap-2 overflow-x-auto p-3" data-testid="listing-thumbnail-strip">
                {gallery.map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    ref={activeImage === index ? activeThumbnailRef : undefined}
                    onClick={() => openLightbox(index)}
                    className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${activeImage === index ? 'border-[hsl(var(--accent))]' : 'border-white/10'}`}
                    aria-label={`${t('viewImage')} ${index + 1} / ${gallery.length}`}
                    aria-pressed={activeImage === index}
                    data-testid={`button-gallery-${index}`}
                  >
                    <ListingImage
                      images={[image, ...gallery.filter((_, sourceIndex) => sourceIndex !== index)]}
                      category={listing}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="mb-2 block text-xs text-[hsl(var(--muted-foreground))]">{categoryName(listing.categorySlug, listing.category)} · {relativeDate(listing.createdAt, language)}</span>
                <h1 className="min-h-9 text-2xl font-bold leading-9 text-[hsl(var(--primary))] sm:text-3xl">{listing.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setReportOpen(true)} className="rounded-xl border border-[hsl(var(--border))] p-3 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" aria-label={t('reportDetailsTitle')} data-testid="button-report-listing">
                  <Flag size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite.mutate({ id: listing.id, data: { saved: !listing.isSaved } }, {
                    onSuccess: (result) => queryClient.setQueryData(
                      getGetListingQueryKey(id),
                      (old: Listing | undefined) => old ? { ...old, isSaved: result.saved } : old,
                    ),
                  })}
                  className={`rounded-xl border border-[hsl(var(--border))] p-3 transition-colors ${listing.isSaved ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]'}`}
                  aria-label={listing.isSaved ? t('removeSaved') : t('saveListing')}
                  aria-pressed={Boolean(listing.isSaved)}
                  data-testid="button-detail-save"
                >
                  <Bookmark size={20} fill={listing.isSaved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
            <ListingDescription description={listing.description} />
          </div>
          <ListingDetailFields listing={listing} />
          {listing.seller?.id ? <SellerReviews sellerId={listing.seller.id} /> : null}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('requestedPrice')}</span>
            <strong className="mt-1 block min-h-8 font-numeric text-2xl font-extrabold text-[hsl(var(--primary))]" dir="ltr">{formatPrice(listing.price, listing.currency, language)}</strong>
            {isSold && (
              <div className="mt-3 rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-3 text-xs leading-6 text-[hsl(var(--destructive))]">{t('soldListingNotice')}</div>
            )}
            <ListingSellerCard listing={listing}>
              {!isSold && listing.contactPhone && (
                <a
                  href={`tel:${listing.contactPhone}`}
                  className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-3 text-xs font-bold text-[hsl(var(--primary-foreground))]"
                  data-testid="link-call-seller"
                >
                  <Phone size={16} />
                  {t('callSeller')}
                </a>
              )}
              {!isSold && whatsappPhone && (
                <a
                  href={`https://wa.me/${whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex min-h-[41px] items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-xs font-bold text-white hover:bg-[#1fb85a]"
                  data-testid="link-whatsapp-seller"
                >
                  <WhatsAppIcon size={17} />
                  {t('messageOnWhatsApp')}
                </a>
              )}
            </ListingSellerCard>
          </div>
        </aside>
      </div>
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="motion-dialog w-full max-w-md rounded-2xl bg-[hsl(var(--card))] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[hsl(var(--primary))]">{t('reportDetailsTitle')}</h2>
              <button type="button" onClick={() => setReportOpen(false)} className="rounded-lg p-2 hover:bg-[hsl(var(--secondary))]" aria-label={t('close')}><X size={18} /></button>
            </div>
            <p className="mt-2 text-xs leading-6 text-[hsl(var(--muted-foreground))]">{listing.title}</p>
            <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-4 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent p-3 text-sm">
              <option value="fraud">{t('reportReasonFraud')}</option>
              <option value="spam">{t('reportReasonSpam')}</option>
              <option value="inappropriate">{t('reportReasonInappropriate')}</option>
              <option value="misleading">{t('reportReasonMisleading')}</option>
              <option value="other">{t('reportReasonOther')}</option>
            </select>
            <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} minLength={10} maxLength={5000} rows={5} className="mt-3 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent p-3 text-sm leading-6" placeholder={t('reportDetailsDescription')} />
            <button type="button" onClick={submitReport} disabled={reportPending || reportDetails.trim().length < 10} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">
              {reportPending ? <LoaderCircle size={15} className="animate-spin" /> : <Flag size={15} />}
              {t('reportDetailsTitle')}
            </button>
          </div>
        </div>
      )}
      {lightboxOpen && gallery.length > 0 && (
        <ListingImageLightbox gallery={gallery} activeImage={activeImage} title={listing.title} category={listing} onChange={setActiveImage} onClose={closeLightbox} />
      )}
    </AppShell>
  );
}