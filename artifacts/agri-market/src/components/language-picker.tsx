import { Check, ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MarketplaceLanguage } from '@/lib/language';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const languageOptions = [
  { value: 'ar', country: 'Mauritania' },
  { value: 'fr', country: 'France' },
  { value: 'en', country: 'United States' },
] as const satisfies ReadonlyArray<{ value: MarketplaceLanguage; country: string }>;

const languageFlags: Record<MarketplaceLanguage, string> = {
  ar: '🇲🇷',
  fr: '🇫🇷',
  en: '🇺🇸',
};

function LanguageFlag({ language }: { language: MarketplaceLanguage }) {
  return (
    <span
      data-language-flag={language}
      data-testid={`language-flag-${language}`}
      aria-hidden="true"
      className="inline-flex h-4 min-w-5 shrink-0 items-center justify-center text-[14px] leading-none"
    >
      {languageFlags[language]}
    </span>
  );
}

export function LanguagePicker({
  language,
  label,
  setLanguage,
}: {
  language: MarketplaceLanguage;
  label: string;
  setLanguage: (language: MarketplaceLanguage) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${language.toUpperCase()}`}
          data-testid="select-language"
          data-language={language}
          className="flex h-8 w-[4.75rem] shrink-0 items-center justify-between gap-0.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 text-[10px] font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
        >
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap" dir="ltr">
            <LanguageFlag language={language} />
            <span>{language.toUpperCase()}</span>
          </span>
          <ChevronDown size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-[6.75rem] rounded-lg border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 text-[hsl(var(--foreground))] shadow-lg"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
        >
          {languageOptions.map((option) => {
            const active = option.value === language;
            return (
              <DropdownMenuItem
                key={option.value}
                role="menuitemradio"
                aria-checked={active}
                aria-label={`${option.value.toUpperCase()} ${option.country}`}
                dir="ltr"
                onSelect={() => setLanguage(option.value)}
                data-testid={`language-option-${option.value}`}
                className={`flex min-h-8 w-full items-center justify-between rounded-md px-1.5 py-1 text-[10px] transition-colors focus:bg-[hsl(var(--secondary))] focus:text-[hsl(var(--primary))] ${active ? 'bg-[hsl(var(--accent))] font-bold text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]'}`}
              >
                <span className="flex items-center gap-1" dir="ltr">
                  <LanguageFlag language={option.value} />
                  <span>{option.value.toUpperCase()}</span>
                </span>
                {active && <Check size={12} className="shrink-0 text-[hsl(var(--primary))]" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}