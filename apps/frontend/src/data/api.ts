// =====================================================
// Axios API Client - 拦截器 + Token 刷新
// =====================================================

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../stores/auth.store';

// baseURL 含 /api,版本号 /v1 由拦截器注入(避免双重 /v1)
// 开发期:5173 vite proxy → 3030 后端
// 生产期:nginx 反代 /api 后挂相同后端
const baseURL = '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 拦截器:强制注入 /v1(后端 NestJS API_VERSIONING=URI,prefix=api/v)
api.interceptors.request.use((config) => {
  if (
    config.url &&
    typeof config.url === 'string' &&
    config.url.startsWith('/') &&
    !config.url.startsWith('/v1')
  ) {
    config.url = `/v1${config.url}`;
  }
  return config;
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
          const { data } = await axios.post(`${baseURL}/v1/auth/refresh`, { refreshToken });
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