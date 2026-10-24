import { useState } from 'react';
import { useAdminPackages, useCreatePackage, useUpdatePackage, useDeletePackage } from '@/hooks/use-admin';
import { AdminHeader, AdminBadge, AdminActionDialog } from '@/components/admin-ui';
import { Plus, Edit, Trash2, Check } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';

function parseFeaturesInput(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.some((feature) => typeof feature !== 'string')) {
      throw new Error('features');
    }
    return parsed.map((feature) => feature.trim()).filter(Boolean);
  }

  return trimmed
    .split(/\r?\n|[,،؛;]/)
    .map((feature) => feature.trim())
    .filter(Boolean);
}

function PackageForm({ packageData, onSave, onCancel }: { packageData?: any, onSave: (data: any) => Promise<void>, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: packageData?.name || '',
    price: packageData?.price || '',
    durationDays: packageData?.durationDays || 30,
    features: packageData?.features ? JSON.stringify(packageData.features) : '[]',
    active: packageData ? packageData.active : true,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t, language, meta } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let parsedFeatures = [];
      try {
        parsedFeatures = parseFeaturesInput(formData.features);
      } catch (err) {
        throw new Error(t('packageJsonError'));
      }
      
      await onSave({
        ...formData,
        price: Number(formData.price),
        durationDays: Number(formData.durationDays),
        features: parsedFeatures
      });
      onCancel();
    } catch (err: any) {
      toast({ title: t('error'), description: err instanceof Error ? err.message : t('error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir={meta[language].dir}>
      <div>
        <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('packageName')}</label>
        <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)]" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('packagePrice', { currency: t('currencyMRU') })}</label>
          <input type="number" required min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)]" dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('packageDurationDays')}</label>
          <input type="number" required min="1" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)]" dir="ltr" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-[hsl(154_26%_15%)] mb-1.5">{t('packageFeaturesJson')}</label>
        <textarea required value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} className="w-full p-2.5 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] rounded-xl text-sm outline-none focus:border-[hsl(155_33%_23%)] min-h-[100px] font-mono" dir="ltr" placeholder={t('packageFeaturesPlaceholder')} />
        <p className="text-[10px] text-[hsl(153_12%_43%)] mt-1">{t('packageFeaturesHelp')}</p>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="rounded border-[hsl(38_22%_86%)] text-[hsl(155_33%_23%)] focus:ring-[hsl(155_33%_23%)]" />
        <span className="text-sm font-bold text-[hsl(154_26%_15%)]">{t('packageActive')}</span>
      </label>
      <div className="flex gap-3 justify-end pt-4 border-t border-[hsl(38_22%_86%)]">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-full border border-[hsl(38_22%_86%)] text-sm font-bold text-[hsl(153_12%_43%)] hover:bg-[hsl(42_37%_97%)]">{t('cancel')}</button>
        <button type="submit" disabled={loading} className="px-5 py-2.5 bg-[hsl(155_33%_23%)] text-white text-sm font-bold rounded-full hover:bg-[hsl(155_33%_18%)] disabled:opacity-50">{t('save')}</button>
      </div>
    </form>
  );
}

export function AdminPackages() {
  const { data, isLoading } = useAdminPackages();
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();
  const deletePackage = useDeletePackage();
  
  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const { t, language, meta, formatNumber, formatMoney } = useLanguage();

  const items = data?.items || [];

  return (
    <div className="flex-1 flex flex-col bg-[hsl(42_37%_96%)] h-full">
      <AdminHeader 
        title={t('adminPackagesTitle')}
        description={t('adminPackagesDescription')}
        action={
          <button 
            onClick={() => setIsNew(true)}
            className="flex items-center gap-2 bg-[hsl(42_87%_61%)] text-[hsl(155_33%_23%)] px-4 py-2.5 rounded-xl text-sm font-bold hover:-translate-y-0.5 transition-transform shadow-sm"
          >
            <Plus size={18} /> {t('adminNewPackage')}
          </button>
        }
      />
      
      <div className="min-w-0 flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8">
        <DialogPrimitive.Root open={isNew || !!editing} onOpenChange={(open) => { if (!open) { setIsNew(false); setEditing(null); } }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
            <DialogPrimitive.Content className="admin-text-flow fixed left-[50%] top-[50%] z-50 max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6" dir={meta[language].dir}>
              <DialogPrimitive.Title className="text-xl font-bold text-[hsl(155_33%_23%)] mb-6">
                {isNew ? t('adminAddPackage') : t('adminEditPackage')}
              </DialogPrimitive.Title>
              <PackageForm 
                packageData={editing}
                onSave={async (data) => {
                  if (isNew) {
                    await createPackage.mutateAsync(data);
                  } else {
                    await updatePackage.mutateAsync({ id: editing.id, ...data });
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((pkg: any) => (
              <div key={pkg.id} className={`bg-white border ${pkg.active ? 'border-[hsl(38_22%_86%)]' : 'border-dashed border-[hsl(38_22%_86%)] opacity-70'} rounded-2xl p-6 shadow-sm flex flex-col`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[hsl(155_33%_23%)]">{pkg.name}</h3>
                    <p className="text-xs text-[hsl(153_12%_43%)] mt-1">{t('packageDuration', { count: formatNumber(Number(pkg.durationDays)) })}</p>
                  </div>
                  {!pkg.active && <AdminBadge variant="neutral">{t('disabled')}</AdminBadge>}
                </div>
                
                <div className="my-6">
                  <span className="font-numeric text-3xl font-extrabold text-[hsl(154_26%_15%)]" dir="ltr">
                     {formatMoney(Number(pkg.price), 'MRU')}
                  </span>
                </div>
                
                <ul className="space-y-3 flex-1 mb-8">
                  {(pkg.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[hsl(153_12%_43%)]">
                      <Check size={16} className="text-[hsl(42_87%_61%)] shrink-0 mt-0.5" strokeWidth={3} />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="flex gap-2 mt-auto pt-4 border-t border-[hsl(38_22%_86%)]">
                  <button 
                    onClick={() => setEditing(pkg)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-[hsl(42_37%_97%)] border border-[hsl(38_22%_86%)] text-[hsl(155_33%_23%)] text-sm font-bold rounded-xl hover:bg-[hsl(38_22%_92%)] transition-colors"
                  >
                     <Edit size={16} /> {t('editPackage')}
                  </button>
                  <AdminActionDialog
                     title={t('deletePackage')}
                     description={t('deletePackageConfirm', { name: pkg.name })}
                     confirmText={t('delete')}
                    confirmVariant="danger"
                    trigger={
                       <button aria-label={t('deletePackage')} className="flex items-center justify-center px-4 py-2 bg-[hsl(4_62%_48%)/0.1] text-[hsl(4_62%_48%)] rounded-full hover:bg-[hsl(4_62%_48%)/0.2] transition-colors">
                        <Trash2 size={16} />
                      </button>
                    }
                    onConfirm={() => deletePackage.mutateAsync(pkg.id)}
                  />
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-[hsl(153_12%_43%)]">
                {t('noPackages')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
