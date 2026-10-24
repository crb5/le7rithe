import { useState } from 'react';
import { useAdminPayments, useUpdateListingStatus, useUpdatePaymentStatus } from '@/hooks/use-admin';
import { AdminHeader, AdminBadge, AdminActionDialog, AdminTable, AdminTh, AdminTd, FilterSelect } from '@/components/admin-ui';
import { Check, X } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/lib/language';

export function AdminPayments() {
  const [status, setStatus] = useState('');
  const { t, formatDate, formatNumber, formatMoney } = useLanguage();
  
  const { data, isLoading } = useAdminPayments({ status });
  const updateStatus = useUpdatePaymentStatus();
  const updateListingStatus = useUpdateListingStatus();

  const items = data?.items || [];
  const paymentMethodLabel = (payment: any) => {
    if (payment.method?.name) return payment.method.name;
    const methods: Record<string, string> = {
      bank_transfer: t('paymentMethodBankTransfer'),
      cash: t('paymentMethodCash'),
      mobile_money: t('paymentMethodMobileMoney'),
      card: t('paymentMethodCard'),
    };
    return methods[payment.paymentMethod] || payment.paymentMethod;
  };

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminPaymentsTitle')}
        description={t('adminPaymentsDescription')}
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        <div className="mb-5 flex flex-wrap gap-3 lg:mb-6 lg:gap-4">
          <FilterSelect 
            value={status} 
            onChange={setStatus} 
            options={[
              { label: t('allPayments'), value: '' },
              { label: t('paymentStatusPending'), value: 'pending' },
              { label: t('paymentStatusConfirmed'), value: 'confirmed' },
              { label: t('paymentStatusRejected'), value: 'rejected' },
              { label: t('paymentStatusWithdrawn'), value: 'withdrawn' },
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
                  <AdminTh>{t('paymentTransactionNumber')}</AdminTh>
                  <AdminTh>{t('adminUser')}</AdminTh>
                  <AdminTh>{t('paymentPackageOrService')}</AdminTh>
                  <AdminTh>{t('paymentAmount')}</AdminTh>
                  <AdminTh>{t('paymentMethod')}</AdminTh>
                  <AdminTh>{t('paymentReferenceNumber')}</AdminTh>
                  <AdminTh>{t('adminListingCreatedDate')}</AdminTh>
                  <AdminTh>{t('status')}</AdminTh>
                  <AdminTh>{t('adminActions')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {items.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-[hsl(42_37%_97%)] transition-colors">
                    <AdminTd className="font-numeric text-[11px] text-[hsl(153_12%_43%)]">#{formatNumber(Number(payment.id))}</AdminTd>
                    <AdminTd>
                      <div className="font-bold">{payment.user?.name || t('deletedAccount')}</div>
                      <div className="text-[11px] text-[hsl(153_12%_43%)]">{payment.user?.email || '—'}</div>
                      <div className="text-[11px] text-[hsl(153_12%_43%)] font-numeric" dir="ltr">{payment.user?.phone}</div>
                    </AdminTd>
                    <AdminTd>
                      <div className="font-bold text-[hsl(155_33%_23%)]">{payment.package?.name || t('paymentListingUpgrade')}</div>
                      {payment.listing?.title && <div className="text-[11px] text-[hsl(153_12%_43%)]">{payment.listing.title}</div>}
                      {payment.listingId && payment.listing?.status === 'active' && (
                        <Link href={`/listings/${payment.listingId}`} target="_blank" className="text-[10px] text-[hsl(153_12%_43%)] hover:underline">
                          {t('paymentViewListing', { id: formatNumber(Number(payment.listingId)) })}
                        </Link>
                      )}
                    </AdminTd>
                    <AdminTd>
                      <span className="font-numeric font-extrabold text-[hsl(155_33%_23%)]" dir="ltr">
                        {formatMoney(Number(payment.amount), payment.currency)}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px] font-bold">{paymentMethodLabel(payment)}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-numeric text-[13px] bg-[hsl(42_37%_94%)] px-2 py-1 rounded border border-[hsl(38_22%_86%)]" dir="ltr">
                         {payment.transactionReference || '—'}
                      </span>
                       {payment.accountHolderName && <div className="mt-1 text-[10px]">{payment.accountHolderName}</div>}
                    </AdminTd>
                    <AdminTd>
                        <span className="text-[12px]">{formatDate(payment.listing?.createdAt || payment.createdAt, { dateStyle: 'full', timeStyle: 'short' })}</span>
                        {payment.proofImageUrl && <a href={payment.proofImageUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[10px] text-[hsl(155_33%_23%)] underline" data-testid={`link-payment-proof-${payment.id}`}>{t('viewPaymentProof')}</a>}
                    </AdminTd>
                    <AdminTd>
                      {payment.status === 'confirmed' && <AdminBadge variant="success">{t('paymentStatusConfirmed')}</AdminBadge>}
                      {payment.status === 'pending' && <AdminBadge variant="warning">{t('paymentStatusPending')}</AdminBadge>}
                      {payment.status === 'rejected' && <AdminBadge variant="danger">{t('paymentStatusRejected')}</AdminBadge>}
                      {payment.status === 'withdrawn' && <AdminBadge variant="danger">{t('paymentStatusWithdrawn')}</AdminBadge>}
                    </AdminTd>
                    <AdminTd>
                      {payment.status === 'pending' && (
                        <div className="flex items-center gap-1.5">
                          <AdminActionDialog
                            title={t('adminConfirmPayment')}
                             description={t('adminConfirmPaymentDescription', { amount: formatMoney(Number(payment.amount), payment.currency), method: paymentMethodLabel(payment) })}
                            confirmText={t('adminConfirmReceipt')}
                            trigger={<button data-testid={`button-confirm-payment-${payment.id}`} className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(155_33%_23%)] text-white text-[11px] font-bold rounded-full hover:bg-[hsl(155_33%_18%)] transition-colors"><Check size={14} /> {t('confirm')}</button>}
                            onConfirm={() => updateStatus.mutateAsync({ id: payment.id, status: 'confirmed' })}
                          />
                          <AdminActionDialog
                            title={t('adminRejectPayment')}
                            description={t('adminRejectPaymentDescription')}
                            confirmText={t('adminReject')}
                            confirmVariant="danger"
                            requireReason
                            trigger={<button data-testid={`button-reject-payment-${payment.id}`} className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(4_62%_48%)/0.1] text-[hsl(4_62%_48%)] text-[11px] font-bold rounded-full hover:bg-[hsl(4_62%_48%)/0.2] transition-colors"><X size={14} /> {t('adminReject')}</button>}
                            onConfirm={(reason) => updateStatus.mutateAsync({ id: payment.id, status: 'rejected', reason })}
                          />
                        </div>
                      )}
                      {payment.status === 'confirmed' && payment.listingId && payment.listing?.status !== 'active' && (
                        <AdminActionDialog
                          title={t('adminPublishListing')}
                          description={t('adminPublishListingDescription', { title: payment.listing?.title || '' })}
                          confirmText={t('adminPublishListing')}
                          trigger={<button data-testid={`button-publish-listing-${payment.listingId}`} className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(155_33%_23%)] text-white text-[11px] font-bold rounded-full hover:bg-[hsl(155_33%_18%)] transition-colors"><Check size={14} /> {t('adminPublishListing')}</button>}
                          onConfirm={() => updateListingStatus.mutateAsync({ id: payment.listingId, status: 'active' })}
                        />
                      )}
                      {payment.status === 'rejected' && payment.rejectionReason && (
                        <div className="text-[10px] text-[hsl(4_62%_48%)] max-w-[150px] truncate" title={payment.rejectionReason}>
                          {t('reason')}: {payment.rejectionReason}
                        </div>
                      )}
                    </AdminTd>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                      {t('adminNoPayments')}
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
