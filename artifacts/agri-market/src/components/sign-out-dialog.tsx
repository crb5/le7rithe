import { Loader2, LogOut, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/language';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

export function SignOutDialog({
  open,
  isLoading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  useBodyScrollLock(open, dialogRef);

  useEffect(() => {
    if (open) {
      previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      cancelButtonRef.current?.focus();
      return;
    }

    previouslyFocusedElementRef.current?.focus();
    previouslyFocusedElementRef.current = null;
  }, [open]);

  if (!open) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[hsl(var(--primary)/.48)] p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) onCancel(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-dialog-title"
        aria-describedby="sign-out-dialog-description"
        className="mobile-modal-panel w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--foreground))] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (!isLoading) onCancel();
            return;
          }

          if (event.key !== 'Tab') return;

          const focusableElements = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
          );
          if (focusableElements.length === 0) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]">
              <LogOut size={19} />
            </span>
            <h2 id="sign-out-dialog-title" className="text-base font-bold text-[hsl(var(--primary))]">{t('confirmSignOutTitle')}</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={isLoading} className="rounded-full p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--secondary))] disabled:opacity-50" aria-label={t('cancel')} data-testid="button-cancel-sign-out">
            <X size={18} />
          </button>
        </div>
        <p id="sign-out-dialog-description" className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{t('confirmSignOutDescription')}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={isLoading} className="rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--secondary))] disabled:opacity-50" data-testid="button-cancel-sign-out-secondary">
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--destructive))] px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-confirm-sign-out">
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            {t('confirmSignOut')}
          </button>
        </div>
      </section>
    </div>
  );
}