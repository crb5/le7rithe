import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '@/lib/language';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const COPY = {
  ar: { title: 'ثبّت تطبيق Le7rithe', body: 'أضِف السوق إلى شاشتك الرئيسية للوصول السريع.', install: 'تثبيت', dismiss: 'لاحقًا' },
  fr: { title: "Installer l'application Le7rithe", body: "Ajoutez le marché à votre écran d'accueil pour un accès rapide.", install: 'Installer', dismiss: 'Plus tard' },
  en: { title: 'Install the Le7rithe app', body: 'Add the marketplace to your home screen for quick access.', install: 'Install', dismiss: 'Later' },
} as const;

const DISMISS_KEY = 'pwa-install-dismissed';

/**
 * Custom "Add to home screen" banner for the PUBLIC app. Hidden on /admin and
 * once already installed or dismissed.
 */
export function PwaInstallPrompt() {
  const { language } = useLanguage();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // ignore storage access errors
    }
    // Already running as an installed app.
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Never surface inside the admin area.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return null;
  if (!visible || !deferred) return null;

  const copy = COPY[language as keyof typeof COPY] ?? COPY.ar;

  const install = async () => {
    setVisible(false);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-[hsl(154_20%_82%)] bg-[hsl(var(--card))] p-4 shadow-[0_12px_40px_hsl(155_20%_18%/.25)] sm:bottom-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
          <Download size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[hsl(var(--foreground))]">{copy.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[hsl(153_12%_43%)]">{copy.body}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90"
              data-testid="button-pwa-install"
            >
              {copy.install}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl px-3 py-2 text-xs font-bold text-[hsl(153_12%_43%)] hover:bg-[hsl(var(--secondary))]"
            >
              {copy.dismiss}
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label={copy.dismiss} className="shrink-0 text-[hsl(153_12%_43%)] hover:text-[hsl(var(--foreground))]">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
