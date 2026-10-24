import { useState } from 'react';
import { useAdminPaymentMethods, useCreatePaymentMethod, useUpdatePaymentMethod, useDeletePaymentMethod } from '@/hooks/use-admin';
import { AdminHeader, AdminBadge, AdminActionDialog } from '@/components/admin-ui';
import { Plus, Edit, Trash2 } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';

function MethodForm({ methodData, onSave, onCancel }: { methodData?: any, onSave: (data: any) => Promise<void>, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: methodData?.name || '',
    accountName: methodData?.accountName || '',
    accountNumber: methodData?.accountNumber || '',
    instructions: methodData?.instructions || '',
    active: methodData ? methodData.active : true,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t, language, meta } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ ...formData, currency: 'MRU' });
      onCancel();
    } catch (err: any) {
      toast({ title: t('error'), description: err instanceof Error ? err.message : t('error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={meta[language].dir}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('paymentMethodDisplayName')}</label>
          <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)]" placeholder={t('paymentMethodNamePlaceholder')} />
        </div>
        <div>
          <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('currency')}</label>
          <div className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm font-numeric" dir="ltr" data-testid="payment-method-currency">MRU</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('accountHolderName')}</label>
          <input required value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('accountNumber')}</label>
          <input required value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)]" dir="ltr" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('paymentInstructions')}</label>
        <textarea value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)] min-h-[80px]" placeholder={t('paymentInstructionsPlaceholder')} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="rounded border-[hsl(38_22%_86%)] text-[hsl(155_33%_23%)] focus:ring-[hsl(155_33%_23%)]" />
        <span className="text-sm font-bold text-[hsl(154_26%_15%)]">{t('paymentMethodActive')}</span>
      </label>
      <div className="flex gap-3 justify-end pt-4 border-t border-[hsl(38_22%_86%)]">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-full border border-[hsl(38_22%_86%)] text-sm font-bold text-[hsl(153_12%_43%)] hover:bg-[hsl(42_37%_97%)]">{t('cancel')}</button>
        <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[hsl(155_33%_23%)] text-white text-sm font-bold rounded-full hover:bg-[hsl(155_33%_18%)] disabled:opacity-50">{t('save')}</button>
      </div>
    </form>
  );
}

export function AdminPaymentMethods() {
  const { data, isLoading } = useAdminPaymentMethods();
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  
  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const { t, language, meta } = useLanguage();

  const items = data?.items || [];
  const currencyLabel = (currency: string) => currency === 'MRU' ? 'MRU' : currency;

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminPaymentMethodsTitle')}
        description={t('adminPaymentMethodsDescription')}
        action={
          <button 
            onClick={() => setIsNew(true)}
            className="flex items-center gap-2 bg-[hsl(42_87%_61%)] text-[hsl(155_33%_23%)] px-4 py-2.5 rounded-xl text-sm font-bold hover:-translate-y-0.5 transition-transform shadow-sm"
          >
            <Plus size={18} /> {t('adminNewPaymentMethod')}
          </button>
        }
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        <DialogPrimitive.Root open={isNew || !!editing} onOpenChange={(open) => { if (!open) { setIsNew(false); setEditing(null); } }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
            <DialogPrimitive.Content className="admin-text-flow fixed left-[50%] top-[50%] z-50 max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-xl translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6" dir={meta[language].dir}>
              <DialogPrimitive.Title className="text-xl font-bold text-[hsl(155_33%_23%)] mb-6">
                {isNew ? t('adminAddPaymentMethod') : t('adminEditPaymentMethod')}
              </DialogPrimitive.Title>
              <MethodForm 
                methodData={editing}
                onSave={async (data) => {
                  if (isNew) {
                    await createMethod.mutateAsync(data);
                  } else {
                    await updateMethod.mutateAsync({ id: editing.id, ...data });
                  }
                }}
                onCancel={() => { setIsNew(false); setEditing(null); }}
              />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-pulse w-full h-64 bg-white rounded-xl"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((method: any) => (
              <div key={method.id} className={`bg-white border ${method.active ? 'border-[hsl(38_22%_86%)] shadow-sm' : 'border-dashed border-[hsl(38_22%_86%)] opacity-70'} rounded-2xl overflow-hidden flex flex-col`}>
                <div className="p-5 border-b border-[hsl(38_22%_86%)] flex justify-between items-center bg-[hsl(42_37%_97%)]">
                  <div>
                    <h3 className="text-lg font-bold text-[hsl(155_33%_23%)]">{method.name}</h3>
                    <p className="text-xs text-[hsl(153_12%_43%)] mt-1 font-numeric">{currencyLabel(method.currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.active && <AdminBadge variant="neutral">{t('disabled')}</AdminBadge>}
                    <button aria-label={t('editPaymentMethod')} onClick={() => setEditing(method)} className="p-2 text-[hsl(153_12%_43%)] hover:bg-[hsl(38_22%_86%)] rounded-lg transition-colors"><Edit size={16} /></button>
                    <AdminActionDialog
                      title={t('deletePaymentMethod')}
                      description={t('deletePaymentMethodConfirm', { name: method.name })}
                      confirmText={t('delete')}
                      confirmVariant="danger"
                      trigger={
                        <button aria-label={t('deletePaymentMethod')} className="p-2 text-[hsl(4_62%_48%)] hover:bg-[hsl(4_62%_48%)/0.1] rounded-full transition-colors"><Trash2 size={16} /></button>
                      }
                      onConfirm={() => deleteMethod.mutateAsync(method.id)}
                    />
                  </div>
                </div>
                
                <div className="p-5 flex-1">
                  <div className="space-y-3 mb-5 text-sm">
                    <div className="flex justify-between py-2 border-b border-dashed border-[hsl(38_22%_86%)]"><span className="text-[hsl(153_12%_43%)] font-bold">{t('accountHolderName')}</span><span className="font-bold">{method.accountName}</span></div>
                    <div className="flex justify-between py-2 border-b border-dashed border-[hsl(38_22%_86%)]"><span className="text-[hsl(153_12%_43%)] font-bold">{t('accountNumber')}</span><span className="font-numeric font-bold" dir="ltr">{method.accountNumber}</span></div>
                  </div>
                  
                  {method.instructions && (
                    <div className="bg-[hsl(42_87%_61%)/0.05] border border-[hsl(42_87%_61%)/0.2] p-4 rounded-xl">
                      <h4 className="text-[10px] font-bold text-[hsl(35_90%_45%)] uppercase tracking-wider mb-2">{t('paymentInstructionsShownToUser')}</h4>
                      <p className="text-xs text-[hsl(154_26%_15%)] leading-relaxed whitespace-pre-wrap">{method.instructions}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                {t('noPaymentMethods')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
