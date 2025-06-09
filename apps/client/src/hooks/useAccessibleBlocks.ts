import { useQuery } from '@tanstack/react-query';
import { getAccessibleBlocks } from '@/lib/api-client';
import axios from 'axios';

export const useAccessibleBlocks = (pageId: string, userId: string) => {
  return useQuery({
    queryKey: ['accessibleBlocks', pageId, userId],
    queryFn: async () => {
      const res = await axios.get(`/api/pages/${pageId}/blockPermissions`, {
        params: { userId },
      });
      console.log('Ответ от blockPermissions:', res.data);
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: !!pageId && !!userId,
  });
};


