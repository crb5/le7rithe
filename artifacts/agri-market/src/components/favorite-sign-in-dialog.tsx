import { Bookmark, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useLanguage } from '@/lib/language';
import { favoriteSignInRequiredEvent } from '@/lib/use-favorites';

type FavoriteSignInRequest = { redirectPath: string };

export function FavoriteSignInDialog() {
  const [request, setRequest] = useState<FavoriteSignInRequest | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [, navigate] = useLocation();
  const { language, meta, t } = useLanguage();
  const isOpen = request !== null;

  useBodyScrollLock(isOpen, dialogRef);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<FavoriteSignInRequest>).detail;
      if (detail && typeof detail.redirectPath === 'string') {
        setRequest(detail);
      }
    };
    window.addEventListener(favoriteSignInRequiredEvent, handleRequest);
    return () => window.removeEventListener(favoriteSignInRequiredEvent, handleRequest);
  }, []);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      cancelButtonRef.current?.focus();
      return;
    }

    previouslyFocusedElementRef.current?.focus();
    previouslyFocusedElementRef.current = null;
  }, [isOpen]);

  if (!request) return null;

  const close = () => setRequest(null);
  const continueToSignIn = () => {
    const { redirectPath } = request;
    setRequest(null);
    navigate(`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`);
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[hsl(var(--primary)/.48)] p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <section
        dir={meta[language].dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-sign-in-title"
        aria-describedby="favorite-sign-in-description"
        className="mobile-modal-panel w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--foreground))] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }

          if (event.key !== 'Tab') return;
          const focusableElements = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          if (!firstElement || !lastElement) return;
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.2)] text-[hsl(var(--primary))]">
              <Bookmark size={19} />
            </span>
            <h2 id="favorite-sign-in-title" className="text-base font-bold text-[hsl(var(--primary))]">
              {t('favoriteSignInTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--secondary))]"
            aria-label={t('cancel')}
            data-testid="button-close-favorite-sign-in"
          >
            <X size={18} />
          </button>
        </div>
        <p id="favorite-sign-in-description" className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          {t('favoriteSignInDescription')}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={close}
            className="rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--secondary))]"
            data-testid="button-cancel-favorite-sign-in"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={continueToSignIn}
            className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110"
            data-testid="button-confirm-favorite-sign-in"
          >
            {t('continueToSignIn')}
          </button>
        </div>
      </section>
    </div>
  );
}
