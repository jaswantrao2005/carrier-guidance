"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Loader2, Target } from 'lucide-react';
import apiClient from '@/features/api/client';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RoadmapChatbotProps {
  resumeContext: any;
}

export const RoadmapChatbot: React.FC<RoadmapChatbotProps> = ({ resumeContext }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // We pass the history excluding the newest message (because backend adds userQuery)
      // Actually, the backend code expects `history` and `query` separately.
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const response = await apiClient.post('/chat/roadmap', {
        query: userMessage,
        history: history,
        resumeContext: resumeContext
      });

      if (response.data.success) {
        setMessages([...newMessages, { role: 'assistant', content: response.data.response }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: "I'm sorry, I couldn't generate a response." }]);
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages([...newMessages, { role: 'assistant', content: "An error occurred while connecting to the AI Mentor." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full glass rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/50 dark:bg-slate-900/50">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center">
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center mr-3">
          <Target className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">Personalized Career Mentor</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ask me how to achieve your dream role</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[300px] max-h-[500px] bg-slate-50/50 dark:bg-slate-950/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70 p-6">
            <Bot className="w-12 h-12 text-primary-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">What role do you want to pursue in your life?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              Type your dream role below (e.g. AI Engineer, Data Scientist, Product Manager) and I'll generate a personalized roadmap based on your latest resume.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 ml-3' 
                        : 'bg-primary-500 text-white mr-3'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-tr-sm'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm prose prose-sm dark:prose-invert max-w-none'
                    }`}>
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex max-w-[85%] flex-row">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary-500 text-white mr-3 flex items-center justify-center shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your dream role or follow-up question..."
            disabled={isLoading}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 text-slate-900 dark:text-white"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:hover:bg-primary-500"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
    </div>
  );
};
