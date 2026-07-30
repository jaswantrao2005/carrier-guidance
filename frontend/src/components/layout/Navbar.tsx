"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { BrainCircuit, LogOut, LayoutDashboard, UploadCloud } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/Button';

export const Navbar = () => {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isAuthPage) return null; // Don't show navbar on login/register pages

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg text-slate-900 dark:text-white tracking-tight">
            Career<span className="text-primary-600 dark:text-primary-400">AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-4">
          {!isLoading && user ? (
            <>
              <Link 
                href="/dashboard" 
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  pathname.startsWith('/dashboard') 
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              
              <Link 
                href="/resume-upload" 
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  pathname === '/resume-upload' 
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900'
                }`}
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                Upload
              </Link>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2" />
              
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </>
          ) : !isLoading ? (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors px-3 py-2">
                Log in
              </Link>
              <Link href="/register">
                <Button size="sm" variant="primary">Get Started</Button>
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
};
