// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cheran_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u) {
          if (u.id === 1 || u.email === 'admin@cheransoftgoods.com' || u.name === 'K. Senthil Nathan') {
            u.name = 'Admin';
            u.username = 'admin';
            localStorage.setItem('cheran_user', JSON.stringify(u));
          }
          setUser(u);
        }
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password) as User;
    if (data && (data.id === 1 || data.email === 'admin@cheransoftgoods.com' || data.name === 'K. Senthil Nathan')) {
      data.name = 'Admin';
      (data as any).username = 'admin';
    }
    localStorage.setItem('cheran_token', data.token || '');
    localStorage.setItem('cheran_user', JSON.stringify(data));
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem('cheran_token');
    localStorage.removeItem('cheran_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
