import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, CircleAlert } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/language';

export default function NotFound() {
  const { language, meta, t } = useLanguage();
  return (
    <div dir={meta[language].dir} className="grain flex min-h-[100dvh] w-full items-center justify-center bg-[hsl(var(--background))] px-4">
      <Card className="w-full max-w-md border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-3">
            <CircleAlert className="h-8 w-8 text-[hsl(var(--accent-foreground))]" />
            <h1 className="text-2xl font-bold text-[hsl(var(--primary))]">
              {t('pageNotFound')}
            </h1>
          </div>
          <p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
            {t('pageNotFoundDescription')}
          </p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-not-found-home">{t('backToMarket')} {language === 'ar' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}</Link>
        </CardContent>
      </Card>
    </div>
  );
}
