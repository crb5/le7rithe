import { useState } from 'react';
import { useAdminAuditLogs } from '@/hooks/use-admin';
import { AdminHeader, AdminTable, AdminTh, AdminTd, FilterInput, Pagination } from '@/components/admin-ui';
import { useLanguage } from '@/lib/language';
import { getAdminActionTranslationKey, getAdminResourceTranslationKey } from '@/lib/admin-activity';
import { Activity } from 'lucide-react';

export function AdminAuditLogs() {
  const { data, isLoading } = useAdminAuditLogs();
  const { t, formatDate, formatNumber } = useLanguage();
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const items = data?.items || [];
  const resourceTypes = [...new Set(items.map((item: any) => item.resourceType))].sort();
  const actions = [...new Set(items.map((item: any) => item.action))].sort();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredItems = items.filter((log: any) => {
    if (resourceFilter && log.resourceType !== resourceFilter) return false;
    if (actionFilter && log.action !== actionFilter) return false;
    if (!normalizedSearch) return true;
    const searchableText = [
      log.action,
      log.resourceType,
      log.resourceId,
      log.actorClerkUserId,
      JSON.stringify(log.details ?? {}),
    ].join(' ').toLocaleLowerCase();
    return searchableText.includes(normalizedSearch);
  });
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const actionLabel = (action: string) => {
    const key = getAdminActionTranslationKey(action);
    return key ? t(key as Parameters<typeof t>[0]) : action;
  };
  const resourceLabel = (resourceType: string) => {
    const key = getAdminResourceTranslationKey(resourceType);
    return key ? t(key as Parameters<typeof t>[0]) : resourceType;
  };

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminAuditLogsTitle')}
        description={t('adminAuditLogsDescription')}
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-pulse w-full h-64 bg-white rounded-xl"></div></div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="text-xs leading-5 text-[hsl(153_12%_43%)]">{t('auditLogsWindowNote')}</p>
            <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[hsl(38_22%_86%)] bg-white p-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="audit-search" className="mb-1 block text-xs font-bold text-[hsl(153_12%_43%)]">{t('search')}</label>
                <FilterInput id="audit-search" value={search} onChange={(value) => setFilter(setSearch, value)} placeholder={t('auditSearchPlaceholder')} />
              </div>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[hsl(153_12%_43%)]">
                {t('auditResource')}
                <select value={resourceFilter} onChange={(event) => setFilter(setResourceFilter, event.target.value)} className="min-h-11 min-w-[150px] rounded-xl border border-[hsl(38_22%_86%)] bg-white px-3 text-sm font-medium text-[hsl(154_26%_15%)]">
                  <option value="">{t('auditAllResources')}</option>
                  {resourceTypes.map((resourceType: string) => <option key={resourceType} value={resourceType}>{resourceLabel(resourceType)}</option>)}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[hsl(153_12%_43%)]">
                {t('auditActionType')}
                <select value={actionFilter} onChange={(event) => setFilter(setActionFilter, event.target.value)} className="min-h-11 min-w-[170px] rounded-xl border border-[hsl(38_22%_86%)] bg-white px-3 text-sm font-medium text-[hsl(154_26%_15%)]">
                  <option value="">{t('auditAllActions')}</option>
                  {actions.map((action: string) => <option key={action} value={action}>{actionLabel(action)}</option>)}
                </select>
              </label>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <AdminTable>
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <AdminTh>{t('adminIdentifier')}</AdminTh>
                  <AdminTh>{t('auditActionType')}</AdminTh>
                  <AdminTh>{t('auditResource')}</AdminTh>
                  <AdminTh>{t('auditResourceIdentifier')}</AdminTh>
                  <AdminTh>{t('auditAdministratorIdentifier')}</AdminTh>
                  <AdminTh>{t('auditDetails')}</AdminTh>
                  <AdminTh>{t('paymentDate')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[hsl(42_37%_97%)] transition-colors">
                    <AdminTd className="font-numeric text-[11px] text-[hsl(153_12%_43%)]">#{formatNumber(Number(log.id))}</AdminTd>
                    <AdminTd>
                      <div className="flex items-center gap-2 font-bold text-[hsl(155_33%_23%)] text-xs">
                        <Activity size={14} className="text-[hsl(42_87%_61%)]" />
                        {actionLabel(log.action)}
                      </div>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[11px] font-bold text-[hsl(153_12%_43%)] uppercase tracking-wider font-numeric">
                        {resourceLabel(log.resourceType)}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-numeric" dir="ltr">{log.resourceId ? formatNumber(Number(log.resourceId)) : t('notAvailable')}</span>
                    </AdminTd>
                    <AdminTd>
                      <div className="text-[11px] truncate max-w-[120px]" title={log.actorClerkUserId || t('system')}>
                        {log.actorClerkUserId || t('system')}
                      </div>
                    </AdminTd>
                    <AdminTd>
                      {log.details ? (
                        <details className="max-w-[300px] text-[10px] font-mono">
                          <summary className="cursor-pointer rounded border border-[hsl(38_22%_86%)] bg-[hsl(42_37%_94%)] p-1.5">{t('auditDetails')}</summary>
                          <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded border border-[hsl(38_22%_86%)] bg-[hsl(42_37%_94%)] p-2" dir="ltr">{JSON.stringify(log.details, null, 2)}</pre>
                        </details>
                      ) : <span className="text-[10px] text-[hsl(153_12%_43%)]">{t('auditNoDetails')}</span>}
                    </AdminTd>
                    <AdminTd>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[12px]">{formatDate(log.createdAt, { dateStyle: 'medium' })}</span>
                        <span className="text-[10px] text-[hsl(153_12%_43%)] font-numeric" dir="ltr">{formatDate(log.createdAt, { timeStyle: 'short' })}</span>
                      </div>
                    </AdminTd>
                  </tr>
                ))}
                {visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                      {items.length === 0 ? t('auditLogsEmpty') : t('auditNoMatchingResults')}
                    </td>
                  </tr>
                )}
              </tbody>
              </AdminTable>
            </div>
            <Pagination page={page} limit={pageSize} total={filteredItems.length} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
