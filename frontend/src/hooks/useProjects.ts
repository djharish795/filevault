import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await apiClient.get('/projects');
      return data.data;
    },
    staleTime: 0,        // Always refetch — reflects admin access changes immediately
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useProjectDetails = (id: string) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}`);
      return data.data;
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
