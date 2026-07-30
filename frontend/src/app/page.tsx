"use client";

import React from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { ArrowRight, Sparkles, BrainCircuit, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <div className="relative overflow-hidden flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20 lg:py-32">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-6 flex justify-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 text-primary-700 dark:text-primary-300 font-medium text-sm shadow-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              Powered by Gemini AI
            </div>
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white mb-8 font-heading"
          >
            Unlock Your True <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600">
              Career Potential
            </span>
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Upload your resume and get instant, AI-driven insights. Discover your ATS score, identify missing skills, and explore tailored career paths designed just for you.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl group">
                Get Started for Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl">
                Log in to Account
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          className="grid md:grid-cols-3 gap-8 mt-24 md:mt-32 max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {[
            {
              title: "ATS Optimization",
              description: "Instantly see how well your resume scores against Applicant Tracking Systems.",
              icon: Target,
              color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
            },
            {
              title: "Skills Gap Analysis",
              description: "Identify exactly which technical and soft skills you are missing for top roles.",
              icon: Zap,
              color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
            },
            {
              title: "AI Role Matching",
              description: "Get personalized career path recommendations based on your unique profile.",
              icon: BrainCircuit,
              color: "text-violet-500 bg-violet-50 dark:bg-violet-500/10",
            }
          ].map((feature, i) => (
            <motion.div 
              key={i} 
              variants={itemVariants}
              className="glass p-8 rounded-3xl border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow bg-white/50 dark:bg-slate-900/50"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
