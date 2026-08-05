"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, Variants } from 'framer-motion';
import { ArrowRight, Sparkles, BrainCircuit, Target, Zap, Bot, CheckCircle2, Award, Compass, Mic } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IntroScreen } from '@/components/ui/IntroScreen';
import { HeroShowcase } from '@/components/ui/HeroShowcase';

export default function LandingPage() {
  const [isIntroActive, setIsIntroActive] = useState(true);
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldReduceMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setShouldReduceMotion(e.matches);
    mediaQuery.addEventListener('change', listener);

    if (isIntroActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      mediaQuery.removeEventListener('change', listener);
    };
  }, [isIntroActive]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
        delayChildren: isIntroActive ? 2.3 : 0,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0.1 : 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <div className={`relative flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] ${isIntroActive ? 'overflow-hidden' : ''}`}>
      {/* Intro Screen Overlay */}
      {isIntroActive && (
        <IntroScreen onComplete={() => setIsIntroActive(false)} />
      )}

      {/* Main Content Layer */}
      <motion.div
        initial={isIntroActive ? { scale: 0.96, opacity: 0.85 } : { scale: 1, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 2.1,
          duration: 1.0,
          ease: [0.83, 0, 0.17, 1],
        }}
        style={{ willChange: "transform, opacity" }}
        className="w-full flex-1 flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Background Ambient Glows */}
        <div 
          style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}
          className="absolute top-[-10%] left-[-10%] w-[80%] sm:w-[45%] h-[80%] sm:h-[45%] rounded-full bg-primary-600/5 sm:bg-primary-600/10 blur-[80px] sm:blur-[130px] pointer-events-none" 
        />
        <div 
          style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}
          className="absolute bottom-[-10%] right-[-10%] w-[80%] sm:w-[45%] h-[80%] sm:h-[45%] rounded-full bg-violet-600/5 sm:bg-violet-600/10 blur-[80px] sm:blur-[130px] pointer-events-none" 
        />

        {/* HERO SECTION */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Hero Text & CTAs */}
            <motion.div
              className="lg:col-span-6 text-center lg:text-left"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants} className="mb-6 flex justify-center lg:justify-start">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 text-primary-700 dark:text-primary-300 font-medium text-sm shadow-sm backdrop-blur-md">
                  <Sparkles className="w-4 h-4 mr-2 text-primary-500 animate-pulse" />
                  Next-Gen AI Career Intelligence
                </div>
              </motion.div>

              <motion.h1 
                variants={itemVariants}
                className="text-4xl sm:text-6xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 font-heading leading-[1.1]"
              >
                Unlock Your True <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-violet-600 to-indigo-500 glow-text">
                  Career Potential
                </span>
              </motion.h1>

              <motion.p 
                variants={itemVariants}
                className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal"
              >
                Upload your resume and receive instant, AI-driven feedback. Get an accurate ATS compatibility score, spot missing skills, and build custom roadmaps with your personal Groq AI mentor.
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl group shadow-lg shadow-primary-500/20 hover:shadow-primary-500/35 transition-all">
                    Get Started for Free
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1.5 transition-transform" />
                  </Button>
                </Link>
                <Link href="/login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                    Log in to Account
                  </Button>
                </Link>
              </motion.div>

              {/* Social Proof Stats */}
              <motion.div variants={itemVariants} className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-3 gap-4 text-center lg:text-left">
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white font-heading">98.4%</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">ATS Precision</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white font-heading">&lt; 3 Secs</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Instant Analysis</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white font-heading">10k+</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Careers Guided</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column: Interactive 3D Hero Showcase Component */}
            <motion.div 
              className="lg:col-span-6 flex justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: isIntroActive ? 2.3 : 0.2 }}
            >
              <HeroShowcase />
            </motion.div>

          </div>
        </div>

        {/* SECTION 2: AI Mentorship Showcase with Generated Illustration */}
        <div className="w-full bg-slate-100/70 dark:bg-slate-950/60 border-y border-slate-200/80 dark:border-slate-800/80 py-20 relative overflow-hidden backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column: 3D Tech Illustration */}
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="lg:col-span-6 relative flex justify-center"
              >
                <div className="relative w-full max-w-lg aspect-square rounded-3xl overflow-hidden glass p-3 border border-white/40 dark:border-slate-700/80 shadow-2xl group">
                  <Image
                    src="/images/mentorship_illustration.png"
                    alt="AI Mentorship and Resume Analytics"
                    fill
                    className="object-cover rounded-2xl transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                  
                  {/* Floating Overlay Badge */}
                  <div className="absolute bottom-6 left-6 right-6 glass p-4 rounded-2xl border border-white/30 dark:border-slate-700 backdrop-blur-xl flex items-center gap-4 bg-slate-900/90 text-white">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/30">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white font-heading">Interactive Career Roadmap Chatbot</h4>
                      <p className="text-xs text-slate-300">Generates step-by-step learning paths for your dream role.</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right Column: AI Features & Capabilities */}
              <motion.div 
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="lg:col-span-6 space-y-6"
              >
                <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium text-xs border border-violet-500/20">
                  <Compass className="w-4 h-4 mr-2" />
                  Intelligent Guidance System
                </div>

                <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading leading-tight">
                  Personalized Mentorship Driven by Advanced AI
                </h2>

                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
                  Our platform parses every line of your resume, mapping your experience against real-world market demands to chart out the fastest path to your goal.
                </p>

                <div className="space-y-4 pt-2">
                  {[
                    { title: "Deep Context Parsing", desc: "Extracts technical skills, soft skills, and missing competencies automatically." },
                    { title: "Tailored Growth Roadmaps", desc: "Ask the built-in AI mentor how to achieve any dream role (Data Scientist, AI Engineer, PM)." },
                    { title: "AI Voice Mock Interview", desc: "Practice realistic voice-based mock interviews with adaptive questions and detailed performance coaching reports." },
                    { title: "ATS Optimization Engine", desc: "Ensures your resume passes corporate automated screeners with flying colors." }
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ x: 6 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 mt-0.5 border border-primary-500/30">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">{item.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

            </div>
          </div>
        </div>

        {/* SECTION 3: FEATURE HIGHLIGHT CARDS WITH HOVER LIFT */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              State-of-the-art tools crafted to elevate your job search and accelerate career advancement.
            </p>
          </div>

          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                title: "ATS Score Benchmark",
                description: "Instantly see how well your resume matches automated recruitment software with an interactive circular gauge.",
                icon: Target,
                color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
                badge: "Instant Evaluation"
              },
              {
                title: "Skills Gap Identification",
                description: "Highlight missing technical and soft skills required for higher-tier positions in your industry.",
                icon: Zap,
                color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                badge: "Targeted Growth"
              },
              {
                title: "AI Career Role Matching",
                description: "Get personalized career path suggestions based on your exact profile, strengths, and trajectory.",
                icon: BrainCircuit,
                color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
                badge: "Smart Recommendations"
              },
              {
                title: "AI Voice Mock Interview",
                description: "Practice realistic voice-based mock interviews with adaptive questions and detailed performance coaching reports.",
                icon: Mic,
                color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                badge: "Interactive Practice"
              }
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                variants={itemVariants}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="glass p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg hover:shadow-2xl hover:border-primary-500/40 bg-white/80 dark:bg-slate-900/60 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner ${feature.color}`}>
                      <feature.icon className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 font-heading group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 group-hover:translate-x-1 transition-transform">
                  Learn more <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* SECTION 4: CALL TO ACTION FOOTER BANNER (HIGH-CONTRAST SOLID DARK DESIGN) */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 relative z-10">
          <div className="relative rounded-3xl overflow-hidden p-10 sm:p-16 border border-primary-500/40 text-center shadow-2xl bg-slate-900 text-white">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary-500/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-violet-500/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 opacity-90 pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-amber-300 font-semibold text-xs border border-white/20 shadow-sm">
                <Award className="w-4 h-4 mr-2 text-amber-400" />
                Transform Your Career Journey Today
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-heading leading-tight drop-shadow-md">
                Ready to Supercharge Your Resume?
              </h2>

              <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto font-normal leading-relaxed">
                Join thousands of professionals using AI to refine their resume, conquer ATS screeners, and land high-paying roles.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto h-14 px-10 text-lg rounded-xl shadow-xl shadow-primary-500/30">
                    Analyze Resume Now
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
