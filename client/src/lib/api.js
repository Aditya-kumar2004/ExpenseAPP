import axios from 'axios'

let apiBase = import.meta.env.VITE_API_URL || '/api';
if (apiBase.startsWith('http') && !apiBase.endsWith('/api') && !apiBase.endsWith('/api/')) {
  apiBase = apiBase.endsWith('/') ? `${apiBase}api` : `${apiBase}/api`;
}

const api = axios.create({
  baseURL:         apiBase,
  withCredentials: true, // send httpOnly refresh cookie
  headers:         { 'Content-Type': 'application/json' },
})

// ─── Request interceptor: attach access token ────────────────────────────────
// We use a module-level ref pattern to avoid circular import with AuthContext
let _getToken    = null
let _refreshFn   = null
let _onLogout    = null

export function setApiHandlers({ getToken, refreshFn, onLogout }) {
  _getToken  = getToken
  _refreshFn = refreshFn
  _onLogout  = onLogout
}

api.interceptors.request.use((config) => {
  const token = _getToken?.()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response interceptor: auto-refresh on 401 ───────────────────────────────
let isRefreshing = false
let failedQueue  = []

function processQueue(error, token = null) {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  r => r,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(token => {
            original.headers.Authorization = `Bearer ${token}`
            return api(original)
          })
          .catch(err => Promise.reject(err))
      }

      original._retry = true
      isRefreshing    = true

      try {
        const newToken = await _refreshFn?.()
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (err) {
        processQueue(err, null)
        _onLogout?.()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
