import { useEffect, useRef, useState, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth, useClerk } from '@/lib/auth';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Users,
  Search,
  CreditCard,
  Package,
  Flag,
  List,
  History,
  LogOut,
  FolderTree,
  MapPin,
  KeyRound,
  X,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Filter,
  Menu,
  Bell,
  PhoneCall,
  PanelTop,
  CalendarDays,
} from 'lucide-react';
import { useAdminMe, useAdminNotifications, useAdminPasswordLogout } from '@/hooks/use-admin';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/language';
import NotFound from '@/pages/not-found';
import { LanguagePicker } from './language-picker';
import { SignOutDialog } from './sign-out-dialog';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

const navItems = [
  { href: '/admin', label: 'adminOverviewTitle', icon: LayoutDashboard, exact: true },
  { href: '/admin/listings', label: 'adminListingsTitle', icon: Search },
  { href: '/admin/rental-season', label: 'rentalSeasonTitle', icon: CalendarDays, adminOnly: true },
  { href: '/admin/banners', label: 'adminBannersTitle', icon: PanelTop },
  { href: '/admin/notifications', label: 'adminNotificationsTitle', icon: Bell },
  { href: '/admin/users', label: 'adminUsersTitle', icon: Users, adminOnly: true },
  { href: '/admin/payments', label: 'adminPaymentsTitle', icon: CreditCard },
  { href: '/admin/reports', label: 'adminReportsTitle', icon: Flag },
  { href: '/admin/packages', label: 'adminPackagesTitle', icon: Package, adminOnly: true },
  { href: '/admin/payment-methods', label: 'adminPaymentMethodsTitle', icon: List, adminOnly: true },
  { href: '/admin/support-settings', label: 'adminSupportSettingsTitle', icon: PhoneCall, adminOnly: true },
  { href: '/admin/categories', label: 'manageCategories', icon: FolderTree, adminOnly: true },
  { href: '/admin/regions', label: 'manageRegions', icon: MapPin, adminOnly: true },
  { href: '/admin/audit-logs', label: 'adminAuditLogsTitle', icon: History, adminOnly: true },
  { href: '/admin/security', label: 'adminSecurityTitle', icon: KeyRound, adminOnly: true },
] as const;

export function AdminAppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const adminDrawerRef = useRef<HTMLElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const { language, setLanguage, meta, t, formatNumber } = useLanguage();
  const { data: adminMe } = useAdminMe();
  const { data: notifications } = useAdminNotifications();
  const adminPasswordLogout = useAdminPasswordLogout();
  useBodyScrollLock(menuOpen, adminDrawerRef);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setShowSignOutConfirm(false);
    setIsSigningOut(true);
    try {
      await adminPasswordLogout.mutateAsync();
      await signOut({ redirectUrl: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sign-in` });
    } catch {
      setIsSigningOut(false);
      toast({ title: t('signOutError'), description: t('tryAgain'), variant: 'destructive' });
    }
  };
  
  return (
    <div className="admin-text-flow min-h-[100dvh] min-w-0 overflow-x-hidden bg-[hsl(42_37%_94%)] text-[hsl(154_26%_15%)] font-sans selection:bg-[hsl(42_87%_61%)]" dir={meta[language].dir}>
      {menuOpen && <button type="button" aria-label={t('closeMenu')} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden" />}
      <aside ref={adminDrawerRef} className={`fixed inset-y-0 ${language === 'ar' ? 'right-0 border-l' : 'left-0 border-r'} w-[280px] max-w-[86vw] bg-[hsl(155_33%_16%)] text-white border-[hsl(154_26%_25%)] flex flex-col z-50 transition-transform duration-300 lg:w-[260px] lg:translate-x-0 ${menuOpen ? 'translate-x-0' : language === 'ar' ? 'translate-x-full' : '-translate-x-full'}`}>
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-3 text-[hsl(42_87%_61%)] transition-transform hover:-translate-y-0.5">
            <LayoutDashboard size={24} strokeWidth={2.5} />
            <span className="font-bold text-lg tracking-tight text-white">{t('admin')}</span>
          </Link>
          <div className="mt-2 text-[10px] text-[hsl(153_12%_63%)] uppercase tracking-wider font-bold">{t('adminSubtitle')}</div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {navItems.filter((item) => !('adminOnly' in item) || !item.adminOnly || adminMe?.role === 'admin').map((item) => {
            const active = item.href === '/admin'
              ? location === item.href 
              : location.startsWith(item.href);
              
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                onClick={() => setMenuOpen(false)}
                 className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42_87%_61%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(155_33%_16%)] ${
                  active 
                    ? 'bg-[hsl(42_87%_61%)] text-[hsl(155_33%_16%)]' 
                    : 'text-[hsl(42_34%_94%)] hover:bg-white/10'
                }`}
              >
                <item.icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className="min-w-0 flex-1">{t(item.label)}</span>
                {item.href === '/admin/notifications' && Boolean(notifications?.pages[0]?.unreadCount) && (
                  <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-black ${
                    active
                      ? 'bg-[hsl(155_33%_16%)] text-[hsl(42_87%_61%)]'
                      : 'bg-[hsl(4_62%_58%)] text-white'
                  }`}>
                    {formatNumber(notifications?.pages[0]?.unreadCount ?? 0)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/10">
          <div className="mb-3"><LanguagePicker language={language} label={t('language')} setLanguage={setLanguage} /></div>
          <button 
            type="button"
             onClick={() => setShowSignOutConfirm(true)}
            disabled={isSigningOut}
             className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[hsl(4_62%_68%)] transition-colors hover:bg-[hsl(4_62%_48%)/0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42_87%_61%)]"
            data-testid="button-admin-sign-out"
          >
            {isSigningOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            {isSigningOut ? t('signingOut') : t('signOut')}
          </button>
        </div>
      </aside>
      
       <main className={`flex min-h-[100dvh] min-w-0 flex-col ${language === 'ar' ? 'lg:mr-[260px]' : 'lg:ml-[260px]'}`}>
         <div className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-[hsl(38_22%_86%)] bg-[hsl(155_33%_16%)] px-4 py-3 text-white shadow-sm lg:hidden">
           <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg border border-white/15 p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42_87%_61%)]" aria-label={t('openAdminMenu')} data-testid="button-open-admin-menu"><Menu size={20} /></button>
          <span className="text-sm font-bold">{t('admin')}</span>
          <span className="h-9 w-9" />
        </div>
        {children}
      </main>
      <SignOutDialog open={showSignOutConfirm} isLoading={isSigningOut} onCancel={() => setShowSignOutConfirm(false)} onConfirm={() => void handleSignOut()} />
    </div>
  );
}

export function AdminHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <header className="sticky top-14 z-30 flex flex-col gap-3 border-b border-[hsl(38_22%_86%)] bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:py-5 lg:top-0 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-[hsl(155_33%_23%)] sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm font-medium leading-5 text-[hsl(153_12%_43%)]">{description}</p>}
      </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3"><LanguagePicker language={language} label={t('language')} setLanguage={setLanguage} />{action && <div className="min-w-0">{action}</div>}</div>
    </header>
  );
}

export function AdminTable({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[hsl(38_22%_86%)] bg-white shadow-sm">
      <div className="h-full max-w-full overflow-x-auto overscroll-x-contain">
        <table className={`w-full min-w-[720px] text-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function AdminTh({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`bg-[hsl(42_37%_97%)] px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[hsl(153_12%_43%)] ${className}`}>{children}</th>;
}

export function AdminTd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-[hsl(38_22%_92%)] px-4 py-3.5 text-[13px] font-medium text-[hsl(154_26%_15%)] ${className}`}>{children}</td>;
}

export function AdminBadge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  const styles = {
    default: 'bg-[hsl(42_87%_61%)/0.15] text-[hsl(155_33%_23%)] border-[hsl(42_87%_61%)/0.3]',
    success: 'bg-[hsl(155_33%_23%)/0.1] text-[hsl(155_33%_23%)] border-[hsl(155_33%_23%)/0.2]',
    warning: 'bg-[hsl(35_90%_50%)/0.1] text-[hsl(35_90%_35%)] border-[hsl(35_90%_50%)/0.2]',
    danger: 'bg-[hsl(4_62%_48%)/0.1] text-[hsl(4_62%_48%)] border-[hsl(4_62%_48%)/0.2]',
    info: 'bg-[hsl(202_89%_53%)/0.1] text-[hsl(202_89%_45%)] border-[hsl(202_89%_53%)/0.2]',
    neutral: 'bg-[hsl(153_12%_43%)/0.1] text-[hsl(153_12%_43%)] border-[hsl(153_12%_43%)/0.2]',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-bold ${styles[variant]}`}>{children}</span>;
}

export function AdminActionDialog({
  trigger,
  title,
  description,
  confirmText,
  confirmVariant = 'primary',
  onConfirm,
  requireReason = false,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: (reason?: string) => Promise<void> | void;
  requireReason?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const { language, meta, t } = useLanguage();

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
       toast({ title: t('reasonRequired'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await onConfirm(reason);
      setOpen(false);
      setReason('');
    } catch {
       toast({ title: t('error'), description: t('tryAgain'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
         <DialogPrimitive.Content className="admin-text-flow fixed left-[50%] top-[50%] z-50 grid max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-5 overflow-y-auto rounded-2xl border border-[hsl(38_22%_86%)] bg-white p-5 shadow-2xl sm:p-6" dir={meta[language].dir}>
          <div>
            <DialogPrimitive.Title className="text-xl font-bold text-[hsl(155_33%_23%)]">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-[hsl(153_12%_43%)] leading-relaxed">
              {description}
            </DialogPrimitive.Description>
          </div>
          
          {requireReason && (
            <div className="space-y-2">
               <label className="text-xs font-bold text-[hsl(154_26%_15%)]">{t('reasonLabel')}</label>
              <textarea 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                 className="min-h-[100px] w-full resize-none rounded-xl border border-[hsl(38_22%_86%)] bg-[hsl(42_37%_97%)] p-3 text-sm outline-none focus:border-[hsl(155_33%_23%)] focus:ring-2 focus:ring-[hsl(155_33%_23%)/0.2]"
                 placeholder={t('reasonPlaceholder')}
              />
            </div>
          )}
          
           <div className="mt-2 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <DialogPrimitive.Close asChild>
               <button className="min-h-11 rounded-xl border border-[hsl(38_22%_86%)] px-5 py-2.5 text-sm font-bold text-[hsl(153_12%_43%)] transition-colors hover:bg-[hsl(42_37%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(155_33%_23%)/0.3]">{t('cancel')}</button>
            </DialogPrimitive.Close>
            <button 
              onClick={handleConfirm}
              disabled={loading}
               className={`flex min-h-11 min-w-[100px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42_87%_61%)] focus-visible:ring-offset-2 ${
                confirmVariant === 'danger' ? 'bg-[hsl(4_62%_48%)] hover:bg-[hsl(4_62%_42%)]' : 'bg-[hsl(155_33%_23%)] hover:bg-[hsl(155_33%_18%)]'
              } disabled:opacity-50`}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : confirmText ?? t('confirm')}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: me, isLoading } = useAdminMe();

  useEffect(() => {
    if (
      isLoaded
      && userId
      && !isLoading
      && me?.role === 'admin'
      && !me.adminSessionActive
    ) {
      setLocation('/admin/login');
    }
  }, [isLoaded, isLoading, me, setLocation, userId]);

  if (!isLoaded || (isLoaded && userId && isLoading)) {
    return (
      <div className="min-h-screen bg-[hsl(42_37%_96%)] flex items-center justify-center">
        <Loader2 className="animate-spin text-[hsl(155_33%_23%)]" size={32} />
      </div>
    );
  }

  if (!userId || me?.role !== 'admin') {
    return <NotFound />;
  }

  if (!me.adminSessionActive) {
    return null;
  }

  return <AdminAppShell>{children}</AdminAppShell>;
}

export function Pagination({ page, limit, total, onPageChange }: { page: number; limit: number; total: number; onPageChange: (p: number) => void }) {
  const { t } = useLanguage();
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(38_22%_86%)] bg-white px-4 py-4 sm:px-6">
      <p className="text-xs text-[hsl(153_12%_43%)]">
        {t('showing', { from: Math.min((page - 1) * limit + 1, total), to: Math.min(page * limit, total), total })}
      </p>
       <div className="flex gap-1">
        <button 
          onClick={() => onPageChange(page - 1)} 
          disabled={page === 1}
           className="min-h-10 rounded-lg border border-[hsl(38_22%_86%)] px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[hsl(42_37%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(155_33%_23%)/0.3] disabled:opacity-40"
        >
          {t('previous')}
        </button>
        <button 
          onClick={() => onPageChange(page + 1)} 
          disabled={page === totalPages}
           className="min-h-10 rounded-lg border border-[hsl(38_22%_86%)] px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[hsl(42_37%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(155_33%_23%)/0.3] disabled:opacity-40"
        >
          {t('next')}
        </button>
      </div>
    </div>
  );
}

export function FilterInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-[hsl(153_12%_43%)] ${isRtl ? 'right-3' : 'left-3'}`} />
      <input 
        id={id}
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
         className={`min-h-11 w-full rounded-xl border border-[hsl(38_22%_86%)] bg-white py-2 text-sm text-[#000000] outline-none placeholder:text-[#6b7280] focus:border-[hsl(155_33%_23%)] focus:ring-2 focus:ring-[hsl(155_33%_23%)/0.2] md:w-80 ${isRtl ? 'pl-4 pr-10' : 'pl-10 pr-4'}`}
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <Filter size={14} className={`absolute top-1/2 -translate-y-1/2 text-[hsl(153_12%_43%)] pointer-events-none ${isRtl ? 'right-3' : 'left-3'}`} />
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
         className={`min-h-11 w-full appearance-none rounded-xl border border-[hsl(38_22%_86%)] bg-white py-2 text-sm outline-none focus:border-[hsl(155_33%_23%)] focus:ring-2 focus:ring-[hsl(155_33%_23%)/0.2] md:w-48 ${isRtl ? 'pl-4 pr-9' : 'pl-9 pr-4'}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
