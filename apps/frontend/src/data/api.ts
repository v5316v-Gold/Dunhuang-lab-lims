// =====================================================
// Axios API Client - 拦截器 + Token 刷新
// =====================================================

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../stores/auth.store';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器:附加 JWT
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器:统一错误处理 + Token 刷新
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const { response } = error;
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 → 尝试刷新 token
    if (response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

          originalRequest.headers!.set('Authorization', `Bearer ${data.accessToken}`);
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    // 错误提示
    const errorMessage = response?.data?.message ?? error.message ?? '请求失败';
    message.error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));

    return Promise.reject(error);
  },
);