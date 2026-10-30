import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthTokenGetter, updateMyAccountProfile } from '@workspace/api-client-react';
import { takePendingSignupProfile } from '@/lib/pending-signup-profile';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ErrorBoundary } from '@/components/error-boundary';
import { Spinner } from '@/components/ui/spinner';
import { useImageLoadingHints } from '@/components/viewport-image';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/lib/language';
import { LegalConsentGate } from '@/components/legal-consent-gate';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { OfflineIndicator } from '@/components/offline-indicator';
import {
  clearSavedStateFromPublicListingData,
  isIdentityProtectedPath,
  isPublicListingDataQueryKey,
  isPublicMarketplaceQueryKey,
  shouldShowAuthLoadingScreen,
} from '@/lib/auth-query-cache';
import { ENABLE_PAID_LISTINGS } from '@/lib/features';
import NotFound from '@/pages/not-found';
import { Home } from '@/pages/marketplace-home';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const Account = lazy(() => import('@/pages/marketplace-account').then(m => ({ default: m.Account })));
const AddListing = lazy(() => import('@/pages/add-listing').then(m => ({ default: m.AddListing })));
const Dashboard = lazy(() => import('@/pages/marketplace-dashboard').then(m => ({ default: m.Dashboard })));
const Listings = lazy(() => import('@/pages/marketplace-listings').then(m => ({ default: m.Listings })));
const SellerActiveListings = lazy(() => import('@/pages/marketplace-seller-active-listings').then(m => ({ default: m.SellerActiveListings })));
const Support = lazy(() => import('@/pages/marketplace-support').then(m => ({ default: m.Support })));
const Saved = lazy(() => import('@/pages/marketplace-saved').then(m => ({ default: m.Saved })));
const AdminGuard = lazy(() => import('@/components/admin-ui').then(m => ({ default: m.AdminGuard })));
const AdminLogin = lazy(() => import('@/pages/admin/login').then(m => ({ default: m.AdminLogin })));
const SignIn = lazy(() => import('@/pages/sign-in').then(m => ({ default: m.SignIn })));
const SignUp = lazy(() => import('@/pages/sign-up').then(m => ({ default: m.SignUp })));
const ListingDetail = lazy(() => import('@/pages/listing-detail').then((module) => ({ default: module.ListingDetail })));
const SellerProfile = lazy(() => import('@/pages/seller-profile').then((module) => ({ default: module.SellerProfile })));
const Notifications = lazy(() => import('@/pages/notifications').then((module) => ({ default: module.Notifications })));
const ReportDetails = lazy(() => import('@/pages/report-details').then((module) => ({ default: module.ReportDetails })));
const Payments = lazy(() => import('@/pages/payments').then((module) => ({ default: module.Payments })));
const AdminCategories = lazy(() => import('@/pages/category-pages').then((module) => ({ default: module.AdminCategories })));
const Categories = lazy(() => import('@/pages/category-pages').then((module) => ({ default: module.Categories })));
const PrivacyPolicy = lazy(() => import('@/pages/legal').then((module) => ({ default: module.PrivacyPolicy })));
const TermsOfService = lazy(() => import('@/pages/legal').then((module) => ({ default: module.TermsOfService })));
const AdminOverview = lazy(() => import('@/pages/admin/overview').then((module) => ({ default: module.AdminOverview })));
const AdminListings = lazy(() => import('@/pages/admin/listings').then((module) => ({ default: module.AdminListings })));
const AdminRentalSeason = lazy(() => import('@/pages/admin/rental-season').then((module) => ({ default: module.AdminRentalSeason })));
const AdminBanners = lazy(() => import('@/pages/admin/banners').then((module) => ({ default: module.AdminBanners })));
const AdminUsers = lazy(() => import('@/pages/admin/users').then((module) => ({ default: module.AdminUsers })));
const AdminPayments = lazy(() => import('@/pages/admin/payments').then((module) => ({ default: module.AdminPayments })));
const AdminPackages = lazy(() => import('@/pages/admin/packages').then((module) => ({ default: module.AdminPackages })));
const AdminPaymentMethods = lazy(() => import('@/pages/admin/payment-methods').then((module) => ({ default: module.AdminPaymentMethods })));
const AdminReports = lazy(() => import('@/pages/admin/reports').then((module) => ({ default: module.AdminReports })));
const AdminAuditLogs = lazy(() => import('@/pages/admin/audit-logs').then((module) => ({ default: module.AdminAuditLogs })));
const AdminNotifications = lazy(() => import('@/pages/admin/notifications').then((module) => ({ default: module.AdminNotifications })));
const AdminSupportSettings = lazy(() => import('@/pages/admin/support-settings').then((module) => ({ default: module.AdminSupportSettings })));
const AdminSecurity = lazy(() => import('@/pages/admin/security').then((module) => ({ default: module.AdminSecurity })));
const AdminRegions = lazy(() => import('@/pages/admin/regions').then((module) => ({ default: module.AdminRegions })));

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function PaymentsRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!ENABLE_PAID_LISTINGS) setLocation('/');
  }, [setLocation]);
  return ENABLE_PAID_LISTINGS ? <Payments /> : null;
}

function isPublicMarketplaceRoute(path: string): boolean {
  return path === '/'
    || path === '/listings'
    || path.startsWith('/listings/')
    || path.startsWith('/sellers/')
    || path === '/categories'
    || path.startsWith('/categories/')
    || path === '/privacy'
    || path === '/terms';
}

function isKnownMarketplaceRoute(path: string): boolean {
  return isPublicMarketplaceRoute(path)
    || ['/saved', '/support', '/notifications', '/payments', '/dashboard',
      '/dashboard/active-listings', '/account', '/add-listing'].includes(path)
    || /^\/reports\/[^/]+$/.test(path);
}

const loadingScreen = (
  <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))]"><Spinner /></div>
);

function Router() {
  const { isLoaded, userId } = useAuth();
  const [location, setLocation] = useLocation();

  const isAuthCallbackRoute = location.startsWith('/auth/callback');
  const isSignInRoute = location === '/sign-in' || location.startsWith('/sign-in/');
  const isSignUpRoute = location === '/sign-up' || location.startsWith('/sign-up/');
  const isAuthRoute = isSignInRoute || isSignUpRoute;
  const isAdminPath = location === '/admin' || location.startsWith('/admin/');
  const isAdminLogin = location === '/admin/login';

  // Sign-in / sign-up render our own custom pages (see pages/sign-in.tsx,
  // pages/sign-up.tsx), which drive Authentik's flows headlessly — Authentik's
  // hosted UI is never shown. A protected route without a session routes here.
  useEffect(() => {
    if (!isLoaded || isAuthRoute || userId || isAdminPath) return;
    if (isKnownMarketplaceRoute(location) && !isPublicMarketplaceRoute(location)) {
      setLocation(`/sign-in?redirect_url=${encodeURIComponent(location)}`, { replace: true });
    }
  }, [isAdminPath, isAuthRoute, isLoaded, location, setLocation, userId]);

  if (isAuthCallbackRoute) return loadingScreen;
  if (isSignInRoute) return <SignIn />;
  if (isSignUpRoute) return <SignUp />;

  const isProtectedRoute = isIdentityProtectedPath(location);
  if (shouldShowAuthLoadingScreen(isProtectedRoute, isLoaded, userId, isLoaded)) return loadingScreen;

  // Admin area (except its login) is hidden from anonymous visitors.
  if (!userId && isAdminPath && !isAdminLogin) return <NotFound />;
  if (!isAdminPath && !isKnownMarketplaceRoute(location)) return <NotFound />;
  // A protected route without a session is being routed to /sign-in.
  if (!userId && isKnownMarketplaceRoute(location) && !isPublicMarketplaceRoute(location)) {
    return loadingScreen;
  }

  return (
    <LegalConsentGate enabled={Boolean(userId)}>
      <RoutedErrorBoundary>
        <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}>
        <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/listings">{() => <AdminGuard><AdminListings /></AdminGuard>}</Route>
        <Route path="/admin/rental-season">{() => <AdminGuard><AdminRentalSeason /></AdminGuard>}</Route>
        <Route path="/admin/banners">{() => <AdminGuard><AdminBanners /></AdminGuard>}</Route>
        <Route path="/admin/users">{() => <AdminGuard><AdminUsers /></AdminGuard>}</Route>
        <Route path="/admin/payments">{() => <AdminGuard><AdminPayments /></AdminGuard>}</Route>
        <Route path="/admin/notifications">{() => <AdminGuard><AdminNotifications /></AdminGuard>}</Route>
        <Route path="/admin/packages">{() => <AdminGuard><AdminPackages /></AdminGuard>}</Route>
        <Route path="/admin/payment-methods">{() => <AdminGuard><AdminPaymentMethods /></AdminGuard>}</Route>
        <Route path="/admin/support-settings">{() => <AdminGuard><AdminSupportSettings /></AdminGuard>}</Route>
        <Route path="/admin/security">{() => <AdminGuard><AdminSecurity /></AdminGuard>}</Route>
        <Route path="/admin/reports">{() => <AdminGuard><AdminReports /></AdminGuard>}</Route>
        <Route path="/admin/audit-logs">{() => <AdminGuard><AdminAuditLogs /></AdminGuard>}</Route>
        <Route path="/admin/categories">{() => <AdminGuard><AdminCategories /></AdminGuard>}</Route>
        <Route path="/admin/regions">{() => <AdminGuard><AdminRegions /></AdminGuard>}</Route>
        <Route path="/admin">{() => <AdminGuard><AdminOverview /></AdminGuard>}</Route>

        <Route path="/" component={Home} />
        <Route path="/listings" component={Listings} />
        <Route path="/listings/:id" component={ListingDetail} />
        <Route path="/sellers/:id" component={SellerProfile} />
        <Route path="/categories" component={Categories} />
        <Route path="/saved" component={Saved} />
        <Route path="/support" component={Support} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/reports/:id" component={ReportDetails} />
        <Route path="/payments" component={PaymentsRoute} />
        <Route path="/dashboard/active-listings" component={SellerActiveListings} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/account" component={Account} />
        <Route path="/add-listing" component={AddListing} />
        <Route component={NotFound} />
        </Switch>
      </Suspense>
      </RoutedErrorBoundary>
    </LegalConsentGate>
  );
}

// Clears user-scoped cached data when the signed-in identity changes, and
// refreshes public listing data so saved-state flags are recomputed.
function QueryCacheIdentityReset() {
  const { isLoaded, userId } = useAuth();
  const previousUserRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const current = userId ?? null;
    if (previousUserRef.current !== undefined && previousUserRef.current !== current) {
      for (const query of queryClient.getQueryCache().getAll()) {
        if (!isPublicMarketplaceQueryKey(query.queryKey)) {
          queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
          continue;
        }
        if (isPublicListingDataQueryKey(query.queryKey) && query.state.data !== undefined) {
          queryClient.setQueryData(
            query.queryKey,
            clearSavedStateFromPublicListingData(query.state.data),
          );
        }
      }
      void queryClient.invalidateQueries({
        predicate: (query) => isPublicListingDataQueryKey(query.queryKey),
      });
    }
    previousUserRef.current = current;
  }, [isLoaded, userId]);

  return null;
}

// The sign-up form collects phone (and keeps the entered name) locally rather
// than sending them to Authentik; this applies that stash exactly once, the
// first time a real authenticated session shows up after sign-up completes.
function PendingSignupProfileSync() {
  const { isLoaded, userId } = useAuth();
  const applied = useRef(false);

  useEffect(() => {
    if (!isLoaded || !userId || applied.current) return;
    const pending = takePendingSignupProfile();
    if (!pending) return;
    applied.current = true;
    void updateMyAccountProfile(pending).catch(() => {
      // Best-effort: the account still exists and works without this: the
      // user can add their phone again from account settings.
    });
  }, [isLoaded, userId]);

  return null;
}

function ApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const tokenGetter = useRef(getToken);
  tokenGetter.current = getToken;
  const authReady = useRef(isLoaded);
  authReady.current = isLoaded;
  const [registered, setRegistered] = useState(false);

  useLayoutEffect(() => {
    // Public queries must not await identity initialization. Protected routes
    // stay gated in Router; register the real getter before mounting them.
    setAuthTokenGetter(async () => {
      if (!authReady.current) return null;
      try {
        return await tokenGetter.current();
      } catch {
        return null;
      }
    });
    setRegistered(true);
    return () => setAuthTokenGetter(null);
  }, []);

  return registered ? children : null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ProviderWithRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiAuthBridge>
        <QueryCacheIdentityReset />
        <PendingSignupProfileSync />
        <TooltipProvider>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}>
            <Router />
          </Suspense>
          <Toaster />
          <OfflineIndicator />
          <PwaInstallPrompt />
        </TooltipProvider>
      </ApiAuthBridge>
    </QueryClientProvider>
  );
}

function App() {
  useImageLoadingHints();
  return (
    <LanguageProvider>
      <WouterRouter base={basePath}>
        <ErrorBoundary>
          <AuthProvider>
            <ProviderWithRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </WouterRouter>
    </LanguageProvider>
  );
}

export default App;
