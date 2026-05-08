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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string) => {
    const res = await fetch('/api/auth/request-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });
    return res.json();
  };

  const verifyToken = async (email: string, token: string) => {
    const res = await fetch('/api/auth/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      return { success: true };
    }
    return { success: false, error: data.error || 'Verification failed' };
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const updateProfile = async (name: string) => {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
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
