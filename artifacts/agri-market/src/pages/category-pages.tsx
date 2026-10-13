import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpLeft, Check, Edit3, FolderPlus, GripVertical, Leaf, Plus, Trash2, X } from 'lucide-react';
import {
  getListAdminCategoriesQueryKey,
  getListCategoriesQueryKey,
  useCreateCategory,
  useCreateSubcategory,
  useDeleteCategory,
  useDeleteSubcategory,
  useListAdminCategories,
  useListCategories,
  useUpdateCategory,
  useUpdateSubcategory,
  type Category,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell, EmptyState, ErrorState, PageHeading, iconForCategory } from '@/components/marketplace-ui';
import { Stagger, StaggerItem } from '@/components/motion';
import { AdminHeader } from '@/components/admin-ui';
import { translatedName, useLanguage } from '@/lib/language';

type CategoryDraft = { name: string; nameFr: string; nameEn: string; slug: string; icon: string; sortOrder: number; active: boolean };
type SubcategoryDraft = { name: string; nameFr: string; nameEn: string; slug: string; sortOrder: number; active: boolean };

const emptyCategory: CategoryDraft = { name: '', nameFr: '', nameEn: '', slug: '', icon: 'leaf', sortOrder: 0, active: true };
const emptySubcategory: SubcategoryDraft = { name: '', nameFr: '', nameEn: '', slug: '', sortOrder: 0, active: true };

function CategoryCard({ category }: { category: Category }) {
  const { language, t } = useLanguage();
  const Icon = iconForCategory(category.slug);
  return <Link href={`/listings?category=${category.slug}`} className="group relative block min-w-0 overflow-hidden rounded-[1.35rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_8px_24px_hsl(155_20%_18%/.05)] transition duration-200 hover:-translate-y-1 hover:border-[hsl(var(--accent))] hover:shadow-[0_14px_32px_hsl(155_20%_18%/.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" data-testid={`card-category-${category.slug}`}>
    <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--accent))]"><Icon size={23} /></span><span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--primary))]">{t('listingCount', { count: category.count })}</span></div>
    <div className="mt-5 flex items-end justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-bold text-[hsl(var(--primary))]">{translatedName(category, language)}</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('subcategoryCount', { count: category.subcategories.length })}</p></div><ArrowUpLeft size={17} className="shrink-0 text-[hsl(var(--muted-foreground))] transition group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:text-[hsl(var(--primary))]" aria-hidden="true" /></div>
    <div className="mt-5 flex min-h-7 flex-wrap gap-2">{category.subcategories.filter((item) => item.active).slice(0, 5).map((item) => <span key={item.id} className="max-w-full truncate rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">{translatedName(item, language)}</span>)}</div>
  </Link>;
}

export function Categories() {
  const { t } = useLanguage();
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const categories = categoriesQuery.data ?? [];
  return <AppShell><PageHeading eyebrow={t('marketCatalog')} title={t('categories')} description={t('chooseCategory')} />{categoriesQuery.isLoading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-52 animate-pulse rounded-[1.35rem] bg-[hsl(var(--muted))]" />)}</div> : categoriesQuery.isError ? <ErrorState onRetry={() => categoriesQuery.refetch()} /> : categories.length ? <Stagger className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{categories.map((category) => <StaggerItem key={category.id} interactive><CategoryCard category={category} /></StaggerItem>)}</Stagger> : <EmptyState icon={Leaf} title={t('noCategories')} description={t('noCategoriesDescription')} />}</AppShell>;
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="field-label">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="field-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]" /></label>;
}

function CategoryEditor({ draft, setDraft, onSubmit, onClose, busy }: { draft: CategoryDraft; setDraft: (draft: CategoryDraft) => void; onSubmit: () => void; onClose?: () => void; busy: boolean }) {
  const { t } = useLanguage();
  return <div className="rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--secondary)/.4)] p-4"><div className="grid gap-3 sm:grid-cols-3"><TextField label={t('arabicName')} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} /><TextField label={t('frenchName')} value={draft.nameFr} onChange={(value) => setDraft({ ...draft, nameFr: value })} /><TextField label={t('englishName')} value={draft.nameEn} onChange={(value) => setDraft({ ...draft, nameEn: value })} /><TextField label={t('slug')} value={draft.slug} onChange={(value) => setDraft({ ...draft, slug: value })} /><TextField label={t('icon')} value={draft.icon} onChange={(value) => setDraft({ ...draft, icon: value })} /><TextField label={t('order')} type="number" value={draft.sortOrder} onChange={(value) => setDraft({ ...draft, sortOrder: Number(value) })} /></div><div className="mt-3 flex items-center justify-between"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />{t('active')}</label><div className="flex gap-2"><button type="button" onClick={onSubmit} disabled={busy} className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-white"><Check size={14} className="ml-1 inline" />{t('save')}</button>{onClose && <button type="button" onClick={onClose} className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-xs font-bold"><X size={14} className="ml-1 inline" />{t('cancel')}</button>}</div></div></div>;
}

function SubcategoryEditor({ draft, setDraft, onSubmit, onClose, busy }: { draft: SubcategoryDraft; setDraft: (draft: SubcategoryDraft) => void; onSubmit: () => void; onClose?: () => void; busy: boolean }) {
  const { t } = useLanguage();
  return <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3"><div className="grid gap-2 sm:grid-cols-4"><TextField label={t('arabicName')} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} /><TextField label={t('frenchName')} value={draft.nameFr} onChange={(value) => setDraft({ ...draft, nameFr: value })} /><TextField label={t('englishName')} value={draft.nameEn} onChange={(value) => setDraft({ ...draft, nameEn: value })} /><TextField label={t('slug')} value={draft.slug} onChange={(value) => setDraft({ ...draft, slug: value })} /></div><div className="mt-3 flex items-center justify-end gap-2"><button type="button" onClick={onSubmit} disabled={busy} className="rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-[11px] font-bold text-white">{t('save')}</button>{onClose && <button type="button" onClick={onClose} className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-[11px]">{t('cancel')}</button>}</div></div>;
}

export function AdminCategories() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const query = useListAdminCategories({ query: { queryKey: getListAdminCategoriesQueryKey() } });
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createSubcategory = useCreateSubcategory();
  const updateSubcategory = useUpdateSubcategory();
  const deleteSubcategory = useDeleteSubcategory();
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<number, SubcategoryDraft | null>>({});
  const [editingSubcategory, setEditingSubcategory] = useState<number | null>(null);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListAdminCategoriesQueryKey() }); queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); };
  const categories = query.data ?? [];
  const saveCategory = () => {
    if (!categoryDraft) return;
    if (editingCategoryId) updateCategory.mutate({ id: editingCategoryId, data: categoryDraft }, { onSuccess: () => { setCategoryDraft(null); setEditingCategoryId(null); invalidate(); } });
    else createCategory.mutate({ data: categoryDraft }, { onSuccess: () => { setCategoryDraft(null); invalidate(); } });
  };
  const saveSubcategory = (categoryId: number) => {
    const draft = subcategoryDrafts[categoryId];
    if (!draft) return;
    if (editingSubcategory) updateSubcategory.mutate({ id: editingSubcategory, data: draft }, { onSuccess: () => { setSubcategoryDrafts({}); setEditingSubcategory(null); invalidate(); } });
    else createSubcategory.mutate({ id: categoryId, data: draft }, { onSuccess: () => { setSubcategoryDrafts({}); invalidate(); } });
  };
  return <div className="flex h-full min-w-0 flex-1 flex-col"><AdminHeader title={t('manageCategories')} description={t('manageCategoriesDescription')} action={<button type="button" onClick={() => { setEditingCategoryId(null); setCategoryDraft(emptyCategory); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"><Plus size={16} />{t('newCategory')}</button>} /><div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 md:p-8">{categoryDraft && <div className="mb-6"><CategoryEditor draft={categoryDraft} setDraft={setCategoryDraft} onSubmit={saveCategory} onClose={() => { setCategoryDraft(null); setEditingCategoryId(null); }} busy={createCategory.isPending || updateCategory.isPending} /></div>}{query.isLoading ? <div className="h-80 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <div className="min-w-0 space-y-4">{categories.map((category) => <section key={category.id} className={`rounded-[1.25rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[0_6px_20px_hsl(155_20%_18%/.04)] sm:p-5 ${!category.active ? 'opacity-60' : ''}`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><GripVertical className="mt-1 shrink-0 text-[hsl(var(--muted-foreground))]" size={17} /><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--accent))]"><Leaf size={19} /></span><div className="min-w-0"><h2 className="truncate font-bold text-[hsl(var(--primary))]">{category.name}</h2><p className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{category.nameFr} · {category.nameEn} · {t('order')} {category.sortOrder}</p></div></div><div className="flex gap-1"><button type="button" onClick={() => { setEditingCategoryId(category.id); setCategoryDraft({ name: category.name, nameFr: category.nameFr, nameEn: category.nameEn, slug: category.slug, icon: category.icon, sortOrder: category.sortOrder, active: category.active }); }} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]" aria-label={t('editCategory')}><Edit3 size={15} /></button><button type="button" onClick={() => { if (window.confirm(t('deleteCategoryConfirm', { name: category.name }))) deleteCategory.mutate({ id: category.id }, { onSuccess: invalidate }); }} className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)]" aria-label={t('deleteCategory')}><Trash2 size={15} /></button></div></div><div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold">{t('subcategories')} ({category.subcategories.length})</h3><button type="button" onClick={() => { setEditingSubcategory(null); setSubcategoryDrafts({ [category.id]: { ...emptySubcategory, sortOrder: category.subcategories.length } }); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-bold text-[hsl(var(--primary))]"><FolderPlus size={13} />{t('addSubcategory')}</button></div><div className="space-y-2">{category.subcategories.map((subcategory) => <div key={subcategory.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[hsl(var(--secondary)/.5)] px-3 py-2"><span className="min-w-0 truncate text-xs">{subcategory.name}<small className="mr-2 text-[10px] text-[hsl(var(--muted-foreground))]">{subcategory.nameFr} · {subcategory.nameEn}</small></span><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setEditingSubcategory(subcategory.id); setSubcategoryDrafts({ [category.id]: { name: subcategory.name, nameFr: subcategory.nameFr, nameEn: subcategory.nameEn, slug: subcategory.slug, sortOrder: subcategory.sortOrder, active: subcategory.active } }); }} className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))]" aria-label={t('editCategory')}><Edit3 size={13} /></button><button type="button" onClick={() => { if (window.confirm(t('deleteSubcategoryConfirm', { name: subcategory.name }))) deleteSubcategory.mutate({ id: subcategory.id }, { onSuccess: invalidate }); }} className="rounded-md p-1.5 text-[hsl(var(--destructive))]" aria-label={t('deleteSubcategory')}><Trash2 size={13} /></button></div></div>)}</div>{subcategoryDrafts[category.id] && <SubcategoryEditor draft={subcategoryDrafts[category.id]!} setDraft={(draft) => setSubcategoryDrafts({ [category.id]: draft })} onSubmit={() => saveSubcategory(category.id)} onClose={() => { setSubcategoryDrafts({}); setEditingSubcategory(null); }} busy={createSubcategory.isPending || updateSubcategory.isPending} />}</div></section>)}</div>}</div></div>;
}
