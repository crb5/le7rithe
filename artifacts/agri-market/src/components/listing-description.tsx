import { useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/language';

const COLLAPSED_LINE_COUNT = 5;

type DescriptionMeasurement = {
  fullHeight: number;
  expandable: boolean;
};

export function ListingDescription({ description }: { description: string | null | undefined }) {
  const { language, t } = useLanguage();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [measurement, setMeasurement] = useState<DescriptionMeasurement>({
    fullHeight: 0,
    expandable: false,
  });

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || !description?.trim()) return;

    setExpanded(false);

    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(text).lineHeight);
      if (!Number.isFinite(lineHeight)) return;

      const fullHeight = text.scrollHeight;
      const expandable = fullHeight > lineHeight * COLLAPSED_LINE_COUNT + 1;
      setMeasurement((current) => (
        current.fullHeight === fullHeight && current.expandable === expandable
          ? current
          : { fullHeight, expandable }
      ));
      if (!expandable) setExpanded((current) => current ? false : current);
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(text);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [description]);

  if (!description?.trim()) return null;

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <section className="mt-5 min-w-0" dir={direction} data-testid="listing-description-section">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[hsl(var(--primary))]">
        <span aria-hidden="true" className="h-5 w-[3px] shrink-0 rounded-full bg-[hsl(var(--accent))]" />
        {t('description')}
      </h2>
      <div className="min-w-0 rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_2px_8px_hsl(var(--primary)/.06)] sm:p-6">
        <div
          id="listing-description-text"
          className="relative min-h-[1.8em] min-w-0 overflow-hidden transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none"
          style={{
            maxHeight: expanded
              ? `${measurement.fullHeight}px`
              : measurement.expandable
                ? '9em'
                : '9em',
          }}
        >
          <p
            ref={textRef}
            className="m-0 w-full min-w-0 max-w-full whitespace-pre-line text-start text-base leading-[1.8] text-[hsl(var(--muted-foreground))]"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            data-testid="listing-description-text"
          >
            {description}
          </p>
          {measurement.expandable && !expanded && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[hsl(var(--card))] to-transparent"
              data-testid="listing-description-fade"
            />
          )}
        </div>
        {measurement.expandable && (
          <button
            type="button"
            aria-controls="listing-description-text"
            aria-expanded={expanded}
            className="mt-3 inline-flex min-h-11 items-center text-start text-sm font-bold text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            onClick={() => setExpanded((current) => !current)}
            data-testid="button-toggle-listing-description"
          >
            {expanded ? t('listingDescriptionShowLess') : t('listingDescriptionShowMore')}
          </button>
        )}
      </div>
    </section>
  );
}
