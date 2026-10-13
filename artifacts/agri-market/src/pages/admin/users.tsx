import { useState } from 'react';
import { useAdminUsers, useUpdateUserStatus, useUpdateUserVerification } from '@/hooks/use-admin';
import { AdminHeader, AdminBadge, AdminActionDialog, AdminTable, AdminTh, AdminTd, FilterInput, FilterSelect } from '@/components/admin-ui';
import { BadgeCheck, Shield, ShieldBan, UserCog } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { VerifiedBadge } from '@/components/verified-badge';

export function AdminUsers() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { t, formatDate, formatNumber } = useLanguage();
  
  const { data, isLoading } = useAdminUsers({ q, status });
  const updateStatus = useUpdateUserStatus();
  const updateVerification = useUpdateUserVerification();

  const items = data?.items || [];

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminUsersTitle')}
        description={t('adminUsersDescription')}
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:mb-6">
          <FilterInput value={q} onChange={setQ} placeholder={t('adminUsersSearchPlaceholder')} />
          <FilterSelect 
            value={status} 
            onChange={setStatus} 
            options={[
              { label: t('allStatuses'), value: '' },
              { label: t('userStatusActive'), value: 'active' },
              { label: t('userStatusSuspended'), value: 'suspended' },
            ]} 
          />
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-pulse w-full h-64 bg-white rounded-xl"></div></div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <AdminTable>
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <AdminTh>{t('adminIdentifier')}</AdminTh>
                  <AdminTh>{t('adminUser')}</AdminTh>
                  <AdminTh>{t('phoneNumber')}</AdminTh>
                  <AdminTh>{t('adminRole')}</AdminTh>
                  <AdminTh>{t('adminListingCount')}</AdminTh>
                  <AdminTh>{t('adminRegistrationDate')}</AdminTh>
                  <AdminTh>{t('status')}</AdminTh>
                  <AdminTh>{t('adminActions')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {items.map((user: any) => (
                  <tr key={user.id} className="hover:bg-[hsl(42_37%_97%)] transition-colors">
                    <AdminTd className="font-numeric text-[11px] text-[hsl(153_12%_43%)]">#{formatNumber(Number(user.id))}</AdminTd>
                    <AdminTd>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[hsl(155_33%_23%)/0.1] text-[hsl(155_33%_23%)] flex items-center justify-center font-bold text-lg shrink-0">
                          {user.name ? user.name.charAt(0) : t('adminUnknownUserInitial')}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-[hsl(155_33%_23%)]">{user.name || t('unknownUser')}</span>
                            {user.verified && <VerifiedBadge testId={`badge-verified-user-${user.id}`} />}
                          </div>
                        </div>
                      </div>
                    </AdminTd>
                    <AdminTd>
                      <div className="font-numeric" dir="ltr">{user.phone || '—'}</div>
                    </AdminTd>
                    <AdminTd>
                      {user.role === 'admin' ? (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[hsl(202_89%_45%)] bg-[hsl(202_89%_53%)/0.15] px-2 py-1 rounded-md w-fit">
                          <UserCog size={13} /> {t('userRoleAdmin')}
                        </span>
                      ) : user.role === 'moderator' ? (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[hsl(155_33%_23%)] bg-[hsl(155_33%_23%)/0.1] px-2 py-1 rounded-md w-fit">
                          <Shield size={13} /> {t('userRoleModerator')}
                        </span>
                      ) : (
                          <span className="text-[12px] text-[hsl(153_12%_43%)]">{t('userRoleSeller')}</span>
                      )}
                    </AdminTd>
                    <AdminTd>
                        <span className="font-numeric font-bold">{formatNumber(Number(user.listingCount || 0))}</span>
                    </AdminTd>
                    <AdminTd>
                        <span className="text-[12px]">{formatDate(user.createdAt, { dateStyle: 'medium' })}</span>
                    </AdminTd>
                    <AdminTd>
                      {user.status === 'active' ? <AdminBadge variant="success">{t('userStatusActive')}</AdminBadge> : <AdminBadge variant="danger">{t('userStatusSuspended')}</AdminBadge>}
                    </AdminTd>
                    <AdminTd>
                      {user.role !== 'admin' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {user.status === 'active' ? (
                            <AdminActionDialog
                              title={t('adminSuspendUser')}
                              description={t('adminSuspendUserDescription', { name: user.name || t('unknownUser') })}
                              confirmText={t('adminSuspend')}
                              confirmVariant="danger"
                              trigger={<button className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(4_62%_48%)/0.1] text-[hsl(4_62%_48%)] text-[11px] font-bold rounded-lg hover:bg-[hsl(4_62%_48%)/0.2] transition-colors"><ShieldBan size={14} /> {t('adminSuspend')}</button>}
                              onConfirm={() => updateStatus.mutateAsync({ id: user.id, status: 'suspended' })}
                            />
                          ) : (
                            <AdminActionDialog
                              title={t('adminActivateUser')}
                              description={t('adminActivateUserDescription', { name: user.name || t('unknownUser') })}
                              confirmText={t('adminActivate')}
                              trigger={<button className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(155_33%_23%)/0.1] text-[hsl(155_33%_23%)] text-[11px] font-bold rounded-lg hover:bg-[hsl(155_33%_23%)/0.2] transition-colors"><Shield size={14} /> {t('adminActivate')}</button>}
                              onConfirm={() => updateStatus.mutateAsync({ id: user.id, status: 'active' })}
                            />
                          )}
                          <AdminActionDialog
                            title={user.verified ? t('adminUnverifyUser') : t('adminVerifyUser')}
                            description={user.verified
                              ? t('adminUnverifyUserDescription', { name: user.name || t('unknownUser') })
                              : t('adminVerifyUserDescription', { name: user.name || t('unknownUser') })}
                            confirmText={user.verified ? t('adminUnverifyUser') : t('adminVerifyUser')}
                            trigger={(
                              <button
                                type="button"
                                disabled={updateVerification.isPending}
                                className="flex items-center gap-1.5 rounded-lg bg-[hsl(155_33%_23%)/0.1] px-3 py-1.5 text-[11px] font-bold text-[hsl(155_33%_23%)] transition-colors hover:bg-[hsl(155_33%_23%)/0.2] disabled:opacity-50"
                                data-testid={`button-user-verification-${user.id}`}
                              >
                                <BadgeCheck size={14} />
                                {user.verified ? t('adminUnverifyUser') : t('adminVerifyUser')}
                              </button>
                            )}
                            onConfirm={() => updateVerification.mutateAsync({ id: user.id, verified: !user.verified })}
                          />
                        </div>
                      )}
                    </AdminTd>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                      {t('adminNoUsersFound')}
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
