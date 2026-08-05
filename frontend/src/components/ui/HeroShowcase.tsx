"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, BrainCircuit, TrendingUp } from 'lucide-react';

export const HeroShowcase: React.FC = () => {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none flex items-center justify-center p-4">
      {/* Ambient Radial Glows */}
      <div 
        style={{ transform: 'translate3d(-50%, -50%, 0)', willChange: 'transform' }}
        className="absolute top-1/2 left-1/2 w-[90%] sm:w-[110%] h-[90%] sm:h-[110%] rounded-full bg-gradient-to-tr from-primary-600/10 via-violet-600/20 to-indigo-600/10 blur-[60px] sm:blur-[100px] pointer-events-none" 
      />

      {/* Interactive Floating Card Frame */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 2.3 }}
        whileHover={{ scale: 1.025, rotateX: 1.5, rotateY: -1.5 }}
        className="relative z-10 w-full rounded-3xl p-3 sm:p-4 glass border border-white/20 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(15,23,42,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 group bg-slate-900/40 backdrop-blur-xl"
      >
        {/* Subtle shimmer sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* Dashboard Image Preview */}
        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden shadow-inner border border-slate-800/50">
          <Image
            src="/images/hero_mockup.png"
            alt="AI Career Guidance Dashboard Preview"
            fill
            className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
            priority
          />
        </div>

        {/* Floating Badge 1: Top Left */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-6 -left-3 sm:-left-6 glass px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-white/30 dark:border-slate-700/80 shadow-lg flex items-center gap-2.5 bg-slate-900/90 text-white backdrop-blur-md z-20"
        >
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">ATS Score</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-400">92% Optimal Match</div>
          </div>
        </motion.div>

        {/* Floating Badge 2: Bottom Right */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-2 -right-3 sm:-right-6 glass px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl border border-white/30 dark:border-slate-700/80 shadow-lg flex items-center gap-2.5 bg-slate-900/90 text-white backdrop-blur-md z-20"
        >
          <div className="w-7 h-7 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center border border-primary-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">AI Engine</div>
            <div className="text-xs sm:text-sm font-bold text-primary-300">Gemini Powered</div>
          </div>
        </motion.div>

        {/* Floating Badge 3: Top Right Accent */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute top-12 -right-2 sm:-right-4 glass p-2.5 rounded-2xl border border-violet-500/30 shadow-lg bg-violet-950/80 text-violet-300 backdrop-blur-md z-20 hidden sm:flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold">Career Growth +35%</span>
        </motion.div>
      </motion.div>
    </div>
  );
};
