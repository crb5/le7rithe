import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';

type SellerReviewsData = {
  average: number;
  total: number;
  items: {
    id: number;
    rating: number;
    comment: string;
    createdAt: string;
    reviewer: { name: string; initials: string };
  }[];
};

const COPY = {
  ar: { title: 'تقييمات البائع', none: 'لا توجد تقييمات بعد.', add: 'أضف تقييمك', send: 'إرسال التقييم', placeholder: 'شارك تجربتك مع هذا البائع (اختياري)', count: (n: number) => `${n} تقييم`, signin: 'سجّل الدخول لإضافة تقييم.' },
  fr: { title: 'Avis sur le vendeur', none: 'Aucun avis pour le moment.', add: 'Ajoutez votre avis', send: "Envoyer l'avis", placeholder: 'Partagez votre expérience (facultatif)', count: (n: number) => `${n} avis`, signin: 'Connectez-vous pour laisser un avis.' },
  en: { title: 'Seller reviews', none: 'No reviews yet.', add: 'Add your review', send: 'Submit review', placeholder: 'Share your experience (optional)', count: (n: number) => `${n} reviews`, signin: 'Sign in to leave a review.' },
} as const;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-[#f2c14e] text-[#f2c14e]' : 'text-[hsl(154_12%_70%)]'} />
      ))}
    </span>
  );
}

export function SellerReviews({ sellerId, sellerSelf = false }: { sellerId: number; sellerSelf?: boolean }) {
  const { isSignedIn, getToken } = useAuth();
  const { language } = useLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.ar;
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const queryKey = ['seller-reviews', sellerId] as const;

  const { data } = useQuery<SellerReviewsData>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/sellers/${sellerId}/reviews`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch(`/api/sellers/${sellerId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      setComment('');
      setRating(0);
      void qc.invalidateQueries({ queryKey });
    },
  });

  return (
    <section className="mt-6 rounded-2xl border border-[hsl(154_20%_82%)] bg-[hsl(var(--card))] p-5" aria-labelledby="seller-reviews-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="seller-reviews-title" className="text-base font-bold text-[hsl(155_33%_23%)]">{copy.title}</h2>
        {data && data.total > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Stars value={data.average} />
            <span className="font-bold text-[hsl(155_33%_23%)]">{data.average.toFixed(1)}</span>
            <span className="text-[hsl(153_12%_43%)]">({copy.count(data.total)})</span>
          </div>
        )}
      </div>

      {data && data.items.length === 0 && (
        <p className="text-sm text-[hsl(153_12%_43%)]">{copy.none}</p>
      )}

      <ul className="space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-xl border border-[hsl(154_20%_88%)] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(155_33%_23%)]">{r.reviewer.initials}</span>
              <span className="text-sm font-bold text-[hsl(var(--foreground))]">{r.reviewer.name}</span>
              <Stars value={r.rating} size={13} />
            </div>
            {r.comment && <p className="text-sm leading-6 text-[hsl(153_12%_43%)]">{r.comment}</p>}
          </li>
        ))}
      </ul>

      {!sellerSelf && (
        isSignedIn ? (
          <form
            className="mt-5 border-t border-[hsl(154_20%_88%)] pt-4"
            onSubmit={(e) => { e.preventDefault(); if (rating >= 1) submit.mutate(); }}
          >
            <p className="mb-2 text-sm font-bold text-[hsl(155_33%_23%)]">{copy.add}</p>
            <div className="mb-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}`} className="p-0.5">
                  <Star size={24} className={n <= rating ? 'fill-[#f2c14e] text-[#f2c14e]' : 'text-[hsl(154_12%_70%)]'} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={copy.placeholder}
              rows={3}
              className="w-full rounded-xl border border-[hsl(38_22%_86%)] bg-white px-3 py-2 text-sm outline-none focus:border-[hsl(155_33%_23%)]"
            />
            <button
              type="submit"
              disabled={rating < 1 || submit.isPending}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-60"
            >
              {submit.isPending && <LoaderCircle size={14} className="animate-spin" />}{copy.send}
            </button>
          </form>
        ) : (
          <p className="mt-5 border-t border-[hsl(154_20%_88%)] pt-4 text-sm text-[hsl(153_12%_43%)]">{copy.signin}</p>
        )
      )}
    </section>
  );
}
