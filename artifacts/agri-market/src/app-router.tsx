import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Spinner } from '@/components/ui/spinner';
import { useImageLoadingHints } from '@/components/viewport-image';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider, useLanguage } from '@/lib/language';
import { signupReturnPath } from '@/lib/signup-contact-flow';
import { LegalConsentGate } from '@/components/legal-consent-gate';
import { readPendingLegalConsent } from '@/lib/legal-consent-flow';
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
const SignInPage = lazy(() => import('./auth-pages').then(m => ({ default: m.SignInPage })));
const PhoneLinkAfterSignup = lazy(() => import('@/components/phone-link-after-signup').then(m => ({ default: m.PhoneLinkAfterSignup })));
const EmailLinkAfterSignup = lazy(() => import('@/components/email-link-after-signup').then(m => ({ default: m.EmailLinkAfterSignup })));
const PhoneSignupNamePage = lazy(() => import('./auth-pages').then(m => ({ default: m.PhoneSignupNamePage })));
const SignUpPage = lazy(() => import('./auth-pages').then(m => ({ default: m.SignUpPage })));
const PublishAuthPrompt = lazy(() => import('./auth-pages').then(m => ({ default: m.PublishAuthPrompt })));


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

// External Clerk is selected only by the owner's explicit key, never the
// Replit preview/custom hostname or a managed Clerk proxy.
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;


function PaymentsRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!ENABLE_PAID_LISTINGS) setLocation('/');
  }, [setLocation]);
  return ENABLE_PAID_LISTINGS ? <Payments /> : null;
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}


const phoneNameCompletionRoute = '/account/complete-phone-profile';


function authRoute(path: '/sign-in' | '/sign-up', redirectPath: string): string {
  return `${path}?redirect_url=${encodeURIComponent(redirectPath)}`;
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
      '/dashboard/active-listings', '/account', phoneNameCompletionRoute].includes(path)
    || /^\/reports\/[^/]+$/.test(path);
}


function Router() {
  const { t } = useLanguage();
  const { isLoaded, userId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const requiresPhoneName = user?.publicMetadata.phoneSignInNeedsName === true;
  const isSignUpRoute = location === '/sign-up' || location.startsWith('/sign-up/');
  const isSignInRoute = location === '/sign-in' || location.startsWith('/sign-in/');
  const isPhoneSignupLinkRoute = location.startsWith('/account/complete-signup-phone');
  const isEmailSignupLinkRoute = location.startsWith('/account/complete-signup-email');
  const isAdminPath = location === '/admin' || location.startsWith('/admin/');
  const isAuthRoute = isSignInRoute || isSignUpRoute;
  const isAddListingRoute = location === '/add-listing';
  const pendingSignup = isSignUpRoute ? readPendingLegalConsent() : null;
  const redirectPath = pendingSignup?.redirectPath ?? signupReturnPath(search, 'redirect_url');
  const phoneNameReturnPath = signupReturnPath(search);

  useEffect(() => {
    if (!isLoaded || (userId && !isUserLoaded)) return;
    if (userId && requiresPhoneName) {
      if (!location.startsWith(phoneNameCompletionRoute)) {
        const target = redirectPath.startsWith(phoneNameCompletionRoute)
          ? redirectPath
          : `${phoneNameCompletionRoute}?return_to=${encodeURIComponent(
            isEmailSignupLinkRoute || isPhoneSignupLinkRoute ? `${location}${search ? `?${search}` : ''}` : redirectPath,
          )}`;
        setLocation(target, { replace: true });
      }
    } else if (userId && location.startsWith(phoneNameCompletionRoute)) {
      setLocation(phoneNameReturnPath, { replace: true });
    } else if (!userId && isKnownMarketplaceRoute(location) && !isAdminPath && !isAuthRoute && !isPhoneSignupLinkRoute && !isEmailSignupLinkRoute && !isPublicMarketplaceRoute(location)) {
      setLocation(authRoute('/sign-in', location), { replace: true });
    } else if (userId && (isSignInRoute || (isSignUpRoute && !isPhoneSignupLinkRoute))) {
      setLocation(redirectPath, { replace: true });
    }
  }, [isAdminPath, isAuthRoute, isLoaded, isUserLoaded, isSignInRoute, isSignUpRoute, isPhoneSignupLinkRoute, isEmailSignupLinkRoute, location, search, phoneNameReturnPath, redirectPath, requiresPhoneName, setLocation, userId]);

  // Only browsing can paint before identity is known. Publishing, account and
  // administration still wait for the original authentication/consent guards.
  const isProtectedRoute = isIdentityProtectedPath(location);
  if (shouldShowAuthLoadingScreen(isProtectedRoute, isLoaded, userId, isUserLoaded)) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))]"><Spinner /></div>;
  if (!userId && isAdminPath) return <NotFound />;
  if (!isAuthRoute && !isAdminPath && !isPhoneSignupLinkRoute && !isEmailSignupLinkRoute && !isKnownMarketplaceRoute(location)) return <NotFound />;
  if (userId && requiresPhoneName) {
    return (
      <LegalConsentGate enabled>
        <RoutedErrorBoundary>
          <PhoneSignupNamePage />
        </RoutedErrorBoundary>
      </LegalConsentGate>
    );
  }
  if (isPhoneSignupLinkRoute || isEmailSignupLinkRoute) {
    return userId ? (
      <LegalConsentGate enabled>
        <RoutedErrorBoundary>
          {isEmailSignupLinkRoute ? <EmailLinkAfterSignup /> : <PhoneLinkAfterSignup />}
        </RoutedErrorBoundary>
      </LegalConsentGate>
    ) : null;
  }
  if (!userId) {
    if (isSignUpRoute) return <SignUpPage redirectPath={redirectPath} />;
    if (isSignInRoute) return <SignInPage />;
    if (isAddListingRoute) return <PublishAuthPrompt />;
    if (!isPublicMarketplaceRoute(location)) return null;
  }
  if (isAuthRoute) return null;

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
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


function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const { isLoaded, userId } = useAuth();
  const previousUserRef = useRef<string | null | undefined>(undefined);
  const shouldRefreshPublicListingsRef = useRef(false);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        previousUserRef.current !== undefined &&
        previousUserRef.current !== userId
      ) {
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
        shouldRefreshPublicListingsRef.current = true;
      }
      previousUserRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  useEffect(() => {
    if (!isLoaded || !shouldRefreshPublicListingsRef.current) return;
    shouldRefreshPublicListingsRef.current = false;
    void queryClient.invalidateQueries({
      predicate: (query) => isPublicListingDataQueryKey(query.queryKey),
    });
  }, [isLoaded, userId]);

  return null;
}


function ClerkApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const tokenGetter = useRef(getToken);
  tokenGetter.current = getToken;
  const authReady = useRef(isLoaded);
  authReady.current = isLoaded;
  const [registered, setRegistered] = useState(false);

  useLayoutEffect(() => {
    // Public queries must not await Clerk's remote SDK/token initialization.
    // Protected routes stay gated in Router; register the real getter before
    // mounting them when identity becomes ready.
    setAuthTokenGetter(async () => {
      if (!authReady.current) return null;
      try {
        return await tokenGetter.current();
      } catch {
        // A transient Clerk token-refresh failure should not prevent a
        // same-origin request from using the browser's session cookies.
        console.warn('[api-auth] Session token retrieval failed; continuing with same-origin credentials.');
        return null;
      }
    });
    setRegistered(true);
    return () => setAuthTokenGetter(null);
  }, []);

  // Protected query hooks can start fetching as soon as their components
  // render. Register the token getter before rendering those components so
  // the first request cannot race the auth bridge effect.
  // Keep the same public subtree when Clerk becomes ready: remounting here
  // would reset search input and restart the hero's entry animation/LCP.
  return registered ? children : null;
}


function ClerkProfileNameSynchronizer() {
  const { isLoaded, user } = useUser();
  const firstName = typeof user?.unsafeMetadata?.firstName === 'string'
    ? user.unsafeMetadata.firstName.trim()
    : '';
  const lastName = typeof user?.unsafeMetadata?.lastName === 'string'
    ? user.unsafeMetadata.lastName.trim()
    : '';

  useEffect(() => {
    if (!isLoaded || !user || !firstName || !lastName) return;
    if (user.firstName === firstName && user.lastName === lastName) return;
    void user.update({ firstName, lastName }).catch((error) => {
      console.error(
        'Clerk profile name sync failed. Enable first_name and last_name in the active Clerk instance.',
        error,
      );
    });
  }, [firstName, isLoaded, lastName, user]);

  return null;
}


function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}


function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const [presentation, setPresentation] = useState<typeof import('@/lib/clerkTheme') | null>(null);
  const [presentationError, setPresentationError] = useState<Error | null>(null);
  const needsPresentation = location.startsWith('/sign-in') || location.startsWith('/sign-up');
  useEffect(() => {
    if (!needsPresentation || presentation) return;
    let active = true;
    void import('@/lib/clerkTheme').then(module => {
      if (active) setPresentation(module);
    }).catch(() => {
      if (active) setPresentationError(new Error('Unable to load sign-in presentation'));
    });
    return () => { active = false; };
  }, [needsPresentation, presentation]);
  if (needsPresentation && presentationError) throw presentationError;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={presentation?.clerkAppearance}
      localization={presentation?.clerkLocalizationByLanguage[language]}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkApiAuthBridge>
          <ClerkQueryClientCacheInvalidator />
          <ClerkProfileNameSynchronizer />
          <TooltipProvider>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}>
            {!needsPresentation || presentation ? <Router /> : <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}
          </Suspense>
              <Toaster />
          </TooltipProvider>
        </ClerkApiAuthBridge>
      </QueryClientProvider>
    </ClerkProvider>
  );
}


function App() {
  useImageLoadingHints();
  return (
    <LanguageProvider>
      <WouterRouter base={basePath}>
        <ErrorBoundary><ClerkProviderWithRoutes /></ErrorBoundary>
      </WouterRouter>
    </LanguageProvider>
  );
}


export default App;