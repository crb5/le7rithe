import { createElement, useEffect, useRef, useState } from 'react';
import { Show, useClerk, useUser } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import { useIsMutating } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { PageFade } from '@/components/motion';
import { favoriteMutationKey } from '@/lib/use-favorites';
import { SITE_NAME } from '@/lib/brand';
import { ViewportImage, listingThumbnailUrl } from '@/components/viewport-image';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Combine,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Leaf,
  LandPlot,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  FlaskConical,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingBasket,
  Shovel,
  Sprout,
  Tractor,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Listing } from '@workspace/api-client-react';
import { formatMoneyValue, useLanguage, type MarketplaceLanguage } from '@/lib/language';
import { translateLocationName } from '@/lib/listing-localization';
import { useListingTaxonomy } from '@/lib/listing-taxonomy';
import {
  listingPlaceholderIconForCategory,
  type ListingPlaceholderCategory,
  type ListingPlaceholderIconName,
} from '@/lib/listing-placeholder-map';
import { ENABLE_PAID_LISTINGS } from '@/lib/features';
import { useMarketplaceNotifications } from '@/hooks/use-notifications';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useToast } from '@/hooks/use-toast';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { FavoriteSignInDialog } from './favorite-sign-in-dialog';
import Header, { HeaderBrand, type Lang } from './Header';
import { SignOutDialog } from './sign-out-dialog';
import { VerifiedBadge } from './verified-badge';

export const iconForCategory = (category: string | { slug: string; name?: string; nameFr?: string; nameEn?: string }) => {
  const searchText = (typeof category === 'string'
    ? category
    : [category.slug, category.name, category.nameFr, category.nameEn].filter(Boolean).join(' ')
  ).toLocaleLowerCase();

  if (/part|spare|pi[eè]ce|قطع|غيار/.test(searchText)) return Wrench;
  if (/tractor|machin|معدات|آليات|جرار|حاصدة|محراث|بذارة/.test(searchText)) return Tractor;
  if (/seed|semenc|بذر|بذور/.test(searchText)) return Sprout;
  if (/land|terrain|اراضي|أراضي|ارض|أرض/.test(searchText)) return LandPlot;
  if (/fertili|engrais|سماد|أسمدة/.test(searchText)) return FlaskConical;
  if (/product|produit|منتج|تسويق/.test(searchText)) return ShoppingBasket;
  if (/service|ressource|human|خدم|موارد|بشر/.test(searchText)) return Users;
  if (/farm|مزر/.test(searchText)) return MapPin;
  return Leaf;
};

export type ListingImageCategory = ListingPlaceholderCategory;

export type ListingImageInput = string | readonly (string | null | undefined)[] | null | undefined;

export function getListingImageSources(images?: ListingImageInput, imageUrl?: string | null): string[] {
  const imageList = typeof images === 'string' ? [images] : images ?? [];
  const sources = [imageUrl, ...imageList]
    .filter((source): source is string => typeof source === 'string')
    .map((source) => source.trim())
    .filter(Boolean);

  return [...new Set(sources)];
}

export function firstAvailableListingImage(
  sources: readonly string[],
  failedSources: ReadonlySet<string> = new Set(),
): string | undefined {
  return sources.find((source) => !failedSources.has(source));
}

export function markListingImageFailed(
  current: { sourceKey: string; sources: ReadonlySet<string> },
  sourceKey: string,
  failedSource: string,
) {
  const sources = current.sourceKey === sourceKey ? new Set(current.sources) : new Set<string>();
  sources.add(failedSource);
  return { sourceKey, sources };
}

function listingPlaceholderAssetUrl(iconName: ListingPlaceholderIconName): string {
  const baseUrl = import.meta.env?.BASE_URL || '/';
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}assets/placeholders/${iconName}.svg`;
}

const listingPlaceholderIconMap: Array<{ matches: RegExp; icon: LucideIcon }> = [
  { matches: /spare|parts?|pi[eè]ces?|قطع(?:\s|[-_]?)غيار|غيار/iu, icon: Wrench },
  { matches: /harvest|combine|moissonn|حصاد|حصادات?|حاصدة|حاصدات/iu, icon: Combine },
  { matches: /plough|plow|charrue|labour|محاريث|محراث|حراثة/iu, icon: Shovel },
  { matches: /land|terrain|terre|أراضي|اراضي|أرض|ارض/iu, icon: LandPlot },
  { matches: /seed|semence|بذور|بذر|بذرة/iu, icon: Sprout },
  { matches: /fertili[sz]er|engrais|أسمدة|اسمدة|سماد/iu, icon: Package },
  { matches: /tractor|tracteur|machin|equipment|معدات|آليات|جرارات?|الجرارات/iu, icon: Tractor },
];

export function listingImageIconForCategory(category: ListingImageCategory = ''): LucideIcon {
  const searchText = (typeof category === 'string'
    ? category
    : [
        category.subcategorySlug,
        category.subcategory,
        category.categorySlug,
        category.category,
        category.slug,
        category.name,
        category.nameFr,
        category.nameEn,
      ].filter(Boolean).join(' ')
  ).toLocaleLowerCase();

  return listingPlaceholderIconMap.find(({ matches }) => matches.test(searchText))?.icon ?? Leaf;
}

export function ListingImage({
  images,
  imageUrl,
  category,
  alt = '',
  className = 'h-full w-full',
  imageClassName = 'object-cover',
  placeholderClassName = '',
  loading,
  draggable,
  testId,
  thumbnail = false,
}: {
  images?: ListingImageInput;
  imageUrl?: string | null;
  category?: ListingImageCategory;
  alt?: string;
  className?: string;
  imageClassName?: string;
  placeholderClassName?: string;
  loading?: 'eager' | 'lazy';
  draggable?: boolean;
  testId?: string;
  thumbnail?: boolean;
}) {
  const [failedImageState, setFailedImageState] = useState<{ sourceKey: string; sources: Set<string> }>({
    sourceKey: '',
    sources: new Set(),
  });
  const imageSources = getListingImageSources(images, imageUrl);
  const sourceKey = JSON.stringify(imageSources);
  const failedSources = failedImageState.sourceKey === sourceKey ? failedImageState.sources : new Set<string>();
  const imageSrc = firstAvailableListingImage(imageSources, failedSources);
  const [thumbnailFailure, setThumbnailFailure] = useState('');
  const thumbnailKey = `${sourceKey}:${imageSrc}`;
  const displaySrc = imageSrc && thumbnail && thumbnailFailure !== thumbnailKey ? listingThumbnailUrl(imageSrc) : imageSrc;
  const placeholderName = listingPlaceholderIconForCategory(category);
  const Icon = listingImageIconForCategory(category);

  if (imageSrc) {
    return createElement(ViewportImage, {
      key: `${sourceKey}:${imageSrc}`,
      src: displaySrc,
      alt,
      className: `${className} ${imageClassName}`,
      loading,
      draggable,
      onError: () => {
        if (displaySrc !== imageSrc) setThumbnailFailure(thumbnailKey);
        else setFailedImageState((current) => markListingImageFailed(current, sourceKey, imageSrc));
      },
      'data-testid': testId,
    });
  }

  if (placeholderName) {
    return createElement(ViewportImage, {
      src: listingPlaceholderAssetUrl(placeholderName),
      alt,
      className: `${className} ${imageClassName}`,
      loading,
      draggable,
      'data-testid': testId,
      'data-placeholder-icon': placeholderName,
    });
  }

  return createElement(
    'div',
    {
      className: `flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,hsl(155_33%_23%),hsl(153_26%_34%))] text-[hsl(var(--accent))] ${className} ${placeholderClassName}`,
      role: alt ? 'img' : undefined,
      'aria-label': alt || undefined,
      'aria-hidden': alt ? undefined : true,
      'data-testid': testId,
    },
    createElement(Icon, { size: 48, strokeWidth: 1.1, className: 'max-h-full max-w-full', 'aria-hidden': true }),
  );
}

export const formatPrice = (price: number, currency = 'MRU', language: MarketplaceLanguage = 'ar') =>
  formatMoneyValue(price, currency, language);

export const relativeDate = (value: string, language: MarketplaceLanguage = 'ar', now = Date.now()) => {
  const publishedAt = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((now - publishedAt) / 1000));
  const label = language === 'ar' ? 'نُشر' : language === 'fr' ? 'Publié' : 'Published';
  if (!Number.isFinite(publishedAt) || seconds < 60) return language === 'ar' ? `${label} الآن` : language === 'fr' ? `${label} à l'instant` : `${label} now`;
  // Same thresholds and exact labels, without five copies of each formatter.
  const units = [
    [60, 60, 'دقيقة', 'دقيقتين', 'دقائق', 'une minute', 'minutes', 'a minute', 'minutes'],
    [3600, 24, 'ساعة', 'ساعتين', 'ساعات', 'une heure', 'heures', 'an hour', 'hours'],
    [86400, 7, 'يوم', 'يومين', 'أيام', 'un jour', 'jours', 'a day', 'days'],
    [604800, 5, 'أسبوع', 'أسبوعين', 'أسابيع', 'une semaine', 'semaines', 'a week', 'weeks'],
    [2592000, 12, 'شهر', 'شهرين', 'أشهر', 'un mois', 'mois', 'a month', 'months'],
    [31536000, Infinity, 'سنة', 'سنتين', 'سنوات', 'un an', 'ans', 'a year', 'years'],
  ] as const;
  const [duration, , singular, dual, plural, frenchOne, frenchMany, englishOne, englishMany]
    = units.find(([duration, limit]) => Math.floor(seconds / duration) < limit) ?? units[5];
  const count = Math.floor(seconds / duration);
  if (language === 'ar') return `${label} قبل ${count === 1 ? singular : count === 2 ? dual : `${count} ${count <= 10 || duration === 31536000 ? plural : singular}`}`;
  if (language === 'fr') return `${label} il y a ${count === 1 ? frenchOne : `${count} ${frenchMany}`}`;
  return `${label} ${count === 1 ? englishOne : `${count} ${englishMany}`} ago`;
};

export function useRelativeDate(value: string, language: MarketplaceLanguage = 'ar') {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [value]);

  return relativeDate(value, language, now);
}

export function RelativePublishedTime({ value, className }: { value: string; className?: string }) {
  const { language } = useLanguage();
  const text = useRelativeDate(value, language);
  return <time dateTime={value} className={className}>{text}</time>;
};

export function Logo({ compact = false, testId = 'link-logo', variant = 'dark', size = 'default' }: { compact?: boolean; testId?: string; variant?: 'light' | 'dark'; size?: 'default' | 'compact' }) {
  const brandText = variant === 'light' ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--sidebar-foreground))]';
  const compactSize = size === 'compact';
  return (
    <Link href="/" dir="ltr" className={`group flex w-fit flex-col items-start ${compactSize ? 'min-w-0' : ''}`} aria-label={SITE_NAME} {...(testId ? { 'data-testid': testId } : {})}>
      <strong dir="ltr" className={`block whitespace-nowrap ${compactSize ? 'text-[14px]' : 'text-[18px]'} font-bold tracking-[.035em] ${brandText}`}>{SITE_NAME}</strong>
    </Link>
  );
}

const navItems = [
  { href: '/', label: 'discover', icon: LayoutDashboard },
  { href: '/listings', label: 'allListings', icon: Search },
  { href: '/categories', label: 'categories', icon: Package },
  { href: '/add-listing', label: 'addListing', icon: Plus },
  { href: '/saved', label: 'saved', icon: Bookmark },
  { href: '/support', label: 'support', icon: MessageCircle },
  { href: '/notifications', label: 'notifications', icon: Bell },
  { href: '/payments', label: 'myPayments', icon: CreditCard },
  { href: '/dashboard', label: 'sellerDashboard', icon: Gauge },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const detailListingId = Number(/^\/listings\/(\d+)$/.exec(location)?.[1]);
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [headerHasFocus, setHeaderHasFocus] = useState(false);
  const [floatingActionsHaveFocus, setFloatingActionsHaveFocus] = useState(false);
  const { direction, isAtTop } = useScrollDirection(location);
  const headerVisible = isAtTop || direction !== 'down' || open || languageMenuOpen || headerHasFocus;
  const headerElevated = direction === 'up' && !isAtTop;
  const floatingActionsVisible = isAtTop || direction !== 'down' || floatingActionsHaveFocus;
  const { language, setLanguage, meta, t, formatNumber } = useLanguage();
  const isArabicLayout = meta[language].dir === 'rtl';
  useBodyScrollLock(open, drawerRef);
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: notifications } = useMarketplaceNotifications();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const metadataFirstName = typeof user?.unsafeMetadata?.firstName === 'string' ? user.unsafeMetadata.firstName : '';
  const metadataLastName = typeof user?.unsafeMetadata?.lastName === 'string' ? user.unsafeMetadata.lastName : '';
  const metadataName = `${metadataFirstName} ${metadataLastName}`.trim();
  const displayName = user?.fullName || metadataName || user?.firstName || t('user');
  const initial = displayName.trim().charAt(0) || t('user').charAt(0);

  const closeNavigation = () => {
    document.querySelector<HTMLButtonElement>('[data-testid="button-open-menu"]')?.focus();
    setOpen(false);
  };

  const handleNavigationOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setOpen(true);
    else closeNavigation();
  };

  useEffect(() => {
    if (!open) return;
    document.querySelector<HTMLButtonElement>(
      '#marketplace-navigation-drawer [data-testid="button-close-menu"]',
    )?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.sh-lang[data-open="true"]')) return;
      closeNavigation();
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setShowSignOutConfirm(false);
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sign-in` });
    } finally {
      setIsSigningOut(false);
    }
  };
  return (
    <div dir={meta[language].dir} className="grain min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <aside ref={drawerRef} id="marketplace-navigation-drawer" dir={meta[language].dir} className={`marketplace-navigation-drawer ${isArabicLayout ? 'marketplace-navigation-drawer--rtl' : 'marketplace-navigation-drawer--ltr'} fixed bottom-0 z-40 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-[#22362C] px-5 py-6 text-[#F4E9CF] shadow-2xl transition-transform duration-[250ms] motion-reduce:transition-none ${open ? 'translate-x-0' : isArabicLayout ? 'translate-x-full' : '-translate-x-full'}`} aria-label={t('mainNavigation')} aria-hidden={!open} inert={!open}>
        <div className="mb-10 flex items-center justify-between">
          <HeaderBrand variant="sidebar" direction={meta[language].dir} />
          <button type="button" onClick={closeNavigation} className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9B949]" aria-label={t('closeMenu')} data-testid="button-close-menu"><X size={19} /></button>
        </div>
        <nav className="space-y-1">
          <span className="mb-3 block px-3 text-[10px] font-bold tracking-[.16em] text-white/40">{t('mainArea')}</span>
          {navItems.filter((item) => ENABLE_PAID_LISTINGS || item.href !== '/payments').map((item) => {
            const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
            const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={closeNavigation} aria-current={active ? 'page' : undefined} className={`group flex items-center gap-3 rounded-xl border-b border-white/[.15] px-3 py-[14px] text-[17px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9B949] ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[#E9B949]' : 'text-white/80 hover:bg-white/[.07] hover:text-[#E9B949]'}`} data-testid={`link-nav-${item.label}`}>
              <Icon size={18} strokeWidth={active ? 2.4 : 1.8} /><span>{t(item.label)}</span>
              {item.href === '/notifications' && Boolean(notifications?.unreadCount) && <span className="ms-auto min-w-5 rounded-full bg-[hsl(var(--accent))] px-1.5 py-0.5 text-center text-[10px] font-black text-[hsl(var(--primary))]">{formatNumber(notifications?.unreadCount ?? 0)}</span>}
            </Link>;
          })}
        </nav>
        <div className="mt-auto pt-8">
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.05] p-4">
            <div className="mb-3 flex items-center gap-2 text-[hsl(var(--accent))]"><ShieldCheck size={16} /><span className="text-xs font-bold">{t('trustedTrade')}</span></div>
            <p className="text-[11px] leading-6 text-white/55">{t('trustedTradeDescription')}</p>
          </div>
          <Show when="signed-in"><div className="border-t border-white/10 pt-4">
            <Link href="/account" className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[.06]" data-testid="link-account-sidebar">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--primary))]">{initial}</span>
              <span className="min-w-0 flex-1 text-start">
                <small className="block text-[10px] text-white/45">{t('registeredAccount')}</small>
                <strong className="mt-1 block truncate text-xs">{displayName}</strong>
              </span>
              {language === 'ar' ? <ChevronLeft size={16} className="shrink-0 text-white/35" /> : <ChevronRight size={16} className="shrink-0 text-white/35" />}
            </Link>
            <div className="mt-4 border-t border-white/10 pt-4">
              <button type="button" onClick={() => setShowSignOutConfirm(true)} disabled={isSigningOut} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300" data-testid="button-sidebar-sign-out">{isSigningOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}{isSigningOut ? t('signingOut') : t('signOut')}</button>
            </div>
          </div></Show>
          <Show when="signed-out"><Link href="/sign-in" className="flex items-center justify-center rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold text-white" data-testid="link-sidebar-sign-in">{t('signIn')}</Link></Show>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[11px] font-semibold text-white/45">
            <Link href="/privacy" onClick={closeNavigation} className="transition-colors hover:text-white/80" data-testid="link-sidebar-privacy">{t('privacyPolicy')}</Link>
            <Link href="/terms" onClick={closeNavigation} className="transition-colors hover:text-white/80" data-testid="link-sidebar-terms">{t('termsOfService')}</Link>
          </div>
        </div>
      </aside>
      {open && <button type="button" onClick={closeNavigation} aria-label={t('closeMenu')} className="fixed inset-0 z-30 touch-none bg-black/50" data-testid="button-overlay-menu" />}
      <div className="market-content-shell w-full min-w-0">
        <div
          data-testid="marketplace-header"
          data-header-state={headerVisible ? 'visible' : 'hidden'}
          data-header-elevated={headerElevated}
          aria-hidden={!headerVisible}
          inert={!headerVisible}
          className="marketplace-header-shell"
          onFocusCapture={() => setHeaderHasFocus(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setHeaderHasFocus(false);
            }
          }}
        >
          <Header
            language={({ ar: 'AR', fr: 'FR', en: 'EN' } as const)[language]}
            onLanguageChange={(nextLanguage: Lang) => setLanguage(({ AR: 'ar', FR: 'fr', EN: 'en' } as const)[nextLanguage])}
            menuOpen={open}
            onMenuOpen={handleNavigationOpenChange}
            languageMenuOpen={languageMenuOpen}
            onLanguageMenuOpenChange={setLanguageMenuOpen}
            menuLabel={t('openMenu')}
          />
        </div>
        <div className="mx-auto mt-2 hidden max-w-[1420px] px-8 xl:block">
          <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{t('goodMorning', { name: displayName })}</p>
          <p className="text-sm font-bold">{t('whatLookingFor')}</p>
        </div>
        <main className="mx-auto w-full min-w-0 max-w-[1420px] px-4 pt-6 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-7 sm:pt-8 lg:px-8 lg:pt-10 xl:pb-24"><PageFade key={location} enabled={location !== '/'}>{Number.isFinite(detailListingId) && detailListingId > 0 && <div className="mb-4 flex justify-end"><ListingShareButton listing={{ id: detailListingId }} /></div>}{children}</PageFade></main>
      </div>
      <footer className="border-t border-[hsl(var(--border)/.75)] bg-[hsl(var(--card)/.45)] px-4 py-8 sm:px-7 lg:px-8" data-testid="footer-marketplace">
        <div className="mx-auto flex max-w-[1420px] flex-col gap-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm">
              <Link href="/" dir="ltr" aria-label={SITE_NAME} className="inline-flex flex-col items-start text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-brand">
                <strong dir="ltr" className="block text-sm font-bold tracking-[.035em]">{SITE_NAME}</strong>
              </Link>
              <div className="mt-4 flex items-start gap-2 text-[hsl(var(--primary))]">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold">{t('trustedTrade')}</p>
                  <p className="mt-1 max-w-xs text-[11px] leading-6 text-[hsl(var(--muted-foreground))]">{t('trustedTradeDescription')}</p>
                </div>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]" aria-label={t('mainNavigation')}>
              <Link href="/" className="transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-home">{t('discover')}</Link>
              <Link href="/listings" className="transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-listings">{t('allListings')}</Link>
              <Link href="/categories" className="transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-categories">{t('categories')}</Link>
              <Link href="/support" className="transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-support">{t('support')}</Link>
              <Link href="/privacy" className="transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-privacy">{t('privacyPolicy')}</Link>
              <Link href="/terms" className="transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-terms">{t('termsOfService')}</Link>
              <Link href="/add-listing" className="text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]" data-testid="link-footer-add-listing">{t('addListing')}</Link>
            </nav>
          </div>
          <p dir="ltr" className="border-t border-[hsl(var(--border)/.75)] pt-5 text-[11px] text-[hsl(var(--muted-foreground))]">&copy; {new Date().getFullYear()} <bdi>{SITE_NAME}</bdi>. {t('footerRights')}</p>
        </div>
      </footer>
      <Show when="signed-in"><Link href="/support" className={`fixed bottom-[4.5rem] start-3 z-20 inline-flex h-11 items-center justify-center transition-[transform,translate,opacity] duration-300 ease-out motion-reduce:transition-none xl:bottom-5 xl:start-5 ${floatingActionsVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`} aria-label={t('support')} aria-hidden={!floatingActionsVisible} inert={!floatingActionsVisible} onFocus={() => setFloatingActionsHaveFocus(true)} onBlur={() => setFloatingActionsHaveFocus(false)} data-floating-visibility={floatingActionsVisible ? 'visible' : 'hidden'} data-testid="link-floating-support"><span className="inline-flex h-9 items-center gap-1 rounded-full border border-[hsl(var(--primary)/.18)] bg-[hsl(var(--card)/.96)] px-2 text-[10px] font-bold text-[hsl(var(--primary))] shadow-[0_7px_20px_hsl(155_20%_18%/.14)] backdrop-blur-sm transition-colors hover:bg-[hsl(var(--secondary))]"><MessageCircle size={14} />{t('support')}</span></Link></Show>
      <Link href="/add-listing" className={`fixed bottom-5 start-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[0_8px_22px_hsl(42_87%_45%/.28)] transition-[transform,translate,opacity] duration-300 ease-out motion-reduce:transition-none xl:hidden ${floatingActionsVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`} aria-label={t('addListing')} aria-hidden={!floatingActionsVisible} inert={!floatingActionsVisible} onFocus={() => setFloatingActionsHaveFocus(true)} onBlur={() => setFloatingActionsHaveFocus(false)} data-floating-visibility={floatingActionsVisible ? 'visible' : 'hidden'} data-testid="link-mobile-add"><Plus size={20} /></Link>
      <FavoriteSignInDialog />
      <SignOutDialog open={showSignOutConfirm} isLoading={isSigningOut} onCancel={() => setShowSignOutConfirm(false)} onConfirm={() => void handleSignOut()} />
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><span className="mb-2 block text-[11px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</span><h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--primary))] sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

const appBasePath = import.meta.env?.BASE_URL?.replace(/\/$/, '') ?? '';

export function listingShareUrl(listingId: number) {
  const url = new URL(window.location.href);
  url.pathname = `${appBasePath}/listings/${listingId}`.replace(/\/+/g, '/');
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Continue with the legacy clipboard fallback below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard access was unavailable');
}

export function ListingShareButton({ listing, compact = false, isMarqueeDuplicate = false }: { listing: Pick<Listing, 'id'> & Partial<Pick<Listing, 'title'>>; compact?: boolean; isMarqueeDuplicate?: boolean }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const shareListing = async () => {
    if (isSharing) return;
    setIsSharing(true);
    const url = listingShareUrl(listing.id);
    try {
      if (navigator.share) {
        try {
          const title = listing.title || document.querySelector('h1')?.textContent || t('shareListing');
          await navigator.share({ title, text: title, url });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }

      await copyTextToClipboard(url);
      toast({ title: t('linkCopied') });
    } catch {
      toast({ title: t('copyLinkFailed'), variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  return <button type="button" tabIndex={isMarqueeDuplicate ? -1 : undefined} onClick={() => void shareListing()} disabled={isSharing} className={`listing-share ${compact ? 'listing-share--compact' : ''}`} aria-label={t('shareListing')} data-testid={`button-share-${listing.id}`}><Share2 size={compact ? 14 : 17} />{t('shareListing')}</button>;
}

export function ListingCard({ listing, onSave, featured = false, iconSize = 32, isMarqueeDuplicate = false }: { listing: Listing; onSave?: (listing: Listing) => void | Promise<unknown>; featured?: boolean; iconSize?: 24 | 32; isMarqueeDuplicate?: boolean }) {
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  useEffect(() => setOptimisticSaved(null), [listing.id, listing.isSaved]);
  const saved = optimisticSaved ?? Boolean(listing.isSaved);
  const isSaving = useIsMutating({ mutationKey: favoriteMutationKey }) > 0;
  const reduceMotion = useReducedMotion();
  const { language, t, formatDate } = useLanguage();
  const { categoryName } = useListingTaxonomy();
  const localizedCategory = categoryName(listing.categorySlug, listing.category);
  const isFeatured = featured || listing.featured;
  const iconBoxClass = iconSize === 24 ? 'h-6 w-6' : 'h-8 w-8';
  const listingHref = `/listings/${listing.id}`;
  const publishedAt = useRelativeDate(listing.createdAt, language);
  const listingCategory = {
    category: listing.category,
    categorySlug: listing.categorySlug,
    subcategorySlug: listing.subcategorySlug,
  };
  const handleSave = () => {
    const nextSaved = !saved;
    setOptimisticSaved(nextSaved);
    void Promise.resolve(onSave?.({ ...listing, isSaved: saved }))
      .then((result) => {
        if (result === undefined) setOptimisticSaved(null);
      })
      .catch(() => setOptimisticSaved(null));
  };
  return (
    <motion.article whileHover={reduceMotion ? undefined : { scale: 1.02, y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.97, y: -3 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={`listing-card group ${isFeatured ? 'listing-card--featured' : ''}`} data-testid={`card-listing-${listing.id}`} aria-hidden={isMarqueeDuplicate || undefined}>
      <div className="listing-card-body">
        <div className="listing-card-row">
          <Link href={listingHref} tabIndex={isMarqueeDuplicate ? -1 : undefined} className="listing-card-photo" aria-label={listing.title}>
            <ListingImage
              images={listing.images}
              imageUrl={listing.imageUrl}
              category={listingCategory}
              alt={listing.title}
              imageClassName="object-cover"
              loading="lazy"
              thumbnail
              testId={`img-listing-${listing.id}`}
            />
            {(() => {
              const isRental = listing.attributes?.saleType === 'rent';
              const isUnavailable = isRental ? listing.rentalStatus === 'leased' : listing.saleStatus === 'sold';
              return <span
                className={`pointer-events-none absolute start-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate whitespace-nowrap rounded-md px-2 py-1 text-[9px] font-bold leading-4 shadow-sm ${
                  isUnavailable ? 'bg-[hsl(var(--destructive))] text-white'
                    : 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]'
                }`}
                data-testid={`badge-listing-offer-${listing.id}`}
              >{isUnavailable ? (isRental ? t('leased') : t('sold')) : (isRental ? t('forRent') : t('forSale'))}</span>;
            })()}
          </Link>
          <Link href={listingHref} tabIndex={isMarqueeDuplicate ? -1 : undefined} className="listing-card-content" data-testid={`link-listing-${listing.id}`}>
            <div className="listing-card-labels">
              {isFeatured ? <span className="rounded-md bg-[hsl(var(--accent))] px-1.5 py-0.5 text-[9px] font-bold leading-4 text-[hsl(var(--primary))]">{t('featuredChoice')}</span> : null}
              <span className="min-w-0 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">{localizedCategory}</span>
            </div>
            <time dateTime={listing.createdAt} className="mb-1 block text-[10px] text-[hsl(var(--muted-foreground))]" data-testid={`time-listing-published-${listing.id}`}>{publishedAt}</time>
            <h3 className="text-[14px] font-bold leading-6 text-[hsl(var(--primary))]">{listing.title}</h3>
            <div className="listing-card-seller">
              <span className="truncate">{listing.seller.name}</span>
              {listing.seller.verified && <VerifiedBadge size="compact" testId={`badge-verified-listing-${listing.id}`} />}
            </div>
            <div className="listing-card-price-line">
              <strong className="font-numeric text-[13px] font-extrabold text-[hsl(var(--primary))]" dir="ltr">{formatPrice(listing.price, listing.currency, language)}</strong>
              <span className="flex min-w-0 items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span className={`flex ${iconBoxClass} shrink-0 items-center justify-center`}><MapPin size={iconSize === 24 ? 24 : 16} /></span><span className="min-w-0">{translateLocationName(listing.location, language)}</span></span>
            </div>
          </Link>
        </div>
        <div className="listing-card-actions">
          <ListingShareButton listing={listing} compact isMarqueeDuplicate={isMarqueeDuplicate} />
          <button type="button" tabIndex={isMarqueeDuplicate ? -1 : undefined} onClick={handleSave} disabled={isSaving || !onSave} aria-busy={isSaving} aria-pressed={saved} className={`listing-save ${iconBoxClass}`} aria-label={saved ? t('removeSaved') : t('saveListing')} data-testid={`button-save-${listing.id}`}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
    </motion.article>
  );
}

export function ListingSkeleton({ count = 4, variant = 'compact' }: { count?: number; variant?: 'compact' | 'listing-card' }) {
  const gridClass = variant === 'listing-card'
    ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4';
  return (
    <div className={gridClass} aria-hidden="true" data-testid="listing-skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        variant === 'listing-card' ? (
          <div key={i} className={`min-h-[175px] min-w-0 animate-pulse rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-3 shadow-[0_5px_18px_hsl(155_20%_18%/.045)] ${i > 1 ? 'hidden sm:block' : ''}`}>
            <div className="flex h-full min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="h-24 w-24 shrink-0 rounded-xl bg-[hsl(var(--muted))]" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-2/5 rounded bg-[hsl(var(--muted))]" />
                  <div className="h-3 w-4/5 rounded bg-[hsl(var(--muted))]" />
                  <div className="h-3 w-3/5 rounded bg-[hsl(var(--muted))]" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-[hsl(var(--muted))]" />
                </div>
              </div>
              <div className="mt-auto flex justify-end">
                <div className="h-6 w-6 rounded-full bg-[hsl(var(--muted))]" />
              </div>
            </div>
          </div>
        ) : (
          <div key={i} className="flex min-h-[112px] animate-pulse items-start gap-3 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-[hsl(var(--muted))]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 w-1/3 rounded bg-[hsl(var(--muted))]" />
              <div className="h-4 w-5/6 rounded bg-[hsl(var(--muted))]" />
              <div className="h-3 w-1/2 rounded bg-[hsl(var(--muted))]" />
            </div>
          </div>
        )
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Package, title, description, action }: { icon?: typeof Package; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] p-8 text-center"><span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={26} strokeWidth={1.5} /></span><h3 className="text-lg font-bold text-[hsl(var(--primary))]">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useLanguage();
  return <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.04)] p-8 text-center"><span className="mb-3 text-sm font-bold text-[hsl(var(--destructive))]">{t('temporaryIssue')}</span><p className="text-sm text-[hsl(var(--muted-foreground))]">{message ?? t('dataLoadError')}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-retry">{t('retry')}</button>}</div>;
}

export function StatCard({ label, value, icon: Icon, accent = false, href }: { label: string; value: string | number; icon: typeof Users; accent?: boolean; href?: string }) {
  const content = <div className="market-stat" data-accent={accent || undefined}>
    <div className="mb-7 flex items-start justify-between">
      <span className="market-stat-icon"><Icon size={19} /></span>
      <ArrowUpRight size={15} className="market-stat-arrow" />
    </div>
    <strong className="font-numeric text-2xl font-extrabold" dir="ltr">{value}</strong>
    <p className="market-stat-label">{label}</p>
  </div>;

  if (!href) return content;

  return <Link href={href} className="block cursor-pointer rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_hsl(155_20%_18%/.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2">{content}</Link>;
}

export function SearchBar({ value, onChange, onSubmit, onFilterClick, placeholder }: { value: string; onChange: (value: string) => void; onSubmit?: () => void; onFilterClick?: () => void; placeholder?: string }) {
  const { t } = useLanguage();
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }} className="flex min-w-0 items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-[0_7px_24px_hsl(155_20%_18%/.05)] transition-shadow focus-within:border-[hsl(var(--primary)/.45)] focus-within:shadow-[0_8px_26px_hsl(155_20%_18%/.1)]">
    <Search size={19} className="mx-1 shrink-0 text-[hsl(var(--muted-foreground))]" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ?? t('searchPlaceholder')} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-[#000000] outline-none focus:text-[#000000] placeholder:text-[#6b7280]" data-testid="input-search" />
    {onFilterClick && <button type="button" onClick={onFilterClick} aria-label={t('filters')} className="flex shrink-0 items-center gap-1 rounded-xl border border-[hsl(var(--border))] px-2.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" data-testid="button-home-filters"><SlidersHorizontal size={15} aria-hidden="true" /><span>{t('filters')}</span></button>}
    <button type="submit" className="shrink-0 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] sm:px-4" data-testid="button-submit-search">{t('search')}</button>
  </form>;
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--accent-foreground))]" data-testid={`link-section-${href.replace('/', '') || 'home'}`}>{children}<ForwardArrow size={15} /></Link>;
}

export function ForwardArrow({ size = 15, className = '' }: { size?: number; className?: string }) {
  const { language, meta } = useLanguage();
  const direction = meta[language].dir;
  const Icon = direction === 'rtl' ? ArrowLeft : ArrowRight;
  return <Icon size={size} className={`shrink-0 ${className}`} aria-hidden="true" data-direction={direction} />;
}