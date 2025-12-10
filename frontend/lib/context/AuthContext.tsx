'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from sessionStorage on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('auth_token');
    const storedUser = sessionStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      try {
        setTokenState(storedToken);
        setUserState(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to restore session:', error);
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_user');
      }
    }

    setIsLoading(false);
  }, []);

  const login = (newUser: User, newToken: string) => {
    setUserState(newUser);
    setTokenState(newToken);
    sessionStorage.setItem('auth_token', newToken);
    sessionStorage.setItem('auth_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUserState(null);
    setTokenState(null);
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
  };

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      sessionStorage.setItem('auth_user', JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem('auth_user');
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
