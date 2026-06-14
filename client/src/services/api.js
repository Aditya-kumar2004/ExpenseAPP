import axios from 'axios';

let apiBase = import.meta.env.VITE_API_URL || '/api';
if (apiBase.startsWith('http') && !apiBase.endsWith('/api') && !apiBase.endsWith('/api/')) {
  apiBase = apiBase.endsWith('/') ? `${apiBase}api` : `${apiBase}/api`;
}

const api = axios.create({
  baseURL: apiBase,
  withCredentials: true, // send httpOnly refresh cookie
});

// Attach access token from memory to every request
api.interceptors.request.use((config) => {
  const token = window.__accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, try refresh → retry once
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Do not attempt to refresh if the request was already to an auth endpoint
    if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login') || original.url?.includes('/auth/register')) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true });
        if (data.success) {
          window.__accessToken = data.data.accessToken;
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        }
      } catch {
        // refresh failed — redirect to login if not already there
        window.__accessToken = null;
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
