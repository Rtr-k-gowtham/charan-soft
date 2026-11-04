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
    const storedUser = localStorage.getItem('cheran_user');
    const token = localStorage.getItem('cheran_token');

    if (
      storedUser &&
      token &&
      token.trim() !== '' &&
      token !== 'undefined' &&
      token !== 'null'
    ) {
      try {
        const u = JSON.parse(storedUser);
        if (u && (u.id || u.email || u.name)) {
          setUser(u);
        } else {
          localStorage.removeItem('cheran_token');
          localStorage.removeItem('cheran_user');
          setUser(null);
        }
      } catch {
        localStorage.removeItem('cheran_token');
        localStorage.removeItem('cheran_user');
        setUser(null);
      }
    } else {
      localStorage.removeItem('cheran_token');
      localStorage.removeItem('cheran_user');
      setUser(null);
    }
    setIsLoading(false);

    // Listen for global 401 unauthorized signals from api.ts
    const handleUnauthorized = () => {
      localStorage.removeItem('cheran_token');
      localStorage.removeItem('cheran_user');
      setUser(null);
    };

    window.addEventListener('cheran_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('cheran_unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password) as any;
    const token = res?.token || res?.data?.token || res?.accessToken || '';
    const userData = res?.user || (res?.id ? res : (res?.data?.user || res?.data || {}));

    if (!token) {
      throw new Error('Authentication succeeded but access token was not returned.');
    }

    const fullUser = {
      ...userData,
      token,
    } as User;

    localStorage.setItem('cheran_token', token);
    localStorage.setItem('cheran_user', JSON.stringify(fullUser));
    setUser(fullUser);
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
