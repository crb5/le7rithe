import { useLayoutEffect, useRef, useState } from 'react';
import './_group.css';

type Language = 'ar' | 'fr' | 'en';

const descriptions: Record<Language, string> = {
  ar: `هذا إعلان لجرار زراعي بحالة ممتازة، خضع للصيانة الدورية ويعمل بكفاءة في مختلف الأعمال الزراعية. تم استخدامه في حراثة الأرض وتجهيزها للموسم، وهو جاهز للعمل مباشرة بعد المعاينة.

يتضمن السعر الجرار فقط، ويمكن للمشتري معاينته في نواكشوط والتواصل مع البائع لمزيد من المعلومات. المحرك بحالة جيدة، والإطارات مناسبة للعمل في الحقول، وجميع الوثائق متوفرة.

يرجى التواصل لتحديد موعد مناسب للمعاينة ومناقشة التفاصيل.`,
  fr: `Tracteur agricole en excellent état, entretenu régulièrement et prêt à travailler. Il a servi au labour et à la préparation des champs avant la saison.

Le prix comprend le tracteur uniquement. Vous pouvez le voir à Nouakchott et contacter le vendeur pour obtenir davantage d’informations. Le moteur fonctionne bien, les pneus sont adaptés aux travaux agricoles et les documents sont disponibles.

Contactez le vendeur pour convenir d’une visite et discuter des détails.`,
  en: `Agricultural tractor in excellent condition, serviced regularly and ready to work. It has been used for ploughing and preparing fields for the growing season.

The price is for the tractor only. It can be viewed in Nouakchott, and you can contact the seller for more information. The engine runs well, the tires are suitable for farm work, and all paperwork is available.

Contact the seller to arrange a viewing and discuss the details.`,
};

const moreLabels: Record<Language, string> = {
  ar: 'عرض المزيد',
  fr: 'Voir plus',
  en: 'Show more',
};

const lessLabels: Record<Language, string> = {
  ar: 'عرض أقل',
  fr: 'Voir moins',
  en: 'Show less',
};

function DescriptionCard({ language, description }: { language: Language; description: string }) {
  const [expanded, setExpanded] = useState(false);
  const [measurement, setMeasurement] = useState({ fullHeight: 0, expandable: false });
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    setExpanded(false);

    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(text).lineHeight);
      if (!Number.isFinite(lineHeight)) return;
      const fullHeight = text.scrollHeight;
      const expandable = fullHeight > lineHeight * 5 + 1;
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

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <section className="mt-5 min-w-0" dir={direction}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[hsl(var(--primary))]">
        <span aria-hidden="true" className="h-5 w-[3px] shrink-0 rounded-full bg-[hsl(var(--accent))]" />
        {language === 'ar' ? 'الوصف' : 'Description'}
      </h2>
      <div className="min-w-0 rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_2px_8px_hsl(var(--primary)/.06)] sm:p-6">
        <div
          className="relative min-w-0 overflow-hidden transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none"
          style={{
            maxHeight: expanded
              ? `${measurement.fullHeight}px`
              : measurement.expandable
                ? '9em'
                : undefined,
          }}
        >
          <p
            ref={textRef}
            className="m-0 w-full min-w-0 max-w-full whitespace-pre-line text-start text-base leading-[1.8] text-[hsl(var(--muted-foreground))]"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {description}
          </p>
          {measurement.expandable && !expanded && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[hsl(var(--card))] to-transparent"
            />
          )}
        </div>
        {measurement.expandable && (
          <button
            type="button"
            aria-expanded={expanded}
            className="mt-3 inline-flex min-h-11 items-center text-start text-sm font-bold text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? lessLabels[language] : moreLabels[language]}
          </button>
        )}
      </div>
    </section>
  );
}

export function Improved() {
  const [language, setLanguage] = useState<Language>('ar');

  return (
    <main className="listing-description-showcase p-5 sm:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex justify-end gap-2" dir="ltr" aria-label="Preview language">
          {(['ar', 'fr', 'en'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLanguage(item)}
              aria-pressed={language === item}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                language === item
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'
              }`}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
        <DescriptionCard language={language} description={descriptions[language]} />
      </div>
    </main>
  );
}
