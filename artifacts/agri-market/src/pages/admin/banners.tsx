import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Edit3, Eye, Image, LoaderCircle, Plus, Power, Trash2, X } from 'lucide-react';
import { AdminHeader } from '@/components/admin-ui';
import { BannerImageUploader } from '@/components/banner-image-uploader';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';
import { useAdminBanners, useCreateBanner, useDeleteBanner, useUpdateBanner, type AdminBanner, type BannerInput } from '@/hooks/use-admin';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

type BannerForm = {
  title: string;
  subtitle: string;
  additionalText: string;
  imagePath: string;
  imageAlt: string;
  ctaLabel: string;
  targetUrl: string;
  active: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
};

const emptyForm: BannerForm = {
  title: '',
  subtitle: '',
  additionalText: '',
  imagePath: '',
  imageAlt: '',
  ctaLabel: '',
  targetUrl: '',
  active: false,
  sortOrder: '0',
  startsAt: '',
  endsAt: '',
};

const toDateInput = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDateInput = (value: string) => value ? new Date(value).toISOString() : null;

function formFromBanner(banner: AdminBanner): BannerForm {
  return {
    title: banner.title ?? '',
    subtitle: banner.subtitle ?? '',
    additionalText: banner.additionalText ?? '',
    imagePath: banner.imagePath ?? '',
    imageAlt: banner.imageAlt ?? '',
    ctaLabel: banner.ctaLabel ?? '',
    targetUrl: banner.targetUrl ?? '',
    active: banner.active,
    sortOrder: String(banner.sortOrder),
    startsAt: toDateInput(banner.startsAt),
    endsAt: toDateInput(banner.endsAt),
  };
}

export function AdminBanners() {
  const { data, isLoading } = useAdminBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const bannerFormRef = useRef<HTMLFormElement | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
    setForm(emptyForm);
    setPreviewUrl('');
  };

  const openEdit = (banner: AdminBanner) => {
    setEditing(banner);
    setFormOpen(true);
    setForm(formFromBanner(banner));
    setPreviewUrl(banner.imageUrl ?? '');
  };

  const closeForm = () => {
    if (!saving && !uploading) setFormOpen(false);
  };

  const setField = <K extends keyof BannerForm>(field: K, value: BannerForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (uploading) {
      toast({ title: t('saving'), variant: 'destructive' });
      return;
    }
    if (!form.imagePath) {
      toast({ title: t('bannerImageRequired'), variant: 'destructive' });
      return;
    }
    const input: BannerInput = {
      ...form,
      title: form.title.trim() || null,
      subtitle: form.subtitle.trim() || null,
      additionalText: form.additionalText.trim() || null,
      imagePath: form.imagePath || null,
      imageAlt: form.imageAlt.trim() || null,
      ctaLabel: form.ctaLabel.trim() || null,
      targetUrl: form.targetUrl.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      startsAt: fromDateInput(form.startsAt),
      endsAt: fromDateInput(form.endsAt),
    };
    setSaving(true);
    try {
      if (editing) {
        await updateBanner.mutateAsync({ id: editing.id, input });
      } else {
        await createBanner.mutateAsync(input);
      }
      toast({ title: editing ? t('bannerUpdated') : t('bannerCreated') });
      setFormOpen(false);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : t('serverConnectionError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (banner: AdminBanner) => {
    try {
      await updateBanner.mutateAsync({ id: banner.id, input: { active: !banner.active } });
      toast({ title: banner.active ? t('bannerDisabled') : t('bannerEnabled') });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : t('serverConnectionError'), variant: 'destructive' });
    }
  };

  const remove = async (banner: AdminBanner) => {
    if (!window.confirm(t('bannerDeleteConfirm', { title: banner.imageAlt || banner.title || t('bannerImagePreview') }))) return;
    try {
      await deleteBanner.mutateAsync(banner.id);
      toast({ title: t('bannerDeleted') });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : t('serverConnectionError'), variant: 'destructive' });
    }
  };

  const banners = data?.items ?? [];
  const dialogOpen = formOpen;
  useBodyScrollLock(dialogOpen, bannerFormRef);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[hsl(42_37%_96%)]">
      <AdminHeader title={t('adminBannersTitle')} description={t('adminBannersDescription')} />
      <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[hsl(153_12%_43%)]">{t('adminBannersIndependentNote')}</p>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(155_33%_16%)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[hsl(155_33%_24%)]" data-testid="button-create-banner">
            <Plus size={17} /> {t('createBanner')}
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-white" /><div className="h-64 animate-pulse rounded-2xl bg-white" /></div>
        ) : banners.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(154_20%_78%)] bg-white p-8 text-center">
            <Image size={30} className="mb-3 text-[hsl(153_12%_55%)]" />
            <h2 className="font-bold text-[hsl(155_33%_16%)]">{t('noBanners')}</h2>
            <p className="mt-1 max-w-md text-sm text-[hsl(153_12%_43%)]">{t('noBannersDescription')}</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {banners.map((banner) => (
              <article key={banner.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${banner.active ? 'border-[hsl(42_87%_61%)]' : 'border-[hsl(154_20%_86%)]'}`}>
                <div className="relative">
                  {banner.imageUrl ? <img src={banner.imageUrl} alt={banner.imageAlt || ''} className="block h-auto max-h-[70vh] w-full object-contain" /> : <div className="aspect-[2.6/1] bg-[hsl(155_20%_90%)]" />}
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${banner.active ? 'bg-[hsl(42_87%_61%)] text-[hsl(155_33%_16%)]' : 'bg-black/55 text-white'}`}>{banner.active ? t('bannerActive') : t('bannerInactive')}</span>
                </div>
                <div className="space-y-4 p-5">
                  <span className="inline-flex rounded-lg bg-[hsl(155_20%_94%)] px-2 py-1 text-xs font-bold text-[hsl(155_33%_16%)]">{t('bannerSortOrder')}: #{banner.sortOrder}</span>
                  <div className="flex flex-wrap gap-2 border-t border-[hsl(154_20%_90%)] pt-4">
                    <button type="button" onClick={() => toggle(banner)} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(154_20%_82%)] px-3 py-2 text-xs font-bold text-[hsl(155_33%_16%)] hover:bg-[hsl(155_20%_95%)]" data-testid={`button-toggle-banner-${banner.id}`}><Power size={14} />{banner.active ? t('disableBanner') : t('enableBanner')}</button>
                    <button type="button" onClick={() => openEdit(banner)} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(154_20%_82%)] px-3 py-2 text-xs font-bold text-[hsl(155_33%_16%)] hover:bg-[hsl(155_20%_95%)]" data-testid={`button-edit-banner-${banner.id}`}><Edit3 size={14} />{t('editBanner')}</button>
                    {banner.targetUrl && <a href={banner.targetUrl} target={banner.targetUrl.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(154_20%_82%)] px-3 py-2 text-xs font-bold text-[hsl(155_33%_16%)] hover:bg-[hsl(155_20%_95%)]"><Eye size={14} />{t('previewBanner')}</a>}
                    <button type="button" onClick={() => void remove(banner)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[hsl(4_62%_48%)] hover:bg-[hsl(4_62%_96%)]" data-testid={`button-delete-banner-${banner.id}`}><Trash2 size={14} />{t('deleteBanner')}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {dialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={editing ? t('editBanner') : t('createBanner')}>
          <form ref={bannerFormRef} onSubmit={submit} className="mobile-modal-panel max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-[hsl(42_37%_98%)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[hsl(154_20%_86%)] bg-[hsl(42_37%_98%)] px-4 py-4 sm:px-6 sm:py-5">
              <div><h2 className="font-bold text-[hsl(155_33%_16%)]">{editing ? t('editBanner') : t('createBanner')}</h2><p className="mt-1 text-xs text-[hsl(153_12%_43%)]">{t('bannerFormDescription')}</p></div>
              <button type="button" onClick={closeForm} className="rounded-full p-2 text-[hsl(153_12%_43%)] hover:bg-[hsl(155_20%_90%)]" aria-label={t('close')}><X size={18} /></button>
            </div>
            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-4">
                <BannerImageUploader value={form.imagePath} previewUrl={previewUrl} onChange={(path, preview) => { setField('imagePath', path); setPreviewUrl(preview); }} onBusyChange={setUploading} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5"><span className="text-xs font-bold">{t('bannerSortOrder')}</span><input type="number" value={form.sortOrder} onChange={(e) => setField('sortOrder', e.target.value)} className="admin-input" /></label>
                  <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-bold">{t('bannerTargetUrl')}</span><input value={form.targetUrl} onChange={(e) => setField('targetUrl', e.target.value)} placeholder="/listings or https://example.com" className="admin-input" /></label>
                  <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-bold">{t('bannerImageAlt')}</span><input value={form.imageAlt} onChange={(e) => setField('imageAlt', e.target.value)} className="admin-input" /></label>
                  <label className="flex items-center gap-3 rounded-xl border border-[hsl(154_20%_84%)] bg-white px-3 py-3 text-xs font-bold sm:col-span-2"><input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} className="h-4 w-4 accent-[hsl(155_33%_16%)]" /> {t('showBanner')}</label>
                </div>
              </div>
              <div className="rounded-2xl bg-[hsl(155_33%_16%)] p-5 text-white">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold text-[hsl(42_87%_61%)]"><Eye size={15} /> {t('bannerPreview')}</div>
                <div className="overflow-hidden rounded-2xl bg-[hsl(155_20%_24%)]">
                  {previewUrl ? <img src={previewUrl} alt="" className="block h-auto max-h-[70vh] w-full object-contain" /> : <div className="aspect-[2.6/1] bg-[hsl(155_20%_24%)]" />}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-[hsl(154_20%_86%)] px-6 py-5">
              <button type="button" onClick={closeForm} className="rounded-xl border border-[hsl(154_20%_82%)] px-5 py-3 text-sm font-bold" disabled={saving || uploading}>{t('cancel')}</button>
              <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(155_33%_16%)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving && <LoaderCircle size={16} className="animate-spin" />}{t('saveBanner')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}