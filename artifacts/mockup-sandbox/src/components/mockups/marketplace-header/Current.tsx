import { useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Leaf,
  LogIn,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import './_group.css';

type Language = 'ar' | 'fr' | 'en';

const labels: Record<Language, Record<string, string>> = {
  ar: {
    brand: 'لحريثه',
    tagline: 'السوق الزراعي الموريتاني',
    discover: 'اكتشف',
    allListings: 'كل الإعلانات',
    categories: 'التصنيفات',
    saved: 'المحفوظات',
    support: 'الدعم',
    notifications: 'الإشعارات',
    myPayments: 'مدفوعاتي',
    sellerDashboard: 'لوحة البائع',
    language: 'اللغة',
    signIn: 'تسجيل الدخول',
    addListing: 'أضف إعلانك',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    goodMorning: 'مرحبًا بك في لحريثه',
    whatLookingFor: 'ما الذي تبحث عنه اليوم؟',
  },
  fr: {
    brand: 'لحريثه',
    tagline: 'Le marché agricole mauritanien',
    discover: 'Découvrir',
    allListings: 'Annonces',
    categories: 'Catégories',
    saved: 'Favoris',
    support: 'Assistance',
    notifications: 'Notifications',
    myPayments: 'Mes paiements',
    sellerDashboard: 'Espace vendeur',
    language: 'Langue',
    signIn: 'Connexion',
    addListing: 'Déposer une annonce',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    goodMorning: 'Bienvenue sur لحريثه',
    whatLookingFor: 'Que recherchez-vous aujourd’hui ?',
  },
  en: {
    brand: 'لحريثه',
    tagline: 'Mauritanian agricultural marketplace',
    discover: 'Discover',
    allListings: 'All listings',
    categories: 'Categories',
    saved: 'Saved',
    support: 'Support',
    notifications: 'Notifications',
    myPayments: 'My payments',
    sellerDashboard: 'Seller dashboard',
    language: 'Language',
    signIn: 'Sign in',
    addListing: 'Add listing',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    goodMorning: 'Welcome to لحريثه',
    whatLookingFor: 'What are you looking for today?',
  },
};

const navItems = [
  { href: '/', label: 'discover', icon: LayoutDashboard },
  { href: '/listings', label: 'allListings', icon: Search },
  { href: '/categories', label: 'categories', icon: Package },
  { href: '/saved', label: 'saved', icon: Bookmark },
  { href: '/support', label: 'support', icon: MessageCircle },
  { href: '/payments', label: 'myPayments', icon: CreditCard },
  { href: '/dashboard', label: 'sellerDashboard', icon: Gauge },
] as const;

function LanguageFlag({ language }: { language: Language }) {
  const flags: Record<Language, string> = { ar: '🇲🇷', fr: '🇫🇷', en: '🇺🇸' };
  return (
    <span
      data-language-flag={language}
      aria-hidden="true"
      className="inline-flex h-4 min-w-5 shrink-0 items-center justify-center text-[14px] leading-none"
    >
      {flags[language]}
    </span>
  );
}

function LanguagePicker({
  language,
  setLanguage,
  t,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${t('language')}: ${language.toUpperCase()}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
        className="flex h-8 w-[4.75rem] shrink-0 items-center justify-between gap-0.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 text-[10px] font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))]"
      >
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap" dir="ltr">
          <LanguageFlag language={language} />
          <span>{language.toUpperCase()}</span>
        </span>
        <ChevronDown size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      </button>
      {menuOpen && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-1.5 min-w-[6.75rem] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-lg">
          {(['ar', 'fr', 'en'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === language}
              onClick={() => {
                setLanguage(option);
                setMenuOpen(false);
              }}
              className="flex min-h-8 w-full items-center justify-between rounded-md px-1.5 py-1 text-[10px]"
              dir="ltr"
            >
              <span className="flex items-center gap-1">
                <LanguageFlag language={option} />
                <span>{option.toUpperCase()}</span>
              </span>
              {option === language && <Check size={12} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Logo({ compact = false, testId, small = false }: { compact?: boolean; testId?: string; small?: boolean }) {
  return (
    <a href="#" className={`group flex items-center ${small ? 'min-w-0 gap-1.5' : 'gap-3'}`} data-testid={testId}>
      <span className={`flex shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[0_7px_0_hsl(155_33%_16%/.12)] ${small ? 'h-8 w-8 rounded-xl' : 'h-11 w-11'}`}>
        <Leaf size={small ? 18 : 23} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="min-w-0 leading-none">
          <strong className={`block whitespace-nowrap font-bold tracking-tight text-[hsl(var(--primary))] ${small ? 'text-[14px]' : 'text-[18px]'}`}>{labels.ar.brand}</strong>
          {!small && <small className="mt-1 block text-[10px] font-medium tracking-[.08em] text-[hsl(var(--muted-foreground))]">{labels.ar.tagline}</small>}
        </span>
      )}
    </a>
  );
}

export function Current() {
  const [language, setLanguage] = useState<Language>('ar');
  const [menuOpen, setMenuOpen] = useState(false);
  const [path, setPath] = useState('/');
  const t = (key: string) => labels[language][key] ?? key;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen w-full overflow-x-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {menuOpen && (
        <>
          <button type="button" aria-label={t('closeMenu')} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-[hsl(var(--primary)/.42)] backdrop-blur-sm xl:hidden" />
          <aside className={`fixed inset-y-0 ${language === 'ar' ? 'right-0' : 'left-0'} z-40 flex w-[min(88vw,340px)] flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] shadow-2xl xl:hidden`}>
            <div className="mb-10 flex items-center justify-between">
              <Logo testId="link-logo-drawer" />
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10" aria-label={t('closeMenu')}><X size={19} /></button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a key={item.href} href="#" onClick={() => { setPath(item.href); setMenuOpen(false); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/70 hover:bg-white/[.07] hover:text-white">
                    <Icon size={18} /><span>{t(item.label)}</span>
                  </a>
                );
              })}
              <a href="#" className="mt-3 flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold text-white"><LogIn size={15} />{t('signIn')}</a>
            </nav>
          </aside>
        </>
      )}
      <div className="w-full min-w-0">
        <header className="sticky top-0 z-20 border-b border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.96)] px-3 shadow-[0_3px_14px_hsl(155_20%_18%/.05)] backdrop-blur-md sm:px-4 lg:px-8">
          <div className="mx-auto flex h-14 max-w-[1420px] items-center gap-1 sm:h-16 sm:gap-3">
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <button type="button" onClick={() => setMenuOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--secondary))] xl:hidden" aria-label={t('openMenu')} aria-expanded={menuOpen}><Menu size={20} /></button>
              <div className="min-w-0 xl:hidden"><Logo compact={false} small testId="link-logo-mobile" /></div>
              <div className="hidden xl:flex"><Logo compact={false} testId="link-logo" /></div>
            </div>
            <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 xl:flex" aria-label="Main navigation">
              {navItems.map((item) => {
                const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <a key={item.href} href="#" onClick={() => setPath(item.href)} aria-current={active ? 'page' : undefined} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-colors ${active ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]'}`}>
                    <Icon size={15} /><span>{t(item.label)}</span>
                  </a>
                );
              })}
            </nav>
            <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              <LanguagePicker language={language} setLanguage={setLanguage} t={t} />
              <a href="#" className="hidden rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))] xl:inline-flex">{t('signIn')}</a>
              <a href="#" className="hidden items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(155_33%_16%/.15)] xl:flex"><Plus size={16} />{t('addListing')}</a>
            </div>
          </div>
          <div className="mx-auto mt-2 hidden max-w-[1420px] xl:block"><p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{t('goodMorning')}</p><p className="text-sm font-bold">{t('whatLookingFor')}</p></div>
        </header>
        <main className="mx-auto min-h-[1300px] max-w-[1420px] px-4 pt-6 sm:px-7 sm:pt-8 lg:px-8 lg:pt-10">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
            Preview the header at different viewport widths. Current route: {path}
          </div>
        </main>
      </div>
    </div>
  );
}