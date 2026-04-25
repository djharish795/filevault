export interface User {
  id: string;
  email: string;
  name: string;
  isMasterAdmin: boolean;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: User;
  };
  error?: {
    code: string;
    message: string;
  };
}
