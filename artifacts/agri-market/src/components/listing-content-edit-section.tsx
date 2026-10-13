import React, { type ReactNode } from 'react';
import { EDIT_WINDOW_MINUTES, formatEditWindowRemaining, getListingContentEditWindow } from '@workspace/api-zod/listing-edit-window';
import { useLanguage } from '@/lib/language';

export function ListingContentEditSection({ publishedAt, now, children }: {
  publishedAt: string;
  now: number;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const window = getListingContentEditWindow(publishedAt, now);
  if (!window.editable) return <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]" data-testid="content-edit-window-closed">
    {t('contentEditWindowClosed', { minutes: EDIT_WINDOW_MINUTES })}
  </p>;
  return <div className="mt-4 space-y-4" data-testid="listing-content-edit-window">
    <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('contentEditWindow', { minutes: EDIT_WINDOW_MINUTES })}</p>
    <p role="timer" className="text-xs text-[hsl(var(--muted-foreground))]" data-testid="content-edit-countdown">
      {t('contentEditRemaining', { remaining: formatEditWindowRemaining(window.remainingMs) })}
    </p>
    {children}
  </div>;
}
