import type { ReactNode } from 'react';
import { Logo } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';
import { SITE_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/button';

/** Our own chrome around Authentik's flows — Authentik's hosted page is never shown. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { language, meta } = useLanguage();
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4" dir={meta[language].dir}>
      <div className="mb-8 scale-110 sm:mb-10 sm:scale-125"><Logo /></div>
      <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-3xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]">
        <div className="p-5 pb-7 sm:p-8 sm:pb-10">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-xs leading-6 text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
      {footer}
      <p className="mt-8 text-xs text-muted-foreground font-medium z-10">
        &copy; {new Date().getFullYear()} <bdi dir="ltr">{SITE_NAME}</bdi>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18A13.93 13.93 0 0 1 10.95 24c0-1.45.25-2.86.74-4.18v-5.7H4.34A21.93 21.93 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/** `url` comes from `socialSourceUrl()` — null while the identification stage hasn't loaded yet, or if no social source is configured. */
export function GoogleContinueButton({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => { window.location.href = url; }}
    >
      <GoogleMark />
      {label}
    </Button>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function AuthFieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{message}</p>;
}
