import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, ChevronRight, LandPlot, LoaderCircle, MapPin, Plus, Tractor } from 'lucide-react';
import { getListCategoriesQueryKey, getListListingsQueryKey, getListLocationsQueryKey, useListCategories, useListBanners, useListListings, useListLocations } from '@workspace/api-client-react';
import { useToggleFavorite } from '@/lib/use-favorites';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { HomeLoadDebugPanel } from '@/components/home-load-debug-panel';
import { AppShell, EmptyState, ErrorState, ListingCard, ListingSkeleton, SearchBar, SectionLink, iconForCategory } from '@/components/marketplace-ui';
import { translatedName, useLanguage } from '@/lib/language';
import { translateLocationName } from '@/lib/listing-localization';
import { categoriesFallback } from './marketplace-shared';
import type { Listing } from './marketplace-shared';


export function FeaturedListingsMarquee({ listings, onSave, label }: { listings: Listing[]; onSave: (listing: Listing) => Promise<unknown>; label: string }) {
  const visibleListings = listings.slice(0, 6);
  const listKey = visibleListings.map((listing) => listing.id).join(',');
  const marqueeRef = useRef<HTMLDivElement>(null);
  const firstGroupRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const cycleWidthRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const didDragRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    const firstGroup = firstGroupRef.current;
    if (!track || !firstGroup) return;

    const applyOffset = (nextOffset: number) => {
      const cycleWidth = cycleWidthRef.current;
      if (!cycleWidth) return;

      let normalizedOffset = nextOffset;
      while (normalizedOffset > 0) normalizedOffset -= cycleWidth;
      while (normalizedOffset <= -cycleWidth) normalizedOffset += cycleWidth;
      offsetRef.current = normalizedOffset;
      track.style.transform = `translate3d(${normalizedOffset}px, 0, 0)`;
    };

    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      cycleWidthRef.current = firstGroup.getBoundingClientRect().width + gap;
      applyOffset(offsetRef.current);
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    motionQuery.addEventListener('change', onMotionPreferenceChange);

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(firstGroup);

    let previousTime = performance.now();
    const tick = (time: number) => {
      const elapsed = Math.min(time - previousTime, 50);
      previousTime = time;
      if (!isDraggingRef.current && !reducedMotionRef.current) {
        applyOffset(offsetRef.current - elapsed * 0.028);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      motionQuery.removeEventListener('change', onMotionPreferenceChange);
    };
  }, [listKey]);

  const beginDrag = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;

    isDraggingRef.current = true;
    dragStartXRef.current = clientX;
    dragStartOffsetRef.current = offsetRef.current;
    didDragRef.current = false;
    setIsDragging(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button > 0) return;
    trackRef.current?.setPointerCapture(event.pointerId);
    beginDrag(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    moveDrag(event.clientX, event);
  };

  const moveDrag = (clientX: number, event?: { preventDefault: () => void }) => {
    if (!isDraggingRef.current) return;
    const distance = clientX - dragStartXRef.current;
    if (Math.abs(distance) > 6) {
      didDragRef.current = true;
      event?.preventDefault();
    }

    const track = trackRef.current;
    const cycleWidth = cycleWidthRef.current;
    if (!track || !cycleWidth || !didDragRef.current) return;

    let nextOffset = dragStartOffsetRef.current + distance;
    while (nextOffset > 0) nextOffset -= cycleWidth;
    while (nextOffset <= -cycleWidth) nextOffset += cycleWidth;
    offsetRef.current = nextOffset;
    track.style.transform = `translate3d(${nextOffset}px, 0, 0)`;
  };

  const finishDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const finishPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    finishDrag();
  };

  useEffect(() => {
    const marquee = marqueeRef.current;
    if (!marquee) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (!event.isPrimary || (event.button !== 0 && event.pointerType === 'mouse')) return;
      beginDrag(event.clientX);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (!isDraggingRef.current) return;
      moveDrag(event.clientX, event);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      finishDrag();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      beginDrag(event.clientX);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      moveDrag(event.clientX, event);
    };
    const onMouseUp = () => finishDrag();
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) beginDrag(touch.clientX);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) moveDrag(touch.clientX, event);
    };
    const onTouchEnd = () => finishDrag();

    marquee.addEventListener('pointerdown', onPointerDown);
    marquee.addEventListener('pointermove', onPointerMove);
    marquee.addEventListener('pointerup', onPointerUp);
    marquee.addEventListener('pointercancel', onPointerUp);
    marquee.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    marquee.addEventListener('touchstart', onTouchStart, { passive: true });
    marquee.addEventListener('touchmove', onTouchMove, { passive: false });
    marquee.addEventListener('touchend', onTouchEnd, { passive: true });
    marquee.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      marquee.removeEventListener('pointerdown', onPointerDown);
      marquee.removeEventListener('pointermove', onPointerMove);
      marquee.removeEventListener('pointerup', onPointerUp);
      marquee.removeEventListener('pointercancel', onPointerUp);
      marquee.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      marquee.removeEventListener('touchstart', onTouchStart);
      marquee.removeEventListener('touchmove', onTouchMove);
      marquee.removeEventListener('touchend', onTouchEnd);
      marquee.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [listKey]);

  return (
    <div
      ref={marqueeRef}
      className={`featured-marquee${isDragging ? ' is-dragging' : ''}`}
      data-testid="featured-listings-marquee"
      aria-label={label}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (touch) beginDrag(touch.clientX);
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (touch) moveDrag(touch.clientX, event);
      }}
      onTouchEnd={finishDrag}
      onTouchCancel={finishDrag}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (!didDragRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        didDragRef.current = false;
      }}
    >
      <div ref={trackRef} className="featured-marquee__track">
        {[false, true].map((isDuplicate) => (
          <div key={isDuplicate ? 'duplicate' : 'primary'} ref={isDuplicate ? undefined : firstGroupRef} className="featured-marquee__group" aria-hidden={isDuplicate || undefined}>
            {visibleListings.map((listing) => (
              <div key={`${listing.id}-${isDuplicate ? 'duplicate' : 'primary'}`} className="featured-marquee__item" dir="rtl">
                <ListingCard listing={listing} featured isMarqueeDuplicate={isDuplicate} onSave={onSave} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


export function StorefrontsSection() {
  const { data: banners = [], isLoading } = useListBanners();
  const { t, language, formatNumber } = useLanguage();
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const [loadedImageIds, setLoadedImageIds] = useState<Set<number>>(() => new Set());
  const [firstImageStatus, setFirstImageStatus] = useState<{
    bannerId: number;
    status: 'ready' | 'error';
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; lastX: number; lastTime: number; baseX: number } | null>(null);
  const trackPositionRef = useRef(0);
  const trackOffsetRef = useRef(0);
  const slideWidthRef = useRef(0);
  const autoplayTimeoutRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const suppressClickRef = useRef(false);
  const loadedImageIdsRef = useRef(new Set<number>());
  const imagePreloadPromisesRef = useRef(new Map<number, Promise<boolean>>());
  const pendingSlideRef = useRef<{ index: number; position: number } | null>(null);
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const imageBanners = useMemo(
    () => banners.filter((banner) => Boolean(banner.imageUrl) && !failedImages.has(banner.id)),
    [banners, failedImages],
  );
  const firstBannerId = imageBanners[0]?.id ?? null;
  const firstImageIsReady = firstBannerId !== null &&
    firstImageStatus?.bannerId === firstBannerId &&
    firstImageStatus.status === 'ready';
  const firstImageHasError = firstBannerId !== null &&
    firstImageStatus?.bannerId === firstBannerId &&
    firstImageStatus.status === 'error';

  const handleBannerImageLoad = useCallback((
    bannerId: number,
    image: HTMLImageElement,
    isFirstImage: boolean,
  ) => {
    const markLoaded = () => {
      loadedImageIdsRef.current.add(bannerId);
      setLoadedImageIds(new Set(loadedImageIdsRef.current));
      if (isFirstImage) setFirstImageStatus({ bannerId, status: 'ready' });
    };

    if (isFirstImage && typeof image.decode === 'function') {
      void image.decode().then(markLoaded).catch(() => {
        if (image.complete && image.naturalWidth > 0) {
          markLoaded();
        } else {
          setFirstImageStatus({ bannerId, status: 'error' });
        }
      });
      return;
    }

    markLoaded();
  }, []);

  const handleBannerImageError = useCallback((bannerId: number, isFirstImage: boolean) => {
    if (isFirstImage) {
      setFirstImageStatus({ bannerId, status: 'error' });
      return;
    }
    setFailedImages((current) => new Set(current).add(bannerId));
  }, []);
  const trackSlides = useMemo(() => {
    if (imageBanners.length < 2) {
      return imageBanners.map((banner, logicalIndex) => ({ banner, logicalIndex, key: `slide-${banner.id}` }));
    }
    const first = imageBanners[0];
    const last = imageBanners[imageBanners.length - 1];
    return direction === 'rtl'
      ? [
          { banner: first, logicalIndex: 0, key: `clone-first-${first.id}` },
          ...imageBanners.slice().reverse().map((banner, index) => ({
            banner,
            logicalIndex: imageBanners.length - index - 1,
            key: `slide-${banner.id}`,
          })),
          { banner: last, logicalIndex: imageBanners.length - 1, key: `clone-last-${last.id}` },
        ]
      : [
          { banner: last, logicalIndex: imageBanners.length - 1, key: `clone-last-${last.id}` },
          ...imageBanners.map((banner, logicalIndex) => ({ banner, logicalIndex, key: `slide-${banner.id}` })),
          { banner: first, logicalIndex: 0, key: `clone-first-${first.id}` },
        ];
  }, [direction, imageBanners]);
  const bannerIdsKey = imageBanners.map((banner) => banner.id).join(',');

  const readTrackOffset = useCallback(() => {
    const track = trackRef.current;
    if (!track) return trackOffsetRef.current;
    const transform = getComputedStyle(track).transform;
    const offset = transform === 'none' ? trackOffsetRef.current : new DOMMatrixReadOnly(transform).m41;
    trackOffsetRef.current = offset;
    return offset;
  }, []);

  const writeTrackOffset = useCallback((offset: number, animate: boolean) => {
    trackOffsetRef.current = offset;
    const track = trackRef.current;
    if (!track) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reducedMotion) {
      track.style.removeProperty('transition');
    } else {
      track.style.setProperty('transition', 'none', 'important');
    }
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
  }, []);

  const commitSlideChange = useCallback((nextIndex: number, nextPosition: number) => {
    pendingSlideRef.current = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finalPosition = reducedMotion && nextPosition === 0
      ? imageBanners.length
      : reducedMotion && nextPosition === imageBanners.length + 1
        ? 1
        : nextPosition;
    trackPositionRef.current = finalPosition;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    const width = slideWidthRef.current || railRef.current?.getBoundingClientRect().width || 0;
    writeTrackOffset(-finalPosition * width, true);
  }, [imageBanners.length, writeTrackOffset]);

  const ensureBannerLoaded = useCallback((target: (typeof imageBanners)[number]) => {
    if (loadedImageIdsRef.current.has(target.id)) return Promise.resolve(true);
    const existing = imagePreloadPromisesRef.current.get(target.id);
    if (existing) return existing;

    const promise = new Promise<boolean>((resolve) => {
      const preload = new Image();
      preload.decoding = 'async';
      preload.fetchPriority = 'low';
      preload.onload = () => {
        imagePreloadPromisesRef.current.delete(target.id);
        loadedImageIdsRef.current.add(target.id);
        setLoadedImageIds(new Set(loadedImageIdsRef.current));
        resolve(true);
      };
      preload.onerror = () => {
        imagePreloadPromisesRef.current.delete(target.id);
        setFailedImages((current) => new Set(current).add(target.id));
        resolve(false);
      };
      preload.src = target.imageUrl!;
    });
    imagePreloadPromisesRef.current.set(target.id, promise);
    return promise;
  }, []);

  const clearAutoplayTimeout = useCallback(() => {
    if (autoplayTimeoutRef.current === null) return;
    window.clearTimeout(autoplayTimeoutRef.current);
    autoplayTimeoutRef.current = null;
  }, []);

  const requestSlideChange = useCallback((nextIndex: number, requestedPosition?: number) => {
    const target = imageBanners[nextIndex];
    if (!target?.imageUrl) return;
    const nextPosition = requestedPosition ?? (direction === 'rtl'
      ? imageBanners.length - nextIndex
      : nextIndex + 1);
    if (nextIndex === activeIndex && nextPosition === trackPositionRef.current) return;
    if (loadedImageIdsRef.current.has(target.id)) {
      commitSlideChange(nextIndex, nextPosition);
      return;
    }

    pendingSlideRef.current = { index: nextIndex, position: nextPosition };
    writeTrackOffset(readTrackOffset(), false);
    setPaused(true);
    void ensureBannerLoaded(target).then((loaded) => {
      const pending = pendingSlideRef.current;
      if (pending?.index !== nextIndex) return;
      pendingSlideRef.current = null;
      if (loaded) commitSlideChange(nextIndex, pending.position);
      setPaused(false);
    });
  }, [activeIndex, commitSlideChange, direction, ensureBannerLoaded, imageBanners, readTrackOffset, writeTrackOffset]);

  useEffect(() => {
    if (imageBanners.length < 2) return;
    const nextBanner = imageBanners[(activeIndex + 1) % imageBanners.length];
    if (nextBanner) void ensureBannerLoaded(nextBanner);
  }, [activeIndex, ensureBannerLoaded, imageBanners]);

  useLayoutEffect(() => {
    const safeIndex = Math.min(activeIndexRef.current, Math.max(0, imageBanners.length - 1));
    activeIndexRef.current = safeIndex;
    setActiveIndex(safeIndex);
    const centerPosition = imageBanners.length < 2
      ? 0
      : direction === 'rtl' ? imageBanners.length - safeIndex : safeIndex + 1;
    trackPositionRef.current = centerPosition;
    const width = railRef.current?.getBoundingClientRect().width ?? 0;
    slideWidthRef.current = width;
    writeTrackOffset(-centerPosition * width, false);
  }, [bannerIdsKey, direction, imageBanners.length, writeTrackOffset]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(() => {
      const nextWidth = rail.getBoundingClientRect().width;
      const previousWidth = slideWidthRef.current;
      if (nextWidth <= 0 || previousWidth <= 0 || Math.abs(nextWidth - previousWidth) < 0.01) return;
      const currentOffset = readTrackOffset();
      const resizedOffset = currentOffset * nextWidth / previousWidth;
      slideWidthRef.current = nextWidth;
      writeTrackOffset(resizedOffset, false);

      const touch = touchStartRef.current;
      if (touch) {
        touch.baseX = resizedOffset;
        touch.x = touch.lastX;
        touch.lastTime = performance.now();
        return;
      }

      const targetOffset = -trackPositionRef.current * nextWidth;
      if (Math.abs(targetOffset - resizedOffset) > 0.5) {
        requestAnimationFrame(() => {
          if (touchStartRef.current) return;
          writeTrackOffset(-trackPositionRef.current * slideWidthRef.current, true);
        });
      }
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, [readTrackOffset, writeTrackOffset, bannerIdsKey]);

  useEffect(() => {
    clearAutoplayTimeout();
    if (imageBanners.length < 2 || isLoading || paused || touchStartRef.current) return;
    autoplayTimeoutRef.current = window.setTimeout(() => {
      autoplayTimeoutRef.current = null;
      if (touchStartRef.current) return;
      const nextIndex = (activeIndex + 1) % imageBanners.length;
      const nextPosition = trackPositionRef.current + (direction === 'rtl' ? -1 : 1);
      requestSlideChange(nextIndex, nextPosition);
    }, 5000);
    return clearAutoplayTimeout;
  }, [activeIndex, clearAutoplayTimeout, direction, imageBanners.length, isLoading, paused, requestSlideChange]);

  if (isLoading) {
    return (
      <section className="mt-7 sm:mt-10" aria-busy="true" data-testid="storefronts-loading">
        <div className="mb-3 h-5 w-36 animate-pulse rounded bg-[hsl(var(--muted))]" />
        <div className="storefronts-bleed">
          <div className="storefronts-loading-frame w-full animate-pulse bg-[hsl(var(--muted))]" />
        </div>
        <div className="storefronts-dots mt-3 h-6" aria-hidden="true" />
      </section>
    );
  }
  if (imageBanners.length === 0) return null;

  return (
    <section className="mt-7 min-w-0 sm:mt-10" aria-labelledby="storefronts-title" data-testid="storefronts-section">
      <h2 id="storefronts-title" className="mb-3 text-sm font-semibold text-[hsl(var(--primary))]">
        {t('storefrontsTitle')}
      </h2>
      <div
        ref={railRef}
        dir={direction}
        className={`storefronts-bleed storefronts-rail${isDragging ? ' is-dragging' : ''}`}
        role="region"
        aria-roledescription={t('homepageBannerSlides')}
        aria-labelledby="storefronts-title"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setPaused(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setPaused(false);
        }}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.pointerType === 'mouse') return;
          clearAutoplayTimeout();
          const baseX = readTrackOffset();
          writeTrackOffset(baseX, false);
          pendingSlideRef.current = null;
          touchStartRef.current = {
            x: event.clientX,
            lastX: event.clientX,
            lastTime: event.timeStamp,
            baseX,
          };
          suppressClickRef.current = false;
          setPaused(true);
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = touchStartRef.current;
          const rail = railRef.current;
          const track = trackRef.current;
          if (!start || !rail || !track) return;
          const distance = event.clientX - start.x;
          start.lastX = event.clientX;
          start.lastTime = event.timeStamp;
          writeTrackOffset(start.baseX + distance, false);
        }}
        onPointerUp={(event) => {
          if (event.pointerType === 'mouse') return;
          const start = touchStartRef.current;
          touchStartRef.current = null;
          setIsDragging(false);
          setPaused(false);
          if (start === null || imageBanners.length < 2) return;
          const width = Math.max(1, slideWidthRef.current || railRef.current?.getBoundingClientRect().width || 0);
          const distance = event.clientX - start.x;
          const elapsed = Math.max(1, event.timeStamp - start.lastTime);
          const velocity = (event.clientX - start.lastX) / elapsed;
          const projectedDistance = distance + velocity * 180;
          const startPosition = -start.baseX / width;
          let targetPosition = Math.round(-(start.baseX + projectedDistance) / width);
          if (targetPosition === Math.round(startPosition) && Math.abs(velocity) > 0.45 && Math.abs(distance) > 6) {
            targetPosition += velocity < 0 ? 1 : -1;
          }
          targetPosition = Math.max(0, Math.min(imageBanners.length + 1, targetPosition));
          if (Math.abs(distance) > 6) {
            suppressClickRef.current = true;
            window.setTimeout(() => { suppressClickRef.current = false; }, 400);
          }
          const nextIndex = trackSlides[targetPosition]?.logicalIndex;
          if (nextIndex !== undefined) {
            if (nextIndex === activeIndex) commitSlideChange(nextIndex, targetPosition);
            else requestSlideChange(nextIndex, targetPosition);
          }
        }}
        onPointerCancel={() => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          setIsDragging(false);
          setPaused(false);
          if (!start || imageBanners.length < 2) return;
          const width = Math.max(1, slideWidthRef.current || railRef.current?.getBoundingClientRect().width || 0);
          const targetPosition = Math.max(0, Math.min(
            imageBanners.length + 1,
            Math.round(-readTrackOffset() / width),
          ));
          const nextIndex = trackSlides[targetPosition]?.logicalIndex;
          if (nextIndex !== undefined) {
            if (nextIndex === activeIndexRef.current) commitSlideChange(nextIndex, targetPosition);
            else requestSlideChange(nextIndex, targetPosition);
          }
        }}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }}
        data-testid="storefronts-rail"
        onTransitionEnd={(event) => {
          if (event.target !== trackRef.current || event.propertyName !== 'transform') return;
          const position = trackPositionRef.current;
          if (position !== 0 && position !== imageBanners.length + 1) return;
          const centeredPosition = position === 0 ? imageBanners.length : 1;
          trackPositionRef.current = centeredPosition;
          const width = slideWidthRef.current || railRef.current?.getBoundingClientRect().width || 0;
          writeTrackOffset(-centeredPosition * width, false);
        }}
      >
        <div ref={trackRef} className="storefronts-track">
        {trackSlides.map(({ banner, logicalIndex, key }, trackIndex) => {
          if (!banner.imageUrl) return null;
          const isClone = trackSlides.length > imageBanners.length &&
            (trackIndex === 0 || trackIndex === trackSlides.length - 1);
          const isExternal = Boolean(banner.targetUrl && /^https?:\/\//i.test(banner.targetUrl));
          const isInternal = Boolean(banner.targetUrl?.startsWith('/') && !banner.targetUrl.startsWith('//'));
          const shouldLoadImage = (logicalIndex === 0 && !isClone) || logicalIndex === activeIndex || loadedImageIds.has(banner.id);
          const image = (
            <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
              <img
                src={shouldLoadImage ? banner.imageUrl : undefined}
                alt={banner.imageAlt || ''}
                loading={logicalIndex === 0 && !isClone ? 'eager' : 'lazy'}
                fetchPriority={logicalIndex === 0 && !isClone ? 'high' : 'auto'}
                decoding="async"
                className="storefronts-image"
                onLoad={(event) => handleBannerImageLoad(
                  banner.id,
                  event.currentTarget,
                  logicalIndex === 0 && !isClone,
                )}
                onError={() => handleBannerImageError(banner.id, logicalIndex === 0)}
                data-testid={!isClone ? `storefront-image-${banner.id}` : undefined}
              />
            </div>
          );
          const accessibleLabel = banner.imageAlt || t('storefrontsTitle');

          return (
            <article
              key={key}
              className="storefronts-slide"
              role="group"
              aria-roledescription={t('homepageBannerSlide')}
              aria-label={`${t('homepageBannerSlide')} ${formatNumber(logicalIndex + 1)} / ${formatNumber(imageBanners.length)}`}
              aria-hidden={isClone || logicalIndex !== activeIndex}
              inert={isClone || logicalIndex !== activeIndex}
              data-testid={!isClone ? `storefront-card-${banner.id}` : undefined}
            >
              {banner.targetUrl && isExternal ? (
                  <a className="block h-full w-full" href={banner.targetUrl} target="_blank" rel="noreferrer" aria-label={accessibleLabel} data-testid={!isClone ? `storefront-link-${banner.id}` : undefined}>
                  {image}
                </a>
              ) : banner.targetUrl && isInternal ? (
                <Link className="block h-full w-full" href={banner.targetUrl} aria-label={accessibleLabel} data-testid={!isClone ? `storefront-link-${banner.id}` : undefined}>
                  {image}
                </Link>
              ) : (
                image
              )}
            </article>
          );
        })}
        </div>
        <div
          className={`storefronts-first-image-state${firstImageIsReady ? ' is-ready' : ''}${firstImageHasError ? ' has-error' : ''}`}
          aria-hidden={firstImageIsReady}
          aria-live={firstImageHasError ? 'polite' : undefined}
          data-testid="storefronts-first-image-state"
        >
          {firstImageHasError ? (
            <span className="rounded-full bg-[hsl(var(--background)/.88)] px-4 py-2 text-center text-sm text-[hsl(var(--foreground))] shadow-sm">
              {t('homepageBannerImageUnavailable')}
            </span>
          ) : (
            <span className="storefronts-skeleton-mark" aria-hidden="true">
              <span />
              <span />
            </span>
          )}
        </div>
        {imageBanners.length > 1 && (
          <>
            <button
              type="button"
              className="storefronts-arrow storefronts-arrow-start"
              aria-label={t('homepageBannerPrevious')}
              onClick={() => requestSlideChange(
                (activeIndex - 1 + imageBanners.length) % imageBanners.length,
                trackPositionRef.current + (direction === 'rtl' ? 1 : -1),
              )}
              data-testid="storefronts-previous"
            >
              <ChevronLeft size={20} className={direction === 'rtl' ? 'rotate-180' : ''} />
            </button>
            <button
              type="button"
              className="storefronts-arrow storefronts-arrow-end"
              aria-label={t('homepageBannerNext')}
              onClick={() => requestSlideChange(
                (activeIndex + 1) % imageBanners.length,
                trackPositionRef.current + (direction === 'rtl' ? -1 : 1),
              )}
              data-testid="storefronts-next"
            >
              <ChevronRight size={20} className={direction === 'rtl' ? 'rotate-180' : ''} />
            </button>
          </>
        )}
      </div>
      {imageBanners.length > 0 && (
        <div className="storefronts-pagination mt-3" dir={direction} data-testid="storefronts-pagination">
          {imageBanners.length > 1 && (
            <div className="storefronts-dots" role="group" aria-label={t('homepageBannerSlides')} data-testid="storefronts-dots">
              {imageBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => {
                    let position = direction === 'rtl' ? imageBanners.length - index : index + 1;
                    if (activeIndex === imageBanners.length - 1 && index === 0) position = direction === 'rtl' ? 0 : imageBanners.length + 1;
                    if (activeIndex === 0 && index === imageBanners.length - 1) position = direction === 'rtl' ? imageBanners.length + 1 : 0;
                    requestSlideChange(index, position);
                  }}
                  className="storefronts-dot"
                  aria-label={`${t('homepageBannerSlide')} ${formatNumber(index + 1)}`}
                  aria-current={activeIndex === index ? 'true' : undefined}
                  data-testid={`storefront-dot-${banner.id}`}
                >
                  <span className="storefronts-dot-mark" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          <span className="storefronts-count" dir="ltr" aria-label={`${formatNumber(activeIndex + 1)} / ${formatNumber(imageBanners.length)}`} data-testid="storefronts-count">
            {formatNumber(activeIndex + 1)} / {formatNumber(imageBanners.length)}
          </span>
        </div>
      )}
    </section>
  );
}


export function Home() {
  const debugLoad = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const [, setLocation] = useLocation();
  const { language, t, formatNumber } = useLanguage();
  const [search, setSearch] = useState('');
  const [latestPage, setLatestPage] = useState(1);
  const [latestOffers, setLatestOffers] = useState<Listing[]>([]);
  const [latestOffersTotal, setLatestOffersTotal] = useState(0);
  const [latestOffersLimit, setLatestOffersLimit] = useState(30);
  const [latestLoadedPage, setLatestLoadedPage] = useState(0);
  const [isLoadingMoreLatestOffers, setIsLoadingMoreLatestOffers] = useState(false);
  const latestAppliedPageRef = useRef(0);
  const latestLoadMoreRef = useRef(false);
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const locationsQuery = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const listingsQuery = useListListings({ featured: true, sort: 'newest', limit: 8 });
  const latestOffersParams = useMemo(() => ({ page: latestPage, limit: 30, sort: 'newest' as const }), [latestPage]);
  const latestOffersQuery = useListListings(latestOffersParams, { query: { queryKey: getListListingsQueryKey(latestOffersParams) } });
  const toggleFavorite = useToggleFavorite();
  const categories = categoriesQuery.data?.length ? categoriesQuery.data : categoriesFallback;
  const featured = listingsQuery.data?.items ?? [];
  const hasMoreLatestOffers = latestLoadedPage * latestOffersLimit < latestOffersTotal;
  const latestPageReady = latestOffersQuery.data?.page === latestPage;
  const latestPageItems = latestPageReady ? latestOffersQuery.data?.items ?? [] : [];
  const latestOffersForDisplay = [
    ...latestOffers,
    ...latestPageItems.filter((listing) => !latestOffers.some((current) => current.id === listing.id)),
  ];
  const visibleLatestOffers = latestOffersForDisplay.filter((listing) => listing.featured !== true);
  const latestOffersLoading = visibleLatestOffers.length === 0 && (
    latestOffersQuery.isFetching ||
    (latestPageReady && !latestOffersQuery.isError && hasMoreLatestOffers)
  );
  const submitSearch = () => setLocation(`/listings${search ? `?q=${encodeURIComponent(search)}` : ''}`);
  const openFilters = () => {
    const params = new URLSearchParams();
    const query = search.trim();
    if (query) params.set('q', query);
    params.set('filters', 'open');
    setLocation(`/listings?${params.toString()}`);
  };
  const loadMoreLatestOffers = () => {
    if (latestLoadMoreRef.current || latestOffersQuery.isFetching || !hasMoreLatestOffers) return;
    latestLoadMoreRef.current = true;
    setIsLoadingMoreLatestOffers(true);
    setLatestPage((current) => current + 1);
  };

  useEffect(() => {
    const data = latestOffersQuery.data;
    if (!data || data.page !== latestPage) return;
    setLatestOffersTotal(data.total);
    setLatestOffersLimit(data.limit);
    setLatestLoadedPage(data.page);
    if (latestAppliedPageRef.current === latestPage) return;
    latestAppliedPageRef.current = latestPage;
    setLatestOffers((current) => {
      if (latestPage === 1) return data.items;
      const existingIds = new Set(current.map((listing) => listing.id));
      return [...current, ...data.items.filter((listing) => !existingIds.has(listing.id))];
    });
  }, [latestOffersQuery.data, latestPage]);

  useEffect(() => {
    if (!latestOffersQuery.isError && (!latestPageReady || latestOffersQuery.isFetching)) return;
    latestLoadMoreRef.current = false;
    setIsLoadingMoreLatestOffers(false);
  }, [latestOffersQuery.isError, latestOffersQuery.isFetching, latestPageReady]);

  useEffect(() => {
    if (
      !latestPageReady ||
      latestOffersQuery.isFetching ||
      latestOffersQuery.isError ||
      visibleLatestOffers.length > 0 ||
      !hasMoreLatestOffers
    ) return;
    setLatestPage((current) => current + 1);
  }, [hasMoreLatestOffers, latestOffersQuery.isError, latestOffersQuery.isFetching, latestPageReady, visibleLatestOffers.length]);

  return <AppShell>
    {debugLoad ? <HomeLoadDebugPanel /> : null}
    <FadeIn enabled={false}><section className="relative isolate overflow-hidden rounded-[2rem] bg-[hsl(var(--primary))] px-6 py-8 text-[hsl(var(--primary-foreground))] sm:px-10 sm:py-11 lg:px-14 lg:py-14" data-testid="section-home-hero">
      <div className="relative z-10 max-w-2xl lg:max-w-[62%]">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[11px] font-semibold text-white/75">{t('seasonalMarket')}</div>
        <h1 className="max-w-xl text-[clamp(2rem,5vw,4.2rem)] font-bold leading-[1.13] tracking-tight">{t('everythingForYourLand')}</h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-white/60 sm:text-base">{t('homeIntro')}</p>
        <div className="mt-8 max-w-xl"><SearchBar value={search} onChange={setSearch} onSubmit={submitSearch} onFilterClick={openFilters} /></div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/45"><span>{t('mostSearched')}</span><button type="button" onClick={() => { setSearch('جرار'); setLocation('/listings?q=جرار'); }} className="text-white/75 hover:text-[hsl(var(--accent))]" data-testid="button-trend-tractor">{t('tractors')}</button><button type="button" onClick={() => { setSearch('أرض'); setLocation('/listings?q=أرض'); }} className="text-white/75 hover:text-[hsl(var(--accent))]" data-testid="button-trend-land">{t('agriculturalLand')}</button><button type="button" onClick={() => setLocation('/listings?category=spare-parts')} className="text-white/75 hover:text-[hsl(var(--accent))]" data-testid="button-trend-parts">{t('spareParts')}</button></div>
      </div>
      <div className="pointer-events-none absolute -left-8 -top-20 h-[420px] w-[420px] rounded-full border-[46px] border-[hsl(var(--accent)/.1)] sm:left-[45%] sm:top-[-150px]" /><div className="pointer-events-none absolute -bottom-36 left-[43%] h-[360px] w-[360px] rounded-full border-[1px] border-[hsl(var(--accent)/.2)]" />
      <div className="pointer-events-none absolute bottom-0 left-10 hidden opacity-40 lg:block"><LandPlot size={160} strokeWidth={.5} /></div>
      <div className="pointer-events-none absolute bottom-[-70px] left-[58%] hidden h-[300px] w-[300px] rounded-full border border-[hsl(var(--accent)/.25)] lg:block" />
      <div className="pointer-events-none absolute left-[62%] top-1/2 hidden -translate-y-1/2 text-[hsl(var(--accent)/.18)] lg:block"><Tractor size={190} strokeWidth={.55} /></div>
    </section></FadeIn>

      <FadeIn enabled={false}><StorefrontsSection /></FadeIn>

      {listingsQuery.isError ? (
        <FadeIn enabled={false}><section className="mt-8 sm:mt-12" data-testid="section-featured-listings">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <span className="mb-2 block text-[10px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{t('handpicked')}</span>
              <h2 className="text-xl font-bold text-[hsl(var(--primary))] sm:text-2xl">{t('featuredListings')}</h2>
            </div>
            <SectionLink href="/listings?featured=true">{t('viewMore')}</SectionLink>
          </div>
          <ErrorState onRetry={() => listingsQuery.refetch()} />
        </section></FadeIn>
      ) : featured.length > 0 ? (
        <FadeIn enabled={false}><section className="mt-8 sm:mt-12" data-testid="section-featured-listings">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <span className="mb-2 block text-[10px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{t('handpicked')}</span>
              <h2 className="text-xl font-bold text-[hsl(var(--primary))] sm:text-2xl">{t('featuredListings')}</h2>
            </div>
            <SectionLink href="/listings?featured=true">{t('viewMore')}</SectionLink>
          </div>
          <FeaturedListingsMarquee listings={featured} label={t('featuredListings')} onSave={(item) => toggleFavorite.mutateAsync({ id: item.id, data: { saved: !item.isSaved } })} />
        </section></FadeIn>
      ) : null}

      <FadeIn enabled={false}><section className="mt-8 sm:mt-12" data-testid="section-categories">
      <div className="mb-5 flex items-end justify-between gap-4"><div><span className="mb-2 block text-[10px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{t('browseByNeed')}</span><h2 className="text-xl font-bold text-[hsl(var(--primary))] sm:text-2xl">{t('whereToStart')}</h2></div><SectionLink href="/listings">{t('viewAllCategories')}</SectionLink></div>
      <Stagger enabled={false} className="category-card-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
         {categories.map((category) => { const Icon = iconForCategory(category); return <StaggerItem key={category.slug} interactive><Link href={`/listings?category=${category.slug}`} className="category-card" data-testid={`link-category-${category.slug}`}><span className="category-card-icon"><Icon size={19} /></span><strong className="category-card-title">{translatedName(category, language)}</strong><span className="category-card-count">{t('listingCount', { count: category.count })}</span></Link></StaggerItem>; })}
      </Stagger>
    </section>
    </FadeIn>

      <FadeIn enabled={false}><section className="mt-10 border-t border-[hsl(var(--border))] pt-8 sm:mt-14 sm:pt-10" data-testid="section-latest-offers">
        <div className="mb-5 flex items-end justify-between">
          <div><span className="mb-2 block text-[10px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{t('newlyArrived')}</span><h2 className="text-xl font-bold text-[hsl(var(--primary))]">{t('latestOffers')}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('latestOffersDescription')}</p></div>
          <SectionLink href="/listings">{t('viewMore')}</SectionLink>
        </div>
        {latestOffersLoading ? <ListingSkeleton count={4} variant="listing-card" /> : latestOffersQuery.isError ? <ErrorState onRetry={() => latestOffersQuery.refetch()} /> : visibleLatestOffers.length ? <>
          <Stagger enabled={false} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{visibleLatestOffers.map((listing) => <StaggerItem key={listing.id}><ListingCard listing={listing} iconSize={24} onSave={(item) => toggleFavorite.mutateAsync({ id: item.id, data: { saved: !item.isSaved } })} /></StaggerItem>)}</Stagger>
          {hasMoreLatestOffers ? <div className="mt-8 flex justify-center"><button type="button" onClick={loadMoreLatestOffers} disabled={isLoadingMoreLatestOffers || latestOffersQuery.isFetching} aria-busy={isLoadingMoreLatestOffers || latestOffersQuery.isFetching} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-sm transition-shadow hover:shadow-md disabled:cursor-wait disabled:opacity-60" data-testid="button-latest-offers-show-more">{isLoadingMoreLatestOffers || latestOffersQuery.isFetching ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" data-testid="spinner-latest-offers" /> : null}{isLoadingMoreLatestOffers || latestOffersQuery.isFetching ? t('loading') : t('loadMoreListings')}</button></div> : null}
        </> : <EmptyState title={t('noLatestOffers')} description={t('noResultsDescription')} />}
      </section></FadeIn>

      <FadeIn enabled={false}><section className="mt-10 border-t border-[hsl(var(--border))] pt-8 sm:mt-14 sm:pt-10" data-testid="section-market-distribution">
      <aside className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-5"><div className="mb-6 flex items-center justify-between"><div><span className="mb-1 block text-[10px] font-bold tracking-[.14em] text-[hsl(var(--muted-foreground))]">{t('marketDistribution')}</span><h3 className="font-bold text-[hsl(var(--primary))]">{t('byRegion')}</h3></div><MapPin size={18} className="text-[hsl(var(--primary))]" /></div>{locationsQuery.isLoading ? <div className="space-y-4" aria-hidden="true">{[1,2,3,4,5].map((i) => <div key={i} className={`h-4 rounded bg-[hsl(var(--muted))] ${i > 2 ? 'hidden sm:block' : ''}`} />)}</div> : <div className="space-y-4">{(locationsQuery.data ?? []).slice(0, 5).map((location) => <Link key={location.id} href={`/listings?location=${encodeURIComponent(location.name)}`} className="group flex items-center justify-between text-xs" data-testid={`link-location-${location.id}`}><span className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-foreground))] transition-transform group-hover:scale-150" />{translateLocationName(location.name, language)}</span><span className="font-numeric text-[10px] text-[hsl(var(--muted-foreground))]" dir="ltr">{formatNumber(location.listingCount)}</span></Link>)}</div>}</aside>
    </section></FadeIn>
      <FadeIn enabled={false}><section className="mt-10 flex flex-col items-start justify-between gap-5 overflow-hidden rounded-2xl bg-[hsl(var(--secondary)/.65)] p-6 sm:mt-14 sm:flex-row sm:items-center sm:p-8" data-testid="section-home-cta">
        <div className="min-w-0">
          <span className="mb-2 block text-[10px] font-bold tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('startSelling')}</span>
          <h2 className="text-xl font-bold text-[hsl(var(--primary))]">{t('addNewListing')}</h2>
          <p className="mt-2 max-w-xl text-xs leading-6 text-[hsl(var(--muted-foreground))]">{t('addListingDescription')}</p>
        </div>
        <Link href="/add-listing" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-glow-primary transition hover:-translate-y-0.5" data-testid="link-home-cta-add"><Plus size={16} />{t('addListing')}</Link>
      </section></FadeIn>
  </AppShell>;
}
