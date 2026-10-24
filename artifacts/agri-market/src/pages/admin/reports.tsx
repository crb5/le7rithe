import { useEffect } from 'react';
import { useAdminReports, useResolveReport } from '@/hooks/use-admin';
import { AdminHeader, AdminBadge, AdminActionDialog, AdminTable, AdminTh, AdminTd } from '@/components/admin-ui';
import { useLanguage } from '@/lib/language';
import { Link, useLocation } from 'wouter';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react';

export function AdminReports() {
  const [location] = useLocation();
  const { data, isLoading } = useAdminReports();
  const resolveReport = useResolveReport();
  const { t, formatDate, formatNumber } = useLanguage();

  const items = data?.items || [];
  const reportIdParam = new URLSearchParams(location.split('?')[1] || '').get('reportId');
  const targetReportId = reportIdParam ? Number(reportIdParam) : null;

  useEffect(() => {
    if (isLoading || !targetReportId) return;
    document.getElementById(`admin-report-${targetReportId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isLoading, targetReportId]);
  const reportReasonLabels: Record<string, string> = {
    support: t('supportRequest'),
    spam: t('reportReasonSpam'),
    inappropriate: t('reportReasonInappropriate'),
    fraud: t('reportReasonFraud'),
    misleading: t('reportReasonMisleading'),
    other: t('reportReasonOther'),
  };

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminReportsTitle')}
        description={t('adminReportsDescription')}
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-pulse w-full h-64 bg-white rounded-xl"></div></div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <AdminTable>
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <AdminTh>{t('adminIdentifier')}</AdminTh>
                  <AdminTh>{t('reporter')}</AdminTh>
                  <AdminTh>{t('reportSubject')}</AdminTh>
                  <AdminTh>{t('reportText')}</AdminTh>
                  <AdminTh>{t('paymentDate')}</AdminTh>
                  <AdminTh>{t('status')}</AdminTh>
                  <AdminTh>{t('actionTaken')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {items.map((report: any) => (
                  <tr
                    key={report.id}
                    id={`admin-report-${report.id}`}
                    className={`hover:bg-[hsl(42_37%_97%)] transition-colors ${targetReportId === Number(report.id) ? 'bg-[hsl(42_87%_61%)/.16] outline outline-2 outline-[hsl(42_87%_61%)]' : ''}`}
                  >
                    <AdminTd className="font-numeric text-[11px] text-[hsl(153_12%_43%)]">#{formatNumber(Number(report.id))}</AdminTd>
                    <AdminTd>
                       <div className="font-bold text-[hsl(155_33%_23%)]">{report.reporter?.name || t('unknownUser')}</div>
                       <div className="mt-1 text-[11px] text-[hsl(153_12%_43%)]" dir="ltr">{report.reporter?.phone || report.reporter?.email || t('notAvailable')}</div>
                    </AdminTd>
                    <AdminTd>
                      <div className="font-bold flex items-center gap-2">
                        <MessageSquareWarning size={14} className="text-[hsl(35_90%_45%)]" />
                        {reportReasonLabels[report.reason] || report.reason}
                      </div>
                      {report.listing && (
                        <Link href={`/listings/${report.listing.id}`} target="_blank" className="text-[11px] text-[hsl(153_12%_43%)] hover:underline mt-1 block">
                          {t('adminListing')}: {report.listing.title}
                        </Link>
                      )}
                    </AdminTd>
                    <AdminTd>
                      <div className="max-w-[300px] whitespace-normal text-sm leading-relaxed text-[hsl(154_26%_15%)]">
                         {report.details || t('notAvailable')}
                      </div>
                       {report.contactRequested && <div className="mt-2 inline-flex rounded-md bg-[hsl(42_87%_61%)/.2] px-2 py-1 text-[10px] font-bold text-[hsl(35_90%_35%)]">{t('contactRequested')}</div>}
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px]">{formatDate(report.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </AdminTd>
                    <AdminTd>
                      {report.status === 'open' ? <AdminBadge variant="warning">{t('reportStatusOpen')}</AdminBadge> : <AdminBadge variant="success">{t('reportStatusResolved')}</AdminBadge>}
                    </AdminTd>
                    <AdminTd>
                      <div className="space-y-2">
                        {report.action && (
                          <div className="flex items-start gap-1.5 text-xs text-[hsl(153_12%_43%)] max-w-[220px]" title={report.action}>
                            <CheckCircle2 size={14} className="mt-0.5 text-[hsl(155_33%_23%)] shrink-0" />
                            <span className="whitespace-normal">{report.action}</span>
                          </div>
                        )}
                        <AdminActionDialog
                          title={t('replyToReport')}
                          description={t('replyToReportDescription')}
                          confirmText={t('sendReportReply')}
                          requireReason
                          trigger={<button className="px-3 py-1.5 bg-[hsl(155_33%_23%)] text-white text-[11px] font-bold rounded-full hover:bg-[hsl(155_33%_18%)] transition-colors">{report.action ? t('replyAgain') : t('replyAndClose')}</button>}
                          onConfirm={(action) => resolveReport.mutateAsync({ id: report.id, status: 'resolved', action })}
                        />
                      </div>
                    </AdminTd>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                      {t('noReports')}
                    </td>
                  </tr>
                )}
              </tbody>
            </AdminTable>
          </div>
        )}
      </div>
    </div>
  );
}
