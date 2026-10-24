import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminHeader } from '@/components/admin-ui';
import { useAdminFetch } from '@/hooks/use-admin';
import { useLanguage } from '@/lib/language';

type RentalSeason = {
  isOpen: boolean;
  seasonName: string | null;
  renewalFee: number;
  changedAt: string;
  activeRentals: number;
  archivedRentals: number;
};

export function AdminRentalSeason() {
  const fetcher = useAdminFetch();
  const queryClient = useQueryClient();
  const { t, formatNumber, formatDate } = useLanguage();
  const [seasonName, setSeasonName] = useState('');
  const season = useQuery({
    queryKey: ['admin-rental-season'],
    queryFn: () => fetcher('/admin/rental-season') as Promise<RentalSeason>,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-rental-season'] });
  const close = useMutation({
    mutationFn: () => fetcher('/admin/rental-season/close', { method: 'POST' }),
    onSuccess: refresh,
  });
  const open = useMutation({
    mutationFn: () => fetcher('/admin/rental-season/open', {
      method: 'POST',
      body: JSON.stringify({ seasonName }),
    }),
    onSuccess: () => {
      setSeasonName('');
      refresh();
    },
  });

  return <div className="flex min-h-full flex-1 flex-col bg-[hsl(42_37%_96%)]">
    <AdminHeader title={t('rentalSeasonTitle')} description={t('rentalSeasonDescription')} />
    <main className="w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      {season.isLoading ? <p className="rounded-xl bg-white p-6">{t('loading')}</p> : null}
      {season.isError ? <p role="alert" className="rounded-xl bg-white p-6 text-red-700">{t('rentalSeasonLoadError')}</p> : null}
      {season.data ? <section className="space-y-5 rounded-2xl border border-[hsl(var(--border))] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{season.data.isOpen ? t('rentalSeasonOpen') : t('rentalSeasonClosed')}</h2>
            <p className="mt-1 text-sm text-slate-600">{season.data.seasonName || t('rentalSeasonUnnamed')}</p>
            <p className="mt-1 text-xs text-slate-500">{t('rentalSeasonChangedAt', { date: formatDate(season.data.changedAt) })}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
            {t('rentalRenewalFee')}: {formatNumber(season.data.renewalFee)} MRU
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{t('activeRentalCount')}</p><p className="mt-1 text-2xl font-bold">{formatNumber(season.data.activeRentals)}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{t('archivedRentalCount')}</p><p className="mt-1 text-2xl font-bold">{formatNumber(season.data.archivedRentals)}</p></div>
        </div>
        {season.data.isOpen ? <button
          type="button"
          onClick={() => {
            if (window.confirm(t('closeRentalSeasonConfirm', { count: season.data?.activeRentals ?? 0 }))) close.mutate();
          }}
          disabled={close.isPending}
          className="rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >{close.isPending ? t('saving') : t('closeRentalSeason')}</button> : <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={seasonName}
            onChange={(event) => setSeasonName(event.target.value)}
            maxLength={120}
            placeholder={t('rentalSeasonNamePlaceholder')}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => open.mutate()}
            disabled={open.isPending}
            className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >{open.isPending ? t('saving') : t('openNextRentalSeason')}</button>
        </div>}
        {close.isError || open.isError ? <p role="alert" className="text-sm text-red-700">{t('rentalSeasonActionError')}</p> : null}
        <p className="text-xs leading-5 text-slate-500">{t('rentalSeasonArchiveNote')}</p>
      </section> : null}
    </main>
  </div>;
}
