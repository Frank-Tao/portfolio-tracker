import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@portfolio/shared';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<{ success: boolean; message?: string; dev_token?: string }>;
  verifyToken: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const disableAuth = (import.meta.env.VITE_DISABLE_AUTH ?? 'false') === 'true';
const demoUser: User = {
  id: 1,
  email: 'demo@portfolio.local',
  name: 'Demo User',
  is_admin: 1,
  created_at: new Date().toISOString(),
  last_login: new Date().toISOString(),
};

async function parseJsonSafely(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function apiRequest(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, { credentials: 'include', ...init });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (disableAuth) {
      setUser(demoUser);
      setLoading(false);
      return;
    }
    apiRequest('/api/auth/me')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string) => {
    if (disableAuth) {
      setUser({ ...demoUser, email: email.trim().toLowerCase() || demoUser.email });
      return { success: true, message: 'Auth disabled in demo mode', dev_token: '000000' };
    }
    return apiRequest('/api/auth/request-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  };

  const verifyToken = async (email: string, token: string) => {
    if (disableAuth) {
      setUser({ ...demoUser, email: email.trim().toLowerCase() || demoUser.email });
      return { success: true };
    }
    try {
      const data = await apiRequest('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      if (data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: 'Verification failed' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Verification failed' };
    }
  };

  const logout = async () => {
    if (disableAuth) {
      setUser(demoUser);
      return;
    }
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (name: string) => {
    if (disableAuth) {
      setUser(prev => prev ? { ...prev, name } : { ...demoUser, name });
      return;
    }
    const data = await apiRequest('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (data.user) {
      setUser(data.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyToken, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
