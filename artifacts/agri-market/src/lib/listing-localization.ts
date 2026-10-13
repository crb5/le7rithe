import ar from '../locales/ar';
import en from '../locales/en';
import fr from '../locales/fr';
import type { MarketplaceLanguage } from './language';

type TranslationKey = keyof typeof en;
type LocaleDictionary = Record<TranslationKey, string>;

const dictionaries: Record<MarketplaceLanguage, LocaleDictionary> = { ar, fr, en };

const locationTranslationKeys: Record<string, TranslationKey> = {
  روصو: 'regionRosso',
  كرمسين: 'regionKermassene',
  اركيز: 'regionRkiz',
  انتيكان: 'regionAntekane',
  بوگي: 'regionBoghé',
  بوكي: 'regionBoghé',
  بوغي: 'regionBoghé',
  لكصيب: 'regionLexeiba',
  نواكشوط: 'regionNouakchott',
  نواذيبو: 'regionNouadhibou',
  موريتانيا: 'countryMauritania',
  آخر: 'other',
};

const canonicalLocationNames: Partial<Record<TranslationKey, string>> = {
  regionRosso: 'روصو',
  regionKermassene: 'كرمسين',
  regionRkiz: 'اركيز',
  regionAntekane: 'انتيكان',
  regionBoghé: 'بوگي',
  regionLexeiba: 'لكصيب',
  regionNouakchott: 'نواكشوط',
  regionNouadhibou: 'نواذيبو',
  countryMauritania: 'موريتانيا',
  other: 'آخر',
};

const optionTranslationKeys: Record<string, TranslationKey> = {
  sale: 'forSale',
  للبيع: 'forSale',
  rent: 'forRent',
  للإيجار: 'forRent',
  new: 'new',
  جديد: 'new',
  used: 'used',
  مستعمل: 'used',
  reclaimed: 'reclaimed',
  مستصلحة: 'reclaimed',
  unreclaimed: 'unreclaimed',
  غيرمستصلحة: 'unreclaimed',
  yes: 'available',
  متوفر: 'available',
  no: 'unavailable',
  غيرمتوفر: 'unavailable',
  kg: 'unitKilogram',
  ton: 'unitTon',
  other: 'other',
  أخرى: 'other',
};

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function keyForLocationPart(value: string): TranslationKey | undefined {
  const normalized = normalize(value);
  return Object.entries(locationTranslationKeys).find(([name]) => normalize(name) === normalized)?.[1];
}

function preserveWhitespace(value: string, transform: (trimmed: string) => string) {
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const trimmed = value.trim();
  return trimmed ? `${leading}${transform(trimmed)}${trailing}` : value;
}

export function translateLocationName(value: string, language: MarketplaceLanguage) {
  return value.split(/([،,])/).map((part) => {
    if (part === '،' || part === ',') return part;
    return preserveWhitespace(part, (name) => {
      const key = keyForLocationPart(name);
      return key ? dictionaries[language][key] || name : name;
    });
  }).join('');
}

export function canonicalizeLocationName(value: string, language: MarketplaceLanguage) {
  return value.split(/([،,])/).map((part) => {
    if (part === '،' || part === ',') return part;
    return preserveWhitespace(part, (name) => {
      const directKey = keyForLocationPart(name);
      if (directKey && canonicalLocationNames[directKey]) return canonicalLocationNames[directKey]!;

      const normalized = normalize(name);
      const localizedKey = (Object.keys(canonicalLocationNames) as TranslationKey[]).find(
        (key) => normalize(dictionaries[language][key]) === normalized,
      );
      return localizedKey ? canonicalLocationNames[localizedKey]! : name;
    });
  }).join('');
}

export function translateMarketplaceOption(value: string, language: MarketplaceLanguage) {
  const normalized = normalize(value).replace(/\s/g, '');
  const key = Object.entries(optionTranslationKeys).find(([option]) => normalize(option).replace(/\s/g, '') === normalized)?.[1];
  if (key) return dictionaries[language][key] || value;
  return translateLocationName(value, language);
}
