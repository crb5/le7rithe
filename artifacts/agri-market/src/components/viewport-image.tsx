import { useLayoutEffect, type ImgHTMLAttributes } from 'react';

/** Keep the existing image slot and styling; select loading hints from its actual viewport position. */
type ViewportImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  'data-testid'?: string;
  'data-placeholder-icon'?: string;
};

export function ViewportImage({ style, loading: _loading, ...props }: ViewportImageProps) {
  // The existing document-level observer handles viewport hints for all images.
  // Avoid a duplicate layout read and React state update on every image.
  return <img {...props} style={{ aspectRatio: 'auto 1 / 1', ...style }}
    loading="lazy" decoding="async" />;
}

export function listingThumbnailUrl(source: string) {
  const [path, query = ''] = source.split('?');
  if (!/^\/api\/listing-images\/[0-9a-f-]{36}$/i.test(path)) return source;
  const params = new URLSearchParams(query);
  params.set('variant', 'thumbnail');
  return `${path}?${params}`;
}

/** Also cover existing inline image tags and modal previews without rewriting their layouts. */
export function useImageLoadingHints() {
  useLayoutEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new WeakSet<Element>();
    const queue: [Element, string][] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const drain = () => {
      if (reduced.matches) { queue.length = 0; timer = undefined; return; }
      // Two slots maximum; leave room for header/drawer and interaction states.
      const batch = queue.splice(0, Math.max(0, Math.min(2, 4 - document.getAnimations().length)));
      batch.forEach(([element, name]) => element.classList.add(name));
      timer = setTimeout(() => {
        batch.forEach(([element, name]) => element.classList.remove(name));
        timer = undefined;
        if (queue.length) drain();
      }, batch.length ? 275 : 100);
    };
    const animate = (element: Element | null, name: string) => {
      if (!element || reduced.matches) return;
      queue.push([element, name]);
      if (!timer) drain();
    };
    let intersection: IntersectionObserver | undefined;
    const observeCards = () => {
      if (!scrollY) return;
      document.querySelectorAll('.listing-card').forEach(card => {
        if (seen.has(card)) return;
        seen.add(card);
        // First-screen content and the existing draggable marquee never enter.
        if (!card.closest('.featured-marquee') && card.getBoundingClientRect().top + scrollY >= innerHeight && typeof IntersectionObserver !== 'undefined') {
          intersection ??= new IntersectionObserver(entries => {
            for (const entry of entries) if (entry.isIntersecting) {
              intersection?.unobserve(entry.target);
              animate(entry.target, 'motion-enter');
            }
          });
          intersection.observe(card);
        }
      });
    };
    const applyHints = () => {
      observeCards();
      for (const image of document.images) {
        if (getComputedStyle(image).aspectRatio === 'auto') image.style.aspectRatio = 'auto 1 / 1';
        const rect = image.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight
          && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
        image.loading = visible ? 'eager' : 'lazy';
        image.decoding = 'async';
      }
    };
    const onLoad = (event: Event) => {
      const image = event.target as HTMLImageElement;
      if (scrollY && image.loading === 'lazy') animate(image, 'motion-photo');
    };
    document.addEventListener('load', onLoad, true);
    window.addEventListener('scroll', observeCards, { once: true });
    applyHints();
    const observer = new MutationObserver(records => {
      applyHints();
      for (const record of records) if (record.attributeName === 'aria-pressed' && record.oldValue === 'false'
        && (record.target as Element).getAttribute('aria-pressed') === 'true') {
        animate((record.target as Element).querySelector('svg'), 'motion-save');
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['src', 'aria-pressed'], attributeOldValue: true });
    return () => {
      observer.disconnect(); intersection?.disconnect(); clearTimeout(timer);
      document.removeEventListener('load', onLoad, true);
      window.removeEventListener('scroll', observeCards);
    };
  }, []);
}
