// src/api/auth.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.mtgscan.cards'

export interface LoginResponse {
  message: string;
  access_token: string;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  google_linked: boolean;
  github_linked: boolean;
  has_password: boolean;
}

export const login = async (
  email: string,
  password: string,
  hcaptchaToken: string
): Promise<LoginResponse> => {
  const response = await axios.post<LoginResponse>(
    `${API_URL}/login`,
    { email, password, hcaptcha_token: hcaptchaToken },
    { withCredentials: true }
  );
  return response.data;
};

export const register = async (
  email: string,
  password: string,
  hcaptchaToken: string
) => {
  const response = await axios.post(
    `${API_URL}/register`,
    { email, password, hcaptcha_token: hcaptchaToken },
    { withCredentials: true }
  );
  return response.data;
};

export const refreshToken = async (): Promise<{ access_token: string; expires_at: string }> => {
  const response = await axios.post<{ access_token: string; expires_at: string }>(
    `${API_URL}/refresh`,
    {},                      // no body needed—the cookie is sent automatically
    { withCredentials: true }
  );
  return response.data;
};

export const logout = async (): Promise<{ message: string }> => {
  const response = await axios.post<{ message: string }>(
    `${API_URL}/logout`,
    {},                      // no body needed
    { withCredentials: true }
  );
  return response.data;
};

export const checkUserExists = async (email: string): Promise<boolean> => {
  const response = await axios.get<{ exists: boolean }>(
    `${API_URL}/user_exists?email=${encodeURIComponent(email)}`,
    { withCredentials: true }
  );
  return response.data.exists;
};