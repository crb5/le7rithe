import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Flag, Loader2 } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { getGetReportQueryKey, useGetReport, useMarkReportRead } from '@workspace/api-client-react';
import { AppShell, EmptyState, PageHeading } from '@/components/marketplace-ui';
import { useLanguage } from '@/lib/language';

export function ReportDetails() {
  const [, params] = useRoute('/reports/:id');
  const { t, formatDate, meta, language } = useLanguage();
  const queryClient = useQueryClient();
  const reportId = params?.id ? Number(params.id) : NaN;
  const query = useGetReport(reportId, {
    query: { queryKey: getGetReportQueryKey(reportId), enabled: Number.isFinite(reportId) },
  });
  const markRead = useMarkReportRead();

  const report = query.data;
  const markedReadFor = useRef<number | null>(null);
  useEffect(() => {
    if (!report || !Number.isFinite(reportId) || markedReadFor.current === reportId) return;
    markedReadFor.current = reportId;
    markRead.mutate({ id: reportId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    });
  }, [markRead, queryClient, report, reportId]);
  return (
    <AppShell>
      <div dir={meta[language].dir} className="mx-auto max-w-3xl">
        <Link href="/notifications" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))] hover:underline">
          <ArrowLeft size={16} /> {t('backToNotifications')}
        </Link>
        <PageHeading eyebrow={t('notifications')} title={t('reportDetailsTitle')} description={t('reportDetailsDescription')} />
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[hsl(var(--primary))]" /></div>
        ) : !report ? (
          <EmptyState icon={Flag} title={t('reportNotFound')} description={t('dataLoadError')} />
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-[hsl(var(--primary))]">{t('yourReport')}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${report.status === 'resolved' ? 'bg-[hsl(155_33%_23%/.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.2)] text-[hsl(35_90%_35%)]'}`}>
                  {report.status === 'resolved' ? t('reportStatusResolved') : t('reportStatusOpen')}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--muted-foreground))]">{report.details}</p>
              <time className="mt-3 flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                <Clock3 size={14} /> {formatDate(report.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            </section>
            {report.replies.length > 0 ? (
              <section className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.1)] p-5">
                <div className="flex items-center gap-2 font-bold text-[hsl(var(--primary))]">
                  <CheckCircle2 size={18} /> {t('adminReply')}
                </div>
                <div className="mt-4 space-y-4">
                  {report.replies.map((reply) => (
                    <div key={reply.id} className="border-b border-[hsl(var(--accent)/.25)] pb-4 last:border-0 last:pb-0">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--foreground))]">{reply.body}</p>
                      <time className="mt-2 block text-[11px] text-[hsl(var(--muted-foreground))]">
                        {formatDate(reply.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </time>
                    </div>
                  ))}
                </div>
              </section>
            ) : report.action ? (
              <section className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.1)] p-5">
                <div className="flex items-center gap-2 font-bold text-[hsl(var(--primary))]">
                  <CheckCircle2 size={18} /> {t('adminReply')}
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--foreground))]">{report.action}</p>
                {report.resolvedAt && <time className="mt-3 block text-[11px] text-[hsl(var(--muted-foreground))]">{formatDate(report.resolvedAt, { dateStyle: 'medium', timeStyle: 'short' })}</time>}
              </section>
            ) : (
              <section className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                {t('awaitingAdminReply')}
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}