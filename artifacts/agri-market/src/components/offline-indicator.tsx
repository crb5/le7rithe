import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '@/lib/language';

const COPY = {
  ar: 'أنت غير متصل بالإنترنت — بعض الميزات قد لا تعمل.',
  fr: 'Vous êtes hors ligne — certaines fonctions peuvent être indisponibles.',
  en: "You're offline — some features may be unavailable.",
} as const;

/** Small banner shown while the browser is offline (pairs with the PWA cache). */
export function OfflineIndicator() {
  const { language } = useLanguage();
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  const text = COPY[language as keyof typeof COPY] ?? COPY.ar;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-[hsl(4_62%_48%)] px-3 py-2 text-center text-xs font-bold text-white"
      data-testid="offline-indicator"
    >
      <WifiOff size={14} />
      {text}
    </div>
  );
}
