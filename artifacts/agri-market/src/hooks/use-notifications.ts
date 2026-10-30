import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

export type MarketplaceNotification = {
  id: number;
  userId: number;
  listingId: number | null;
  reportId: number | null;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  items: MarketplaceNotification[];
  unreadCount: number;
};

async function fetchNotifications(getToken: () => Promise<string | null>): Promise<NotificationsResponse> {
  const token = await getToken();
  const response = await fetch('/api/notifications', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error('Could not load notifications');
  return response.json();
}

export function useMarketplaceNotifications() {
  const { isLoaded, userId, getToken } = useAuth();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(getToken),
    enabled: isLoaded && Boolean(userId),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkMarketplaceNotificationRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Could not mark notification as read');
      return response.json() as Promise<MarketplaceNotification>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}