"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { BrainCircuit, LogOut, LayoutDashboard, UploadCloud, Mic } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/Button';

export const Navbar = () => {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isAuthPage) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-violet-600 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-primary-500/30 transition-all border border-white/20"
          >
            <BrainCircuit className="w-5 h-5 text-white" />
          </motion.div>
          <span className="font-heading font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">
            Career<span className="text-primary-500">AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-4">
          {!isLoading && user ? (
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
              <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors px-3 py-2">
                Log in
              </Link>
              <Link href="/register">
                <Button size="sm" variant="primary" className="rounded-xl shadow-md">Get Started</Button>
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
};
