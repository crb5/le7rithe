import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useLanguage } from '@/lib/language';
import { useAuth } from '@/lib/auth';
import {
  getGetMyAccountProfileQueryKey,
  getListBannersQueryKey,
  getListCategoriesQueryKey,
  getListListingsQueryKey,
  getListLocationsQueryKey,
} from '@workspace/api-client-react';

export function useAdminFetch() {
  const { t } = useLanguage();
  const { getToken } = useAuth();
  return useCallback(async (path: string, options?: RequestInit) => {
    // Admin routes authenticate with the OIDC bearer token, like every other
    // API call. (The admin session cookie alone is not enough.)
    const token = await getToken();
    const res = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({})) as { error?: string; code?: string };
      const requestError = new Error(error.error || t('serverConnectionError')) as Error & {
        code?: string;
        status?: number;
      };
      requestError.code = error.code;
      requestError.status = res.status;
      throw requestError;
    }
    if (res.status === 204) return null;
    return res.json();
  }, [t, getToken]);
}

export function useAdminMe() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-me'],
    queryFn: () => fetcher('/admin/me'),
    staleTime: 0,
  });
}

export type AdminMe = {
  authenticated: boolean;
  role: string;
  user: { id: number; name: string; email: string | null } | null;
  passwordConfigured: boolean;
  passwordSetupStatus: 'configured' | 'ready' | 'missing-secret' | 'invalid-secret' | null;
  adminSessionActive: boolean;
  passwordPolicy: {
    minimumLength: number;
    maximumLength: number;
    sessionHours: number;
    maxFailedAttempts: number;
    lockoutMinutes: number;
  };
};

export function useAdminPasswordLogin() {
  const fetcher = useAdminFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      fetcher('/admin/password/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-me'] });
    },
  });
}

export function useAdminPasswordLogout() {
  const fetcher = useAdminFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetcher('/admin/password/logout', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-me'] });
    },
  });
}

export function useAdminPasswordChange() {
  const fetcher = useAdminFetch();
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      fetcher('/admin/password/change', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useAdminOverview() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetcher('/admin/overview'),
  });
}

export type AdminNotification = {
  id: number;
  listingId: number | null;
  reportId: number | null;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  listingTitle: string | null;
  sellerName: string | null;
  sellerVerified: boolean;
  listingCreatedAt: string;
  listingStatus: string | null;
  paymentStatus: string;
  reportStatus: string | null;
};

export type AdminNotificationFilter = 'all' | 'listings' | 'reports';

export type AdminNotificationResponse = {
  items: AdminNotification[];
  unreadCount: number;
  unreadCounts: Record<AdminNotificationFilter, number>;
  hasMore: boolean;
  nextCursor: AdminNotificationCursor | null;
};

export type AdminNotificationCursor = {
  createdAt: string;
  id: number;
};

export function useAdminNotifications(filter: AdminNotificationFilter = 'all') {
  const fetcher = useAdminFetch();
  return useInfiniteQuery<AdminNotificationResponse, Error, InfiniteData<AdminNotificationResponse>, ['admin-notifications', AdminNotificationFilter], AdminNotificationCursor | null>({
    queryKey: ['admin-notifications', filter],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ filter });
      if (pageParam) {
        params.set('beforeCreatedAt', pageParam.createdAt);
        params.set('beforeId', String(pageParam.id));
      }
      return fetcher(`/admin/notifications?${params.toString()}`);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkAdminNotificationRead() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher(`/admin/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });
}

export function useAdminListings(params: Record<string, string | number>) {
  const fetcher = useAdminFetch();
  const search = new URLSearchParams(params as any).toString();
  return useQuery({
    queryKey: ['admin-listings', search],
    queryFn: () => fetcher(`/admin/listings?${search}`),
  });
}

export type AdminBanner = {
  id: number;
  title: string | null;
  subtitle: string | null;
  additionalText: string | null;
  imagePath: string | null;
  imageAlt: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  targetUrl: string | null;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BannerInput = {
  title?: string | null;
  subtitle?: string | null;
  additionalText?: string | null;
  imagePath?: string | null;
  imageAlt?: string | null;
  ctaLabel?: string | null;
  targetUrl?: string | null;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
};

export function useAdminBanners() {
  const fetcher = useAdminFetch();
  return useQuery<{ items: AdminBanner[] }>({
    queryKey: ['admin-banners'],
    queryFn: () => fetcher('/admin/banners'),
  });
}

export function useCreateBanner() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BannerInput) => fetcher('/admin/banners', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-banners'] }),
        qc.invalidateQueries({ queryKey: getListBannersQueryKey() }),
      ]);
    },
  });
}

export function useUpdateBanner() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<BannerInput> }) => fetcher(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-banners'] }),
        qc.invalidateQueries({ queryKey: getListBannersQueryKey() }),
      ]);
    },
  });
}

export function useDeleteBanner() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetcher(`/admin/banners/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-banners'] }),
        qc.invalidateQueries({ queryKey: getListBannersQueryKey() }),
      ]);
    },
  });
}

export function useAdminUsers(params: Record<string, string | number>) {
  const fetcher = useAdminFetch();
  const search = new URLSearchParams(params as any).toString();
  return useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => fetcher(`/admin/users?${search}`),
  });
}

export function useAdminPayments(params: Record<string, string>) {
  const fetcher = useAdminFetch();
  const search = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ['admin-payments', search],
    queryFn: () => fetcher(`/admin/payments?${search}`),
  });
}

export function useAdminPackages() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-packages'],
    queryFn: () => fetcher('/admin/packages'),
  });
}

export function useAdminPaymentMethods() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: () => fetcher('/admin/payment-methods'),
  });
}

export function useAdminReports() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => fetcher('/admin/reports'),
  });
}

export function useAdminSupportSettings() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-support-settings'],
    queryFn: () => fetcher('/admin/support-settings'),
  });
}

export function useAdminAuditLogs() {
  const fetcher = useAdminFetch();
  return useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => fetcher('/admin/audit-logs'),
  });
}

// Mutations
export function useUpdateListingStatus() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: string; reason?: string }) =>
      fetcher(`/admin/listings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: (_data, variables) => {
      void fetcher(`/admin/notifications/listing/${variables.id}/read`, { method: 'PATCH' });
      qc.invalidateQueries({ queryKey: ['admin-listings'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      qc.invalidateQueries({ queryKey: ['admin-payments'] });
      qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      qc.invalidateQueries({ queryKey: getListLocationsQueryKey() });
      qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
    },
  });
}

export function useUpdateListingFeatured() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, featured, pinned }: { id: number; featured: boolean; pinned: boolean }) =>
      fetcher(`/admin/listings/${id}/featured`, {
        method: 'PATCH',
        body: JSON.stringify({ featured, pinned }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-listings'] }),
  });
}

export function useDeleteListing() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetcher(`/admin/listings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-listings'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      qc.invalidateQueries({ queryKey: getListLocationsQueryKey() });
      qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
    },
  });
}

export function useUpdateUserStatus() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetcher(`/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useUpdateUserVerification() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verified }: { id: number; verified: boolean }) =>
      fetcher(`/admin/users/${id}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({ verified }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      void qc.invalidateQueries({ queryKey: ['admin-listings'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
      void qc.invalidateQueries({ queryKey: ['admin-notifications'] });
      void qc.invalidateQueries({ queryKey: getGetMyAccountProfileQueryKey() });
      void qc.invalidateQueries({
        predicate: (query) => {
          const path = query.queryKey[0];
          return typeof path === 'string'
            && (path === '/api/listings' || path.startsWith('/api/listings/'));
        },
      });
    },
  });
}

export function useUpdatePaymentStatus() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: string; reason?: string }) =>
      fetcher(`/admin/payments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payments'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useCreatePackage() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      fetcher(`/admin/packages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-packages'] }),
  });
}

export function useUpdatePackage() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      fetcher(`/admin/packages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-packages'] }),
  });
}

export function useDeletePackage() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetcher(`/admin/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-packages'] }),
  });
}

export function useCreatePaymentMethod() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      fetcher(`/admin/payment-methods`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payment-methods'] }),
  });
}

export function useUpdatePaymentMethod() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      fetcher(`/admin/payment-methods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payment-methods'] }),
  });
}

export function useDeletePaymentMethod() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetcher(`/admin/payment-methods/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payment-methods'] }),
  });
}

export function useResolveReport() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, action }: { id: number; status: string; action?: string }) =>
      fetcher(`/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, action }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
}

export function useUpdateAdminSupportSettings() {
  const fetcher = useAdminFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: { phone: string; whatsappPhone: string }) =>
      fetcher('/admin/support-settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-support-settings'] });
      qc.invalidateQueries({ queryKey: ['support-settings'] });
    },
  });
}
