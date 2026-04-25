import { apiClient } from '@/lib/apiClient';
import type { LoginCredentials, AuthResponse } from '@/features/auth/types';

/**
 * Service to handle authentication related API calls.
 * Follows the Separation of Concerns principle.
 */
export const authService = {
  /**
   * authenticates a user and returns tokens/user data.
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Refreshes the access token using the HttpOnly cookie.
   */
  refresh: async (): Promise<{ accessToken: string }> => {
    const response = await apiClient.post<{ accessToken: string }>('/auth/refresh');
    return response.data;
  },

  /**
   * Log out the user remotely (if needed).
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  }
};
