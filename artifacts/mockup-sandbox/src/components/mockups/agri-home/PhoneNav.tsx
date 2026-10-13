import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleUserRound,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Leaf,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Tractor,
  X,
} from 'lucide-react';
import './PhoneNav.css';

type Language = 'ar' | 'fr' | 'en';
type PhoneNavProps = {
  language?: Language;
  onLanguageChange?: (language: Language) => void;
  isSignedIn?: boolean;
  userName?: string;
  unreadCount?: number;
  activePath?: string;
  onSignOut?: () => void | Promise<void>;
};

const copy: Record<Language, {
  dir: 'rtl' | 'ltr';
  brand: string;
  tagline: string;
  discover: string;
  listings: string;
  saved: string;
  more: string;
  add: string;
  categories: string;
  messages: string;
  support: string;
  notifications: string;
  payments: string;
  dashboard: string;
  account: string;
  signIn: string;
  signOut: string;
  language: string;
  close: string;
  menuTitle: string;
  mainArea: string;
  registered: string;
  confirmSignOut: string;
  cancel: string;
  search: string;
  searchPlaceholder: string;
  searchButton: string;
  searchHint: string;
  marketNote: string;
  marketTitle: string;
  marketDescription: string;
  categoriesEyebrow: string;
  popular: string;
  featured: string;
  viewAll: string;
  listingsLabel: string;
  locationOne: string;
  locationTwo: string;
  priceOne: string;
  priceTwo: string;
  secure: string;
  secureDescription: string;
  greeting: string;
}> = {
  ar: {
    dir: 'rtl', brand: 'لحريثه', tagline: 'السوق الزراعي الموريتاني',
    discover: 'اكتشاف', listings: 'الإعلانات', saved: 'المحفوظات', more: 'المزيد',
    add: 'أضف إعلانًا', categories: 'التصنيفات', messages: 'الرسائل', support: 'الدعم',
    notifications: 'الإشعارات', payments: 'مدفوعاتي', dashboard: 'لوحة البائع',
    account: 'الحساب', signIn: 'تسجيل الدخول', signOut: 'تسجيل الخروج', language: 'لغة الموقع',
    close: 'إغلاق القائمة', menuTitle: 'تنقّل في السوق', mainArea: 'السوق',
    registered: 'حساب مسجّل', confirmSignOut: 'هل تريد تسجيل الخروج من حسابك؟',
    cancel: 'إلغاء', search: 'ابحث في السوق', searchPlaceholder: 'جرار، أرض، بذور...',
    searchButton: 'بحث', searchHint: 'أكثر بحثًا: جرارات · أراضٍ · بذور',
    marketNote: 'سوق موريتانيا · موسم 2025', marketTitle: 'أرضك تبدأ من هنا.',
    marketDescription: 'معدات وأراضٍ ومنتجات من بائعين قريبين منك.',
    categoriesEyebrow: 'اختصر الطريق', popular: 'تصفّح حسب حاجتك',
    featured: 'من السوق اليوم', viewAll: 'عرض الكل', listingsLabel: 'إعلانات موثوقة',
    locationOne: 'روصو', locationTwo: 'ألاك', priceOne: '850,000 MRU',
    priceTwo: '1,250,000 MRU', secure: 'تجارة مطمئنة', secureDescription: 'تواصل مباشرةً مع البائعين وتحقّق من التفاصيل قبل الشراء.',
    greeting: 'ماذا تحتاج لأرضك اليوم؟',
  },
  fr: {
    dir: 'ltr', brand: 'لحريثه', tagline: 'Marché agricole mauritanien',
    discover: 'Découvrir', listings: 'Annonces', saved: 'Favoris', more: 'Plus',
    add: 'Déposer une annonce', categories: 'Catégories', messages: 'Messages', support: 'Assistance',
    notifications: 'Notifications', payments: 'Mes paiements', dashboard: 'Espace vendeur',
    account: 'Compte', signIn: 'Connexion', signOut: 'Déconnexion', language: 'Langue du site',
    close: 'Fermer le menu', menuTitle: 'Navigation', mainArea: 'Marché',
    registered: 'Compte inscrit', confirmSignOut: 'Voulez-vous vous déconnecter ?',
    cancel: 'Annuler', search: 'Chercher au marché', searchPlaceholder: 'Tracteur, terrain, semences…',
    searchButton: 'Chercher', searchHint: 'Recherches fréquentes : tracteurs · terrains · semences',
    marketNote: 'Marché mauritanien · Saison 2025', marketTitle: 'Votre terre commence ici.',
    marketDescription: 'Matériel, terrains et récoltes proposés près de chez vous.',
    categoriesEyebrow: 'Aller à l’essentiel', popular: 'Parcourir par besoin',
    featured: 'Au marché aujourd’hui', viewAll: 'Tout voir', listingsLabel: 'Annonces vérifiées',
    locationOne: 'Rosso', locationTwo: 'Aleg', priceOne: '850 000 MRU',
    priceTwo: '1 250 000 MRU', secure: 'Acheter en confiance', secureDescription: 'Échangez directement avec les vendeurs et vérifiez chaque détail.',
    greeting: 'De quoi votre terre a-t-elle besoin ?',
  },
  en: {
    dir: 'ltr', brand: 'لحريثه', tagline: 'Mauritanian agricultural marketplace',
    discover: 'Discover', listings: 'Listings', saved: 'Saved', more: 'More',
    add: 'Post a listing', categories: 'Categories', messages: 'Messages', support: 'Support',
    notifications: 'Notifications', payments: 'My payments', dashboard: 'Seller dashboard',
    account: 'Account', signIn: 'Sign in', signOut: 'Sign out', language: 'Site language',
    close: 'Close menu', menuTitle: 'Market navigation', mainArea: 'Market',
    registered: 'Registered account', confirmSignOut: 'Sign out of your account?',
    cancel: 'Cancel', search: 'Search the market', searchPlaceholder: 'Tractors, land, seed…',
    searchButton: 'Search', searchHint: 'Popular: tractors · farmland · seed',
    marketNote: 'Mauritania marketplace · 2025 season', marketTitle: 'Start with your land.',
    marketDescription: 'Tools, land and harvests from sellers close to home.',
    categoriesEyebrow: 'Get to the good stuff', popular: 'Browse by need',
    featured: 'From the market today', viewAll: 'View all', listingsLabel: 'Trusted listings',
    locationOne: 'Rosso', locationTwo: 'Aleg', priceOne: '850,000 MRU',
    priceTwo: '1,250,000 MRU', secure: 'Trade with confidence', secureDescription: 'Talk directly with sellers and check every detail before you buy.',
    greeting: 'What does your land need today?',
  },
};

const extraLinks = [
  { href: '/categories', key: 'categories' as const, Icon: Package },
  { href: '/messages', key: 'messages' as const, Icon: MessageCircle },
  { href: '/support', key: 'support' as const, Icon: CircleUserRound },
  { href: '/payments', key: 'payments' as const, Icon: CreditCard },
  { href: '/dashboard', key: 'dashboard' as const, Icon: Gauge },
];

const languageFromStorage = (): Language => {
  if (typeof window === 'undefined') return 'ar';
  const saved = window.localStorage.getItem('marketplace-language');
  return saved === 'fr' || saved === 'en' ? saved : 'ar';
};

export function PhoneNav({
  language: controlledLanguage,
  onLanguageChange,
  isSignedIn: controlledSignedIn,
  userName = 'Fatima Mint Ahmed',
  activePath = '/',
  onSignOut,
}: PhoneNavProps) {
  const [storedLanguage, setStoredLanguage] = useState<Language>(languageFromStorage);
  const [previewSignedIn, setPreviewSignedIn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const language = controlledLanguage ?? storedLanguage;
  const t = copy[language];
  const signedIn = controlledSignedIn ?? previewSignedIn;
  const initial = userName.trim().charAt(0) || 'س';

  useEffect(() => {
    window.localStorage.setItem('marketplace-language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = t.dir;
  }, [language, t.dir]);

  const selectLanguage = (nextLanguage: Language) => {
    setStoredLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchTerm.trim();
    window.location.href = query ? `/listings?search=${encodeURIComponent(query)}` : '/listings';
  };

  const confirmSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      if (onSignOut) await onSignOut();
      else if (controlledSignedIn === undefined) setPreviewSignedIn(false);
      setSignOutOpen(false);
      setMenuOpen(false);
    } finally {
      setIsSigningOut(false);
    }
  };

  const active = (href: string) => href === '/' ? activePath === '/' : activePath.startsWith(href);

  return (
    <div dir={t.dir} className="phone-nav-shell relative mx-auto min-h-[100dvh] w-full max-w-[430px] overflow-hidden bg-[#f5f3e9] text-[#193e42] shadow-[0_18px_70px_rgba(24,50,50,.14)]">
      <header className="relative z-10 flex items-center justify-between border-b border-[#e6e4d8] bg-[#faf9f3]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.menuTitle}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[#e5e4d8] bg-[#f7f6ef] text-[#193e42] transition-colors hover:bg-[#ecefe5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b51]"
          >
            <Menu size={19} />
          </button>
          <a href="/" aria-label={t.brand} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#e6b75c] text-[#193e42] shadow-[inset_0_-3px_0_rgba(91,76,43,.12)]">
              <Leaf size={21} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-[14px] font-extrabold tracking-[-.03em]">{t.brand}</strong>
              <small className="mt-0.5 block truncate text-[9px] font-medium text-[#73827b]">{t.tagline}</small>
            </span>
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="relative">
            <span className="sr-only">{t.language}</span>
            <select
              value={language}
              onChange={(event) => selectLanguage(event.target.value as Language)}
              aria-label={t.language}
              data-testid="select-language"
              dir="ltr"
              className="h-8 w-[4.75rem] appearance-none rounded-lg border border-[#e1dfd3] bg-[#f7f6ef] ps-1.5 pe-5 text-[10px] font-extrabold tracking-wide text-[#47625c] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#c98b51]"
            >
              <option value="ar">🇲🇷 AR</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="en">🇺🇸 EN</option>
            </select>
            <ChevronDown size={12} aria-hidden="true" className="pointer-events-none absolute end-1 top-1/2 -translate-y-1/2 text-[#47625c]" />
          </label>
          {signedIn ? (
            <>
              <a href="/account" aria-label={t.account} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9e3d7] text-[11px] font-black text-[#193e42] ring-1 ring-[#ced9ce]">{initial}</a>
            </>
          ) : (
            <a href="/sign-in" className="inline-flex min-h-9 items-center rounded-xl bg-[#193e42] px-3 text-[10px] font-bold text-[#fffdf6] transition-colors hover:bg-[#28565a]">{t.signIn}</a>
          )}
        </div>
      </header>

      <main className="px-4 pb-[116px] pt-5">
        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold tracking-[.11em] text-[#75867d]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#bd7153]" />
          {t.marketNote}
        </p>
        <section className="relative overflow-hidden rounded-[25px] bg-[#193e42] px-5 pb-5 pt-5 text-[#fffdf6] shadow-[0_12px_32px_rgba(25,62,66,.15)]">
          <div className="pointer-events-none absolute -end-10 -top-16 h-52 w-52 rounded-full border-[24px] border-[#e6b75c]/[.14]" />
          <div className="pointer-events-none absolute -end-4 bottom-0 h-24 w-48 opacity-30" aria-hidden="true">
            <svg viewBox="0 0 190 95" fill="none" className="h-full w-full">
              <path d="M6 91c29-25 51-35 81-34 31 1 48-12 97-51" stroke="#E6B75C" strokeWidth="1.2" />
              <path d="M-4 91c33-34 61-45 91-43 30 2 57-12 102-38" stroke="#E6B75C" strokeWidth="1.2" />
              <path d="M18 97c32-18 50-25 76-25 32 0 58-14 88-35" stroke="#E6B75C" strokeWidth="1.2" />
            </svg>
          </div>
          <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[.07] px-2.5 py-1 text-[9px] font-bold tracking-wide text-[#f0ca79]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e6b75c]" />
            {t.listingsLabel}
          </span>
          <h1 className="relative mt-3 max-w-[300px] text-[27px] font-extrabold leading-[1.2] tracking-[-.035em]">{t.marketTitle}</h1>
          <p className="relative mt-2 max-w-[290px] text-[12px] leading-6 text-white/65">{t.marketDescription}</p>
          <form onSubmit={submitSearch} className="relative mt-5 flex min-w-0 items-center gap-2 rounded-[17px] bg-[#faf9f3] p-1.5 shadow-[0_5px_14px_rgba(0,0,0,.12)]">
            <Search size={17} className="ms-2 shrink-0 text-[#80908a]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.search}
              className="h-9 min-w-0 flex-1 bg-transparent px-1 text-[11px] font-medium text-[#193e42] outline-none placeholder:text-[#9ca59d]"
            />
            <button type="submit" className="flex h-9 shrink-0 items-center gap-1 rounded-[12px] bg-[#e6b75c] px-3 text-[10px] font-extrabold text-[#193e42] transition-transform active:scale-[.97]">
              {t.searchButton}<ArrowLeft size={13} />
            </button>
          </form>
          <p className="relative mt-3 text-[9px] font-medium text-white/45">{t.searchHint}</p>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <span className="text-[9px] font-bold tracking-[.15em] text-[#a07851]">{t.categoriesEyebrow}</span>
              <h2 className="mt-1 text-[16px] font-extrabold tracking-[-.025em]">{t.popular}</h2>
            </div>
            <a href="/categories" className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-[#627972]">{t.viewAll}<ArrowLeft size={12} /></a>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 phone-nav-scrollbar">
            <a href="/listings?category=tractors" className="flex shrink-0 items-center gap-2 rounded-[15px] border border-[#e3e2d7] bg-[#fffef8] px-3 py-2.5 text-[10px] font-bold text-[#294c4c] shadow-[0_3px_10px_rgba(30,53,51,.035)]"><span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#e6eddf] text-[#376158]"><Tractor size={16} /></span>{language === 'ar' ? 'آليات' : language === 'fr' ? 'Matériel' : 'Equipment'}</a>
            <a href="/listings?category=land" className="flex shrink-0 items-center gap-2 rounded-[15px] border border-[#e3e2d7] bg-[#fffef8] px-3 py-2.5 text-[10px] font-bold text-[#294c4c] shadow-[0_3px_10px_rgba(30,53,51,.035)]"><span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#f5ead4] text-[#9a7541]"><MapPin size={16} /></span>{language === 'ar' ? 'أراضٍ' : language === 'fr' ? 'Terrains' : 'Farmland'}</a>
            <a href="/listings?category=seeds" className="flex shrink-0 items-center gap-2 rounded-[15px] border border-[#e3e2d7] bg-[#fffef8] px-3 py-2.5 text-[10px] font-bold text-[#294c4c] shadow-[0_3px_10px_rgba(30,53,51,.035)]"><span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#f1e2dc] text-[#a9664e]"><Leaf size={16} /></span>{language === 'ar' ? 'بذور' : language === 'fr' ? 'Semences' : 'Seeds'}</a>
            <a href="/listings?category=parts" className="flex shrink-0 items-center gap-2 rounded-[15px] border border-[#e3e2d7] bg-[#fffef8] px-3 py-2.5 text-[10px] font-bold text-[#294c4c] shadow-[0_3px_10px_rgba(30,53,51,.035)]"><span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#e8e6ee] text-[#6e677f]"><Package size={16} /></span>{language === 'ar' ? 'قطع غيار' : language === 'fr' ? 'Pièces' : 'Parts'}</a>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <span className="text-[9px] font-bold tracking-[.15em] text-[#a07851]">{t.featured}</span>
              <h2 className="mt-1 text-[16px] font-extrabold tracking-[-.025em]">{t.greeting}</h2>
            </div>
            <a href="/listings" className="mb-0.5 text-[10px] font-bold text-[#627972]">{t.viewAll}</a>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <a href="/listings/2" className="group rounded-[18px] border border-[#e3e1d5] bg-[#fffef8] p-3 shadow-[0_5px_16px_rgba(30,53,51,.035)] transition-transform hover:-translate-y-0.5">
              <div className="mb-3 flex h-[68px] items-center justify-center overflow-hidden rounded-[13px] bg-[#e9eee3] text-[#69826b]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c7d4c2] bg-[#f4f4e9]"><MapPin size={20} /></div>
              </div>
              <span className="text-[9px] font-semibold text-[#87938a]">{language === 'ar' ? 'الأراضي الزراعية' : language === 'fr' ? 'Terrain agricole' : 'Farm land'}</span>
              <strong className="mt-1 block line-clamp-2 min-h-9 text-[11px] font-extrabold leading-5 text-[#25474a]">{language === 'ar' ? 'أرض خصبة قرب النهر' : language === 'fr' ? 'Terre fertile près du fleuve' : 'Fertile land near the river'}</strong>
              <span className="mt-1.5 flex items-center justify-between gap-1">
                <b className="text-[10px] font-extrabold text-[#25474a]" dir="ltr">{t.priceOne}</b>
                <small className="flex items-center gap-0.5 text-[9px] text-[#839088]"><MapPin size={11} />{t.locationOne}</small>
              </span>
            </a>
            <a href="/listings/1" className="group rounded-[18px] border border-[#e3e1d5] bg-[#fffef8] p-3 shadow-[0_5px_16px_rgba(30,53,51,.035)] transition-transform hover:-translate-y-0.5">
              <div className="mb-3 flex h-[68px] items-center justify-center overflow-hidden rounded-[13px] bg-[#f4e8d1] text-[#9c7441]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e4d0a9] bg-[#fbf3e3]"><Tractor size={22} /></div>
              </div>
              <span className="text-[9px] font-semibold text-[#87938a]">{language === 'ar' ? 'الآليات الزراعية' : language === 'fr' ? 'Matériel agricole' : 'Farm equipment'}</span>
              <strong className="mt-1 block line-clamp-2 min-h-9 text-[11px] font-extrabold leading-5 text-[#25474a]">{language === 'ar' ? 'جرار صغير بحالة ممتازة' : language === 'fr' ? 'Petit tracteur en excellent état' : 'Compact tractor, excellent condition'}</strong>
              <span className="mt-1.5 flex items-center justify-between gap-1">
                <b className="text-[10px] font-extrabold text-[#25474a]" dir="ltr">{t.priceTwo}</b>
                <small className="flex items-center gap-0.5 text-[9px] text-[#839088]"><MapPin size={11} />{t.locationTwo}</small>
              </span>
            </a>
          </div>
        </section>
      </main>

      <nav aria-label={t.mainArea} className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[430px] items-end justify-around border-t border-[#e5e3d8] bg-[#fbfaf5]/95 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_24px_rgba(37,59,54,.06)] backdrop-blur-xl">
        <a href="/" aria-current={active('/') ? 'page' : undefined} className={`flex min-w-[54px] flex-col items-center gap-1 px-1 pb-1 text-[9px] font-bold transition-colors ${active('/') ? 'text-[#193e42]' : 'text-[#849189]'}`}>
          <LayoutDashboard size={19} strokeWidth={active('/') ? 2.4 : 1.8} />{t.discover}
        </a>
        <a href="/listings" aria-current={active('/listings') ? 'page' : undefined} className={`flex min-w-[54px] flex-col items-center gap-1 px-1 pb-1 text-[9px] font-bold transition-colors ${active('/listings') ? 'text-[#193e42]' : 'text-[#849189]'}`}>
          <Search size={19} strokeWidth={active('/listings') ? 2.4 : 1.8} />{t.listings}
        </a>
        <a href="/add-listing" aria-label={t.add} className="relative -mt-7 flex h-[55px] w-[55px] shrink-0 items-center justify-center rounded-[19px] border-[5px] border-[#f5f3e9] bg-[#e6b75c] text-[#193e42] shadow-[0_6px_15px_rgba(172,127,57,.2)] transition-transform active:scale-95">
          <Plus size={24} strokeWidth={2.4} />
        </a>
        <a href="/saved" aria-current={active('/saved') ? 'page' : undefined} className={`flex min-w-[54px] flex-col items-center gap-1 px-1 pb-1 text-[9px] font-bold transition-colors ${active('/saved') ? 'text-[#193e42]' : 'text-[#849189]'}`}>
          <Bookmark size={19} strokeWidth={active('/saved') ? 2.4 : 1.8} />{t.saved}
        </a>
        <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} className={`flex min-w-[54px] flex-col items-center gap-1 px-1 pb-1 text-[9px] font-bold transition-colors ${menuOpen ? 'text-[#193e42]' : 'text-[#849189]'}`}>
          <Menu size={19} />{t.more}
        </button>
      </nav>

      {menuOpen && (
        <>
          <button type="button" aria-label={t.close} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-[#142f31]/35 backdrop-blur-[2px]" />
          <section role="dialog" aria-modal="true" aria-label={t.menuTitle} className="phone-nav-sheet fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[84dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[27px] border border-[#e2e0d4] bg-[#faf9f3] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_55px_rgba(19,44,45,.2)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d7d7ca]" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold tracking-[.15em] text-[#a07851]">{t.mainArea}</span>
                <h2 className="mt-1 text-[18px] font-extrabold tracking-[-.03em]">{t.menuTitle}</h2>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label={t.close} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e2d7] text-[#526c64] hover:bg-[#f0f0e7]"><X size={18} /></button>
            </div>
            <nav className="grid grid-cols-2 gap-2" aria-label={t.mainArea}>
              {extraLinks.map(({ href, key, Icon }) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active(href) ? 'page' : undefined} className={`flex min-h-[48px] items-center gap-2.5 rounded-[15px] border px-3 text-[11px] font-bold transition-colors ${active(href) ? 'border-[#cfdbce] bg-[#e9eee3] text-[#193e42]' : 'border-[#e8e6dc] bg-[#fffef9] text-[#59716a] hover:bg-[#f2f2e9]'}`}>
                  <Icon size={16} className="shrink-0 text-[#a27d4c]" />
                  <span className="min-w-0 flex-1 truncate">{t[key]}</span>
                  {href === '/messages' && signedIn && <span className="h-1.5 w-1.5 rounded-full bg-[#bd7153]" />}
                </a>
              ))}
            </nav>
            <div className="my-4 h-px bg-[#e7e5db]" />
            <div className="flex items-center justify-between gap-3">
              {signedIn ? (
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d9e3d7] text-[12px] font-black text-[#193e42]">{initial}</span>
                  <span className="min-w-0">
                    <a href="/account" onClick={() => setMenuOpen(false)} className="block truncate text-[11px] font-extrabold text-[#234649]">{userName}</a>
                    <small className="mt-0.5 block text-[9px] text-[#839088]">{t.registered}</small>
                  </span>
                </div>
              ) : (
                <a href="/sign-in" onClick={() => setMenuOpen(false)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#193e42] px-4 text-[11px] font-bold text-[#fffdf6]"><CircleUserRound size={15} />{t.signIn}</a>
              )}
              {signedIn && (
                <button type="button" onClick={() => setSignOutOpen(true)} disabled={isSigningOut} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-bold text-[#a75b45] transition-colors hover:bg-[#f5e8e0] disabled:opacity-60">
                  <span>{t.signOut}</span><ChevronLeft size={14} />
                </button>
              )}
            </div>
            <div className="mt-4 flex items-start gap-2.5 rounded-[16px] border border-[#e9e6d9] bg-[#f4f2e9] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e6b75c]/40 text-[#6f6648]"><ShieldCheck size={17} /></span>
              <div>
                <strong className="block text-[10px] font-extrabold">{t.secure}</strong>
                <p className="mt-1 text-[9px] leading-5 text-[#78877e]">{t.secureDescription}</p>
              </div>
            </div>
          </section>
        </>
      )}

      {signOutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142f31]/40 px-5 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-label={t.signOut} className="w-full max-w-[360px] rounded-[24px] border border-[#e7e3d6] bg-[#fbfaf4] p-5 shadow-[0_20px_60px_rgba(19,44,45,.24)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#f5e8e0] text-[#a75b45]"><X size={18} /></div>
            <h2 className="text-[15px] font-extrabold">{t.signOut}</h2>
            <p className="mt-2 text-[12px] leading-6 text-[#73827b]">{t.confirmSignOut}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setSignOutOpen(false)} className="min-h-10 flex-1 rounded-xl border border-[#e2e0d5] text-[11px] font-bold text-[#566e67]">{t.cancel}</button>
              <button type="button" onClick={() => void confirmSignOut()} disabled={isSigningOut} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#a75b45] text-[11px] font-bold text-white disabled:opacity-60">
                {isSigningOut ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Check size={14} />}
                {t.signOut}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}