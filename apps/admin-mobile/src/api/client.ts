import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { ENV } from "../config/env";

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

type TokenResolver = () => string | null;
type UnauthorizedHandler = () => void;

let resolveToken: TokenResolver = () => null;
let onUnauthorized: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;

export const setAuthTokenResolver = (resolver: TokenResolver) => {
  resolveToken = resolver;
};

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  onUnauthorized = handler;
};

export const apiClient = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: ENV.apiTimeoutMs,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = resolveToken();
  if (token) {
    const headers = config.headers as
      | { set?: (key: string, value: string) => void }
      | undefined;
    if (headers?.set) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      } as never;
    }
  }
  return config;
});

const normalizeApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    const message =
      axiosError.response?.data?.error ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      "Error de red";
    const apiError = new Error(message) as ApiError;
    apiError.name = "ApiError";
    apiError.status = axiosError.response?.status;
    apiError.code = axiosError.code;
    apiError.details = axiosError.response?.data;
    return apiError;
  }

  const fallback = new Error("Error inesperado") as ApiError;
  fallback.name = "ApiError";
  fallback.details = error;
  return fallback;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url || "";
      const isLoginRequest = url.includes("/auth/login");
      if (!isLoginRequest && onUnauthorized && !isHandlingUnauthorized) {
        isHandlingUnauthorized = true;
        Promise.resolve()
          .then(() => onUnauthorized?.())
          .finally(() => {
            isHandlingUnauthorized = false;
          });
      }
    }
    return Promise.reject(normalizeApiError(error));
  }
);

export const request = async <T>(config: AxiosRequestConfig) => {
  const response = await apiClient.request<T>(config);
  return response.data;
};
