"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../api/client';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if token exists in localStorage on initial load
    const storedToken = localStorage.getItem('token');
    
    if (storedToken) {
      setToken(storedToken);
      fetchUserProfile(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = async (currentToken: string) => {
    setProfileError(false);
    try {
      // The API client interceptor will attach the token
      const response = await apiClient.get('auth/profile');
      if (response.data.success && response.data.user) {
        setUser(response.data.user);
      } else {
        // Token might be invalid or expired
        handleLogout();
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) handleLogout();
      else setProfileError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    router.push('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout: handleLogout, isLoading }}>
      {profileError ? <div role="alert" className="p-8 text-center space-y-4"><p>Could not connect to your account. Your login and saved interviews are retained.</p><button className="underline" onClick={() => fetchUserProfile(token || '')}>Retry connection</button></div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
