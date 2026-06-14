import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Attempt silent refresh on app load
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (data.success) {
          window.__accessToken = data.data.accessToken;
          setUser(data.data.user);
        }
      } catch {
        // No valid session — stay logged out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.success) {
      window.__accessToken = data.data.accessToken;
      setUser(data.data.user);
    }
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    if (data.success) {
      window.__accessToken = data.data.accessToken;
      setUser(data.data.user);
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    window.__accessToken = null;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
