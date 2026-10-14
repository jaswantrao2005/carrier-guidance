"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BrainCircuit, Play, ArrowRight, Bell } from 'lucide-react';
import { Caveat } from 'next/font/google';

const caveat = Caveat({ subsets: ['latin'], weight: '700' });

export default function MinimalLandingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans relative overflow-hidden selection:bg-indigo-500/20">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <svg className="absolute -left-32 top-32 opacity-[0.03] text-slate-900 w-[600px] h-[600px]" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" d="M45.7,-76.1C58.9,-69.3,69.1,-55.3,77.2,-40.4C85.3,-25.5,91.3,-9.7,89.5,5.6C87.7,20.9,78,35.6,67.3,48.5C56.6,61.4,44.9,72.4,30.8,78.2C16.7,84,0.2,84.5,-15.5,81.4C-31.2,78.3,-46.1,71.5,-58.5,60.8C-70.9,50,-80.8,35.3,-85.7,19.3C-90.6,3.3,-90.5,-14,-84.1,-29.4C-77.7,-44.8,-65,-58.3,-50.2,-64.5C-35.4,-70.7,-18.5,-69.6,-1.3,-67.7C15.9,-65.8,32.5,-82.9,45.7,-76.1Z" transform="translate(100 100) scale(1.2)" />
        </svg>
        <svg className="absolute -right-20 top-[40%] opacity-[0.03] text-slate-900 w-[800px] h-[800px]" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" d="M38.1,-63.9C52.4,-57.8,69,-52.1,78.2,-40.5C87.4,-28.9,89.2,-11.4,85.2,4.3C81.2,20,71.4,33.9,60.8,46.5C50.2,59.1,38.8,70.4,24.5,76.5C10.2,82.6,-7,83.5,-22.1,78.6C-37.2,73.7,-50.2,63,-60.9,50.1C-71.6,37.2,-80,22.1,-82.1,6.3C-84.2,-9.5,-80,-26.1,-70.9,-39.3C-61.8,-52.5,-47.8,-62.3,-33.4,-68.2C-19,-74,-4.2,-75.9,5.2,-85.3C14.6,-94.7,23.8,-70,38.1,-63.9Z" transform="translate(100 100) scale(1.1)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Custom Navbar */}
        <nav className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-sm border border-white/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CareerAI</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-500">
            <Link href="#features" className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-slate-900 transition-colors">How it Works</Link>
            <Link href="#testimonials" className="hover:text-slate-900 transition-colors">Testimonials</Link>
            <Link href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center space-x-6">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/register" className="bg-[#0f172a] hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm hover:shadow transition-all">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mt-16 md:mt-24">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center space-x-2 bg-white border border-slate-200 px-4 py-1.5 rounded-full text-sm text-slate-500 font-medium shadow-sm mb-8"
          >
            <span>✨</span>
            <span>Your Career, Smarter with AI</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-[5.5rem] font-black text-slate-900 tracking-tighter leading-[1.05] max-w-3xl mx-auto"
          >
            Unlock Your True<br className="hidden md:block"/> Career Potential
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed"
          >
            Upload your resume, get instant AI-driven feedback, spot missing skills, 
            and receive personalized career roadmaps — all in one place.
          </motion.p>

          <div className="relative mt-10">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4"
            >
              <Link href="/register" className="flex items-center bg-[#0f172a] hover:bg-slate-800 text-white px-8 py-4 text-base rounded-full font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:w-auto justify-center group">
                Get Started for Free
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="#demo" className="flex items-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 px-8 py-4 text-base rounded-full font-medium shadow-sm hover:shadow transition-all w-full sm:w-auto justify-center">
                <div className="bg-slate-900 text-white rounded-full p-1 mr-2 flex items-center justify-center">
                   <Play className="w-3 h-3 fill-current ml-[1px]" />
                </div>
                Watch Demo
              </Link>
            </motion.div>

            {/* Handwritten Annotation */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="hidden lg:block absolute -right-[22rem] top-10 w-52 transform rotate-6"
            >
              <div className={`${caveat.className} text-3xl text-slate-400 leading-tight`}>
                Smarter<br/>Careers<br/>Brighter<br/>Futures
              </div>
              <svg className="w-16 h-16 text-slate-400 mt-3 -ml-4" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M80 10 Q 50 20, 20 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M15 65 L20 80 L35 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Floating Dashboard Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-16 md:mt-24 relative max-w-[1100px] mx-auto w-full px-4 sm:px-0"
        >
          {/* Glass background layer for depth */}
          <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl rounded-[2.5rem] transform scale-[1.03] translate-y-4 -z-10"></div>
          
          <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[450px]">
            
            {/* Mockup Sidebar */}
            <div className="w-full md:w-64 bg-slate-50/50 border-r border-slate-100 p-6 flex flex-col space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                  <BrainCircuit className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold text-slate-900 text-sm">CareerAI</span>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center space-x-3 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  <span>Dashboard</span>
                </div>
                {['Resume Analysis', 'Career Roadmap', 'AI Mentor', 'Interview Prep'].map((item, i) => (
                  <div key={i} className="flex items-center space-x-3 px-3 py-2 text-slate-500 text-sm font-medium">
                    <div className="w-4 h-4 border border-slate-300 rounded-[3px] opacity-70"></div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup Main Content */}
            <div className="flex-1 p-8 md:p-10 bg-white">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                    Good morning, Sarah! <span className="ml-2 text-xl">👋</span>
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">Here's your career overview</p>
                </div>
                <div className="flex items-center space-x-3 hidden sm:flex">
                  <div className="relative">
                    <input type="text" placeholder="Search anything..." className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-sm text-slate-600 w-64 focus:outline-none" />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <button className="w-9 h-9 flex items-center justify-center border border-slate-100 rounded-full text-slate-400">
                    <Bell className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mockup Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <p className="text-slate-500 text-sm font-semibold mb-4">ATS Score</p>
                  <div className="flex items-center justify-center">
                    {/* Fake SVG Donut Chart */}
                    <div className="relative w-32 h-32 mx-auto">
                      <svg viewBox="0 0 36 36" className="w-full h-full text-indigo-500">
                        <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                        <path strokeDasharray="92, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-indigo-600 tracking-tight">92%</span>
                        <span className="text-[10px] text-slate-400 font-medium">Excellent Match</span>
                      </div>
                    </div>
                  </div>
                </div>

                {[{label: 'Skills Found', val: '24', sub: 'In your resume'}, {label: 'Missing Skills', val: '6', sub: 'To improve', valColor: 'text-rose-500'}, {label: 'Recommended Roles', val: '5', sub: 'Based on your profile'}].map((stat, i) => (
                  <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                    <p className="text-slate-500 text-sm font-semibold">{stat.label}</p>
                    <div className="mt-4">
                      <h3 className={`text-5xl font-extrabold tracking-tight ${stat.valColor || 'text-slate-900'}`}>{stat.val}</h3>
                      <p className="text-slate-400 text-sm mt-1">{stat.sub}</p>
                    </div>
                  </div>
                ))}

              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Extra spacing at bottom */}
        <div className="h-32"></div>
      </div>
    </div>
  );
}
