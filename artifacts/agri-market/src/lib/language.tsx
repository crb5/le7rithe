import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import ar from '@/locales/ar';
import fr from '@/locales/fr';
import en from '@/locales/en';
import { SITE_NAME } from '@/lib/brand';

export type MarketplaceLanguage = 'ar' | 'fr' | 'en';
export type LocalizedPageMetadata = Record<MarketplaceLanguage, { title: string; description: string }>;

const languageMeta: Record<MarketplaceLanguage, { label: string; dir: 'rtl' | 'ltr' }> = {
  ar: { label: 'العربية', dir: 'rtl' },
  fr: { label: 'Français', dir: 'ltr' },
  en: { label: 'English', dir: 'ltr' },
};
const dictionaries = { ar, fr, en } as const;
type TranslationKey = keyof typeof en;
type InterpolationValues = Record<string, string | number>;

const siteMetadata = {
  ar: {
    title: `${SITE_NAME} | السوق الزراعي الموريتاني`,
    description: `${SITE_NAME} لبيع وشراء وتأجير الأراضي والآليات والبذور والأسمدة والمنتجات الزراعية في موريتانيا، مع تواصل مباشر بين البائعين والمشترين في مختلف الولايات.`,
  },
  fr: {
    title: `${SITE_NAME} | Marché agricole mauritanien`,
    description: `${SITE_NAME} facilite l’achat, la vente et la location de terres, de machines, de semences, d’engrais et de produits agricoles en Mauritanie, avec un contact direct entre vendeurs et acheteurs.`,
  },
  en: {
    title: `${SITE_NAME} | Mauritanian agricultural marketplace`,
    description: `${SITE_NAME} helps people buy, sell, and rent land, machinery, seeds, fertilizer, and farm products in Mauritania, with direct contact between local buyers and sellers.`,
  },
} satisfies Record<MarketplaceLanguage, { title: string; description: string }>;

const localeByLanguage: Record<MarketplaceLanguage, string> = {
  // ar-MR spells September as "شتمبر" in the runtime's ICU data.
  // Use the standard Arabic locale to keep the correct "سبتمبر" spelling
  // while retaining Western digits through the numbering-system extension.
  ar: 'ar-u-nu-latn',
  fr: 'fr-MR-u-nu-latn',
  en: 'en-MR-u-nu-latn',
};
const numberLocale = 'fr-MR-u-nu-latn';

export function formatMoneyValue(
  value: number,
  currency = 'MRU',
  language: MarketplaceLanguage = 'ar',
  options: Intl.NumberFormatOptions = {},
) {
  const formattedValue = new Intl.NumberFormat(numberLocale, {
    ...options,
    style: 'decimal',
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(value);
  return `${formattedValue} ${currency}`;
}

function interpolate(template: string, values?: InterpolationValues) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values?.[key];
    return typeof value === 'number'
      ? new Intl.NumberFormat(numberLocale).format(value)
      : String(value ?? `{${key}}`);
  });
}

const LanguageContext = createContext<{
  language: MarketplaceLanguage;
  setLanguage: (language: MarketplaceLanguage) => void;
  setPageMetadata: (metadata: LocalizedPageMetadata | null) => void;
  meta: typeof languageMeta;
  t: (key: TranslationKey, values?: InterpolationValues) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatMoney: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
}>({
  language: 'ar',
  setLanguage: () => undefined,
  setPageMetadata: () => undefined,
  meta: languageMeta,
  t: (key) => en[key],
  formatNumber: (value) => String(value),
  formatMoney: (value, currency = 'MRU') => `${value} ${currency}`,
  formatDate: (value) => String(value),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<MarketplaceLanguage>(() => {
    const saved = window.localStorage.getItem('marketplace-language');
    return saved === 'fr' || saved === 'en' ? saved : 'ar';
  });
  const [pageMetadata, setPageMetadata] = useState<LocalizedPageMetadata | null>(null);

  const setLanguage = (next: MarketplaceLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem('marketplace-language', next);
  };

  useEffect(() => {
    const { title, description } = pageMetadata?.[language] ?? siteMetadata[language];
    document.documentElement.lang = language;
    document.documentElement.dir = languageMeta[language].dir;
    document.title = title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute('content', description);
  }, [language, pageMetadata]);

  const value = useMemo(() => {
    const locale = localeByLanguage[language];
    return {
      language,
      setLanguage,
      setPageMetadata,
      meta: languageMeta,
      t: (key: TranslationKey, values?: InterpolationValues) => interpolate(dictionaries[language][key], values),
      formatNumber: (number: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(numberLocale, options).format(number),
      formatMoney: (number: number, currency = 'MRU', options?: Intl.NumberFormatOptions) => formatMoneyValue(number, currency, language, options),
      formatDate: (date: string | number | Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(new Date(date)),
    };
  }, [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function usePageMetadata(metadata: LocalizedPageMetadata) {
  const { setPageMetadata } = useLanguage();

  useEffect(() => {
    setPageMetadata(metadata);
    return () => setPageMetadata(null);
  }, [metadata, setPageMetadata]);
}

export function translatedName(item: { name: string; nameFr?: string | null; nameEn?: string | null }, language: MarketplaceLanguage) {
  return (language === 'fr' ? item.nameFr : language === 'en' ? item.nameEn : item.name) || item.name;
}
