import { useState } from 'react';
import { Edit3, MapPin, Plus, Trash2 } from 'lucide-react';
import {
  getListAdminRegionsQueryKey,
  getListRegionsQueryKey,
  useCreateRegion,
  useDeleteRegion,
  useListAdminRegions,
  useUpdateRegion,
  type RegionInput,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '@/components/marketplace-ui';
import { AdminHeader } from '@/components/admin-ui';
import { useLanguage } from '@/lib/language';

type RegionDraft = RegionInput;

const emptyRegion: RegionDraft = { name: '', nameFr: '', nameEn: '', sortOrder: 0, active: true };

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="field-label">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="field-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" /></label>;
}

function RegionEditor({ draft, setDraft, onSubmit, onClose, busy }: { draft: RegionDraft; setDraft: (draft: RegionDraft) => void; onSubmit: () => void; onClose?: () => void; busy: boolean }) {
  const { t } = useLanguage();
  return <div className="rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--secondary)/.4)] p-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <TextField label={t('arabicName')} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label={t('frenchName')} value={draft.nameFr} onChange={(value) => setDraft({ ...draft, nameFr: value })} />
      <TextField label={t('englishName')} value={draft.nameEn} onChange={(value) => setDraft({ ...draft, nameEn: value })} />
      <TextField label={t('order')} type="number" value={draft.sortOrder ?? 0} onChange={(value) => setDraft({ ...draft, sortOrder: Number(value) })} />
    </div>
    <div className="mt-3 flex items-center justify-between">
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.active ?? true} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />{t('active')}</label>
      <div className="flex gap-2">
        <button type="button" onClick={onSubmit} disabled={busy} className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-white">{t('save')}</button>
        {onClose && <button type="button" onClick={onClose} className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-xs font-bold">{t('cancel')}</button>}
      </div>
    </div>
  </div>;
}

export function AdminRegions() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const query = useListAdminRegions({ query: { queryKey: getListAdminRegionsQueryKey() } });
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const deleteRegion = useDeleteRegion();
  const [draft, setDraft] = useState<RegionDraft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminRegionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListRegionsQueryKey() });
  };
  const regions = query.data ?? [];
  const save = () => {
    if (!draft) return;
    if (editingId) updateRegion.mutate({ id: editingId, data: draft }, { onSuccess: () => { setDraft(null); setEditingId(null); invalidate(); } });
    else createRegion.mutate({ data: draft }, { onSuccess: () => { setDraft(null); invalidate(); } });
  };
  return <div className="flex h-full min-w-0 flex-1 flex-col">
    <AdminHeader
      title={t('manageRegions')}
      description={t('manageRegionsDescription')}
      action={<button type="button" onClick={() => { setEditingId(null); setDraft(emptyRegion); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"><Plus size={16} />{t('newRegion')}</button>}
    />
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 md:p-8">
      {draft && <div className="mb-6"><RegionEditor draft={draft} setDraft={setDraft} onSubmit={save} onClose={() => { setDraft(null); setEditingId(null); }} busy={createRegion.isPending || updateRegion.isPending} /></div>}
      {query.isLoading ? <div className="h-80 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : (
        <div className="min-w-0 space-y-3">
          {regions.map((region) => (
            <div key={region.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[0_6px_20px_hsl(155_20%_18%/.04)] ${!region.active ? 'opacity-60' : ''}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--accent))]"><MapPin size={19} /></span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-[hsl(var(--primary))]">{region.name}</h2>
                  <p className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{region.nameFr} · {region.nameEn} · {t('order')} {region.sortOrder} · {t('listingCount', { count: region.count })}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => { setEditingId(region.id); setDraft({ name: region.name, nameFr: region.nameFr, nameEn: region.nameEn, sortOrder: region.sortOrder, active: region.active }); }} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" aria-label={t('editRegion')}><Edit3 size={15} /></button>
                <button type="button" onClick={() => { if (window.confirm(t('deleteRegionConfirm', { name: region.name }))) deleteRegion.mutate({ id: region.id }, { onSuccess: invalidate }); }} className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)]" aria-label={t('deleteRegion')}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>;
}
