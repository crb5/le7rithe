import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { AuthProvider, useAuth, useSignInRedirect } from '@/lib/auth';
import { ErrorBoundary } from '@/components/error-boundary';
import { Spinner } from '@/components/ui/spinner';
import { useImageLoadingHints } from '@/components/viewport-image';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/lib/language';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import { LegalConsentGate } from '@/components/legal-consent-gate';
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
import { Route, Switch, useLocation, useSearch, Router as WouterRouter } from 'wouter';

const Account = lazy(() => import('@/pages/marketplace-account').then(m => ({ default: m.Account })));
const AddListing = lazy(() => import('@/pages/add-listing').then(m => ({ default: m.AddListing })));
const Dashboard = lazy(() => import('@/pages/marketplace-dashboard').then(m => ({ default: m.Dashboard })));
const Listings = lazy(() => import('@/pages/marketplace-listings').then(m => ({ default: m.Listings })));
const SellerActiveListings = lazy(() => import('@/pages/marketplace-seller-active-listings').then(m => ({ default: m.SellerActiveListings })));
const Support = lazy(() => import('@/pages/marketplace-support').then(m => ({ default: m.Support })));
const Saved = lazy(() => import('@/pages/marketplace-saved').then(m => ({ default: m.Saved })));
const AdminGuard = lazy(() => import('@/components/admin-ui').then(m => ({ default: m.AdminGuard })));
const AdminLogin = lazy(() => import('@/pages/admin/login').then(m => ({ default: m.AdminLogin })));
const ListingDetail = lazy(() => import('@/pages/listing-detail').then((module) => ({ default: module.ListingDetail })));
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
    || path === '/categories'
    || path.startsWith('/categories/')
    || path === '/privacy'
    || path === '/terms'
    || path === '/add-listing';
}

function isKnownMarketplaceRoute(path: string): boolean {
  return isPublicMarketplaceRoute(path)
    || ['/saved', '/support', '/notifications', '/payments', '/dashboard',
      '/dashboard/active-listings', '/account'].includes(path)
    || /^\/reports\/[^/]+$/.test(path);
}

const loadingScreen = (
  <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))]"><Spinner /></div>
);

function Router() {
  const { isLoaded, userId } = useAuth();
  const signInRedirect = useSignInRedirect();
  const [location, setLocation] = useLocation();
  const search = useSearch();

  const isAuthCallbackRoute = location.startsWith('/auth/callback');
  const isSignInRoute = location === '/sign-in' || location.startsWith('/sign-in/');
  const isSignUpRoute = location === '/sign-up' || location.startsWith('/sign-up/');
  const isAuthRoute = isSignInRoute || isSignUpRoute;
  const isAdminPath = location === '/admin' || location.startsWith('/admin/');
  const isAdminLogin = location === '/admin/login';
  const redirectPath = signupReturnPath(search, 'redirect_url');

  // Sign-in / sign-up now redirect to the identity provider.
  useEffect(() => {
    if (!isLoaded) return;
    if (userId) {
      if (isAuthRoute) setLocation(redirectPath, { replace: true });
      return;
    }
    if (isAuthRoute) {
      void signInRedirect(redirectPath);
      return;
    }
    // A protected (known, non-public, non-admin) route requires sign-in.
    if (
      isKnownMarketplaceRoute(location) &&
      !isPublicMarketplaceRoute(location) &&
      !isAdminPath
    ) {
      void signInRedirect(location);
    }
  }, [isAuthRoute, isAdminPath, isLoaded, location, redirectPath, setLocation, signInRedirect, userId]);

  if (isAuthCallbackRoute) return loadingScreen;

  const isProtectedRoute = isIdentityProtectedPath(location);
  if (shouldShowAuthLoadingScreen(isProtectedRoute, isLoaded, userId, isLoaded)) return loadingScreen;

  // Admin area (except its login) is hidden from anonymous visitors.
  if (!userId && isAdminPath && !isAdminLogin) return <NotFound />;
  // Auth routes are mid-redirect; render nothing.
  if (isAuthRoute) return loadingScreen;
  if (!isAdminPath && !isKnownMarketplaceRoute(location)) return <NotFound />;
  // A protected route without a session is redirecting to the IdP.
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
        <Route path="/admin">{() => <AdminGuard><AdminOverview /></AdminGuard>}</Route>

        <Route path="/" component={Home} />
        <Route path="/listings" component={Listings} />
        <Route path="/listings/:id" component={ListingDetail} />
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
        <TooltipProvider>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}>
            <Router />
          </Suspense>
          <Toaster />
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
