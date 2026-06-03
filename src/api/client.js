import axios from 'axios';
import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from './tokenStorage';

// REACT_APP_* values are baked in at build time. If REACT_APP_API_BASE_URL is
// missing for a production build, we fall back to the same origin under /api
// (works when frontend and backend share a host with a reverse proxy).
// In development we fall back to localhost:5000 for convenience.
const ENV_API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const DEV_FALLBACK = 'http://localhost:5000/api';
const SAME_ORIGIN_FALLBACK =
  typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';

const API_BASE_URL =
  ENV_API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? SAME_ORIGIN_FALLBACK : DEV_FALLBACK);

if (!ENV_API_BASE_URL && process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.warn(
    '[client] REACT_APP_API_BASE_URL not set at build time - falling back to ' +
    SAME_ORIGIN_FALLBACK
  );
}

const API_TIMEOUT_MS = Number(process.env.REACT_APP_API_TIMEOUT_MS) || 15000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT_MS,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          });

          const { access_token } = response.data.tokens;
          setAccessToken(access_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
