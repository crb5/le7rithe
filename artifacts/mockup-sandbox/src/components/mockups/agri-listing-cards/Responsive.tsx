import './_group.css';
import './Responsive.css';
import { useState } from 'react';
import { Bookmark, Check, MapPin, Share2, Tractor } from 'lucide-react';

type ListingSample = {
  id: number;
  title: string;
  category: string;
  location: string;
  price: number;
  currency: string;
  createdAt: string;
  imageUrl?: string | null;
  images?: string[];
  featured?: boolean;
  isSaved?: boolean;
  saleStatus?: string;
};

const listings: ListingSample[] = [
  {
    id: 214,
    title: 'جرار زراعي حديث بحالة ممتازة وجاهز للعمل',
    category: 'الآليات الزراعية',
    location: 'روصو، الترارزة',
    price: 1250000,
    currency: 'MRU',
    createdAt: '2026-09-28T10:00:00.000Z',
    featured: true,
  },
  {
    id: 208,
    title: 'مضخة مياه قوية للري مع جميع الملحقات',
    category: 'معدات الري',
    location: 'بوتلميت',
    price: 95000,
    currency: 'MRU',
    createdAt: '2026-09-27T09:00:00.000Z',
    saleStatus: 'sold',
  },
];

function formatPrice(price: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(price)} ${currency}`;
}

function ListingCard({ listing }: { listing: ListingSample }) {
  const [saved, setSaved] = useState(Boolean(listing.isSaved));
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const image = listing.imageUrl || listing.images?.[0];
  const listingHref = `/listings/${listing.id}`;
  const publishedAt = new Date(listing.createdAt);
  const publishedLabel = Number.isNaN(publishedAt.getTime())
    ? 'نُشر الآن'
    : 'نُشر حديثاً';

  async function shareListing() {
    const url = `${window.location.origin}${listingHref}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: listing.title, url });
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 1800);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareState('idle');
    }
  }

  return (
    <article className="listing-card" data-testid={`card-listing-${listing.id}`}>
      <div className="listing-card__media">
        {image ? (
          <img className="listing-card__image" src={image} alt={listing.title} />
        ) : (
          <Tractor size={54} strokeWidth={1.1} aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => setSaved((value) => !value)}
          aria-label={saved ? 'إزالة الإعلان من المحفوظات' : 'حفظ الإعلان'}
          aria-pressed={saved}
          className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 shadow-lg backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] ${
            saved
              ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]'
              : 'bg-[hsl(var(--primary)/.78)] text-white hover:bg-[hsl(var(--primary))]'
          }`}
          data-testid={`button-save-${listing.id}`}
        >
          <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {listing.featured && (
          <span className="absolute bottom-3 right-3 rounded-full bg-[hsl(var(--accent))] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--primary))] shadow-md">
            اختيار مميز
          </span>
        )}
      </div>

      <div className="listing-card__content">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold text-[hsl(var(--muted-foreground))]">
            {listing.category}
          </span>
          <time
            dateTime={listing.createdAt}
            className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]"
          >
            {publishedLabel}
          </time>
        </div>

        <a
          href={listingHref}
          aria-label={`عرض الإعلان: ${listing.title}`}
          className="group/title rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          data-testid={`link-listing-${listing.id}`}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {listing.featured && (
              <span className="rounded-md bg-[hsl(var(--accent)/.45)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--primary))]">
                مميز
              </span>
            )}
            {listing.saleStatus === 'sold' && (
              <span className="rounded-md bg-[hsl(var(--destructive))] px-2 py-0.5 text-[9px] font-bold text-white">
                تم البيع
              </span>
            )}
          </div>
          <h3 className="listing-card__title text-[15px] font-bold leading-[1.55] text-[hsl(var(--primary))] transition-colors group-hover/title:text-[hsl(var(--accent-foreground))] sm:text-[17px]">
            {listing.title}
          </h3>
        </a>

        <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <strong
            className="font-numeric text-[15px] font-extrabold text-[hsl(var(--primary))] sm:text-[18px]"
            dir="ltr"
          >
            {formatPrice(listing.price, listing.currency)}
          </strong>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            <MapPin size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{listing.location}</span>
          </span>
        </div>

        <div className="listing-card__actions mt-auto pt-3">
          <button
            type="button"
            onClick={() => void shareListing()}
            aria-label="مشاركة الإعلان"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 text-[11px] font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
            data-testid={`button-share-${listing.id}`}
          >
            {shareState === 'copied' ? <Check size={15} /> : <Share2 size={15} />}
            <span className="listing-card__action-label">
              {shareState === 'copied' ? 'تم نسخ الرابط' : 'مشاركة'}
            </span>
          </button>
          <a
            href={listingHref}
            className="mr-auto inline-flex min-h-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-3 text-[11px] font-bold text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
          >
            تفاصيل الإعلان
          </a>
        </div>
      </div>
    </article>
  );
}

export function Responsive() {
  return (
    <main className="listing-showcase min-h-screen px-4 py-7 sm:px-8 sm:py-10" dir="rtl">
      <div className="mx-auto max-w-[1160px]">
        <header className="mb-7 border-b border-[hsl(var(--border))] pb-6 sm:mb-9 sm:pb-8">
          <span className="mb-2 block text-[10px] font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">
            لحريثه · تجربة بطاقة الإعلان
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--primary))] sm:text-3xl">
            تفاصيل أسهل للقراءة، على كل شاشة
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">
            ترتيب أوضح للسعر والموقع والحالة، مع إبقاء الحفظ والمشاركة والوصول إلى الإعلان مباشرة.
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <section aria-labelledby="wide-preview-title" className="min-w-0">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <span className="mb-1 block text-[10px] font-bold text-[hsl(var(--muted-foreground))]">قائمة الإعلانات</span>
                <h2 id="wide-preview-title" className="text-base font-bold text-[hsl(var(--primary))]">
                  عرض أوسع
                </h2>
              </div>
              <span className="hidden rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-[10px] text-[hsl(var(--muted-foreground))] sm:inline-flex">
                مساحة أكبر للعنوان والمعلومات
              </span>
            </div>
            <div className="listing-card-container">
              <ListingCard listing={listings[0]} />
            </div>
            <div className="mt-4 listing-card-container">
              <ListingCard listing={listings[1]} />
            </div>
          </section>

          <section aria-labelledby="mobile-preview-title" className="min-w-0">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <span className="mb-1 block text-[10px] font-bold text-[hsl(var(--muted-foreground))]">390 بكسل</span>
                <h2 id="mobile-preview-title" className="text-base font-bold text-[hsl(var(--primary))]">
                  عرض الهاتف
                </h2>
              </div>
              <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-[10px] font-bold text-[hsl(var(--primary))]">
                ملائم للمس
              </span>
            </div>
            <div className="listing-card-container">
              <ListingCard listing={listings[0]} />
            </div>
            <p className="mt-3 text-[11px] leading-6 text-[hsl(var(--muted-foreground))]">
              تظل الإجراءات ظاهرة وقابلة للمس، وتلتف معلومات السعر والموقع عند الحاجة من دون ضغط النص.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}