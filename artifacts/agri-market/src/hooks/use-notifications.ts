import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';

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

async function fetchNotifications(): Promise<NotificationsResponse> {
  const response = await fetch('/api/notifications', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Could not load notifications');
  return response.json();
}

export function useMarketplaceNotifications() {
  const { isLoaded, userId } = useAuth();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: isLoaded && Boolean(userId),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkMarketplaceNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Could not mark notification as read');
      return response.json() as Promise<MarketplaceNotification>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}