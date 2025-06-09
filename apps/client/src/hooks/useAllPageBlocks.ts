import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const useAllPageBlocks = (pageId: string) => {
  return useQuery({
    queryKey: ['allPageBlocks', pageId],
    queryFn: async () => {
      const res = await axios.get(`/api/pages/${pageId}/blocksWithPermissions`);
      return res.data;
    },
    enabled: !!pageId,
  });
};




