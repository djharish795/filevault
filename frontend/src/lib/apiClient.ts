import axios from 'axios';
import { useAuthStore } from '@/features/auth/store';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // For HTTP-only refresh tokens
});

// Attach Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log(`🚀 API Request: [${config.method?.toUpperCase()}] ${config.url}`, config.data || '');
  return config;
});

// Handle 401 Refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: [${response.config.method?.toUpperCase()}] ${response.config.url}`, response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log(`🔄 Session expired, attempting refresh... [${originalRequest.method?.toUpperCase()}] ${originalRequest.url}`);
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        
        // Backend wraps response: { success: true, data: { accessToken } }
        const newToken = data.data?.accessToken ?? data.accessToken;
        if (!newToken) throw new Error('No token in refresh response');

        useAuthStore.getState().setAuth(newToken, useAuthStore.getState().user!);
        apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
        processQueue(null, newToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login'; // Hard redirect to clear stale state
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    console.error(`❌ API Error: [${error.config?.method?.toUpperCase()}] ${error.config?.url}`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);
