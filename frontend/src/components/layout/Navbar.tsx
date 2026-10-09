"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrainCircuit, LogOut, LayoutDashboard, UploadCloud, Mic } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/Button';

export const Navbar = () => {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isCompactHome = pathname === '/';

  if (isAuthPage || pathname.startsWith('/interview/')) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 min-h-16 flex items-center justify-between ${isCompactHome ? 'flex-row gap-2 py-0' : 'flex-col lg:flex-row gap-2 lg:gap-0 py-3 lg:py-0'}`}>
        
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center space-x-2.5 group rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
          <div
            aria-hidden="true"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-violet-600 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-primary-500/30 group-hover:rotate-3 group-hover:scale-105 transition-transform border border-white/20"
          >
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">
            Career<span className="text-primary-500">AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className={`${isCompactHome ? 'w-auto flex-nowrap gap-1 sm:gap-3' : 'w-full lg:w-auto flex-wrap lg:flex-nowrap gap-1 lg:gap-4'} flex items-center justify-center`} aria-label="Main navigation">
          {!isLoading && user ? isCompactHome ? (
            <Link href="/dashboard" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-primary-700 dark:text-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
              Dashboard
            </Link>
          ) : (
            <>
              <Link 
                href="/dashboard" 
                className={`flex items-center px-3.5 py-2 text-sm font-semibold rounded-xl transition-all ${
                  pathname.startsWith('/dashboard') 
                    ? 'bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300 border border-primary-500/30' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>

              <Link 
                href="/mock-interview" 
                className={`flex items-center px-3.5 py-2 text-sm font-semibold rounded-xl transition-all ${
                  pathname.startsWith('/mock-interview') 
                    ? 'bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300 border border-primary-500/30' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
              >
                <Mic className="w-4 h-4 mr-2" />
                Mock Interview
              </Link>
              
              <Link 
                href="/resume-upload" 
                className={`flex items-center px-3.5 py-2 text-sm font-semibold rounded-xl transition-all ${
                  pathname === '/resume-upload' 
                    ? 'bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300 border border-primary-500/30' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                Upload Resume
              </Link>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
              
              <button
                onClick={logout}
                className="flex items-center px-3.5 py-2 text-sm font-semibold text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </>
          ) : !isLoading ? (
            <>
              <Link href="/login" className={`${isCompactHome ? 'max-[360px]:hidden' : ''} text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors px-2 sm:px-3 py-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`}>
                Log in
              </Link>
              {isCompactHome ? (
                <Link href="/register" className="inline-flex h-9 items-center justify-center rounded-lg bg-primary-600 px-3 sm:px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
                  Get started
                </Link>
              ) : (
                <Link href="/register">
                  <Button size="sm" variant="primary" className="rounded-xl shadow-md">Get Started</Button>
                </Link>
              )}
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
};
