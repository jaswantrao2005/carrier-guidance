"use client";

import React, { useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { BrainCircuit, Sparkles } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  const [shouldReduceMotion, setShouldReduceMotion] = React.useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldReduceMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setShouldReduceMotion(e.matches);
    mediaQuery.addEventListener('change', listener);

    // Total timing sequence
    const timer = setTimeout(() => {
      onComplete();
    }, 3100);

    return () => {
      clearTimeout(timer);
      mediaQuery.removeEventListener('change', listener);
    };
  }, [onComplete]);

  const textContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.065,
        delayChildren: 0.2,
      },
    },
  };

  const letterVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 25,
      scale: shouldReduceMotion ? 1 : 0.85,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.5,
        ease: [0.215, 0.61, 0.355, 1.0],
      },
    },
  };

  const word1 = Array.from("Career");
  const word2 = Array.from("AI");

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { y: "0%" }}
      animate={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
      transition={{
        delay: 2.1,
        duration: shouldReduceMotion ? 0.4 : 1.0,
        ease: shouldReduceMotion ? "easeOut" : [0.83, 0, 0.17, 1],
      }}
      style={{ willChange: shouldReduceMotion ? "opacity" : "transform" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden select-none pointer-events-auto"
    >
      {/* Ambient Glow & Lighting Effects */}
      <div 
        style={{ transform: 'translate3d(-50%, -50%, 0)', willChange: 'transform' }}
        className="absolute top-1/2 left-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-gradient-to-tr from-primary-600/20 via-violet-600/25 to-indigo-600/20 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none" 
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* Grid Pattern overlay for tech aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b18_1px,transparent_1px),linear-gradient(to_bottom,#1e293b18_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        {/* Icon Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, filter: 'blur(16px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 w-18 h-18 sm:w-22 sm:h-22 p-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 border border-primary-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.35)] backdrop-blur-md"
        >
          <BrainCircuit className="w-9 h-9 sm:w-11 sm:h-11 text-primary-400" />
        </motion.div>

        {/* Per-letter "Career AI" Staggered Reveal */}
        <motion.h1
          variants={textContainerVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-center gap-x-3 sm:gap-x-4 text-5xl sm:text-7xl md:text-8xl font-extrabold font-heading tracking-tight"
        >
          {/* Word 1: Career */}
          <span className="flex">
            {word1.map((char, index) => (
              <motion.span
                key={`word1-${index}`}
                variants={letterVariants}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-primary-200 drop-shadow-[0_0_35px_rgba(255,255,255,0.3)]"
              >
                {char}
              </motion.span>
            ))}
          </span>

          {/* Word 2: AI */}
          <span className="flex">
            {word2.map((char, index) => (
              <motion.span
                key={`word2-${index}`}
                variants={letterVariants}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-violet-400 to-indigo-300 drop-shadow-[0_0_40px_rgba(139,92,246,0.5)]"
              >
                {char}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        {/* Subtitle Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 1.15, ease: 'easeOut' }}
          className="mt-8 flex items-center gap-2 px-5 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-primary-300 shadow-xl"
        >
          <Sparkles className="w-4 h-4 text-primary-400" />
          <span>Next-Gen Career Intelligence</span>
        </motion.div>
      </div>
    </motion.div>
  );
};
