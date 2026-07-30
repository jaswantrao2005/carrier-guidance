import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, AlertCircle, X, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isLoading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isLoading = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateAndProcessFile = (file: File) => {
    setError(null);
    
    // Validate File Type
    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF document.');
      return;
    }
    
    // Validate File Size (5MB limit = 5 * 1024 * 1024 bytes)
    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5MB.');
      return;
    }

    setSelectedFile(file);
    onUpload(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcessFile(file);
    }
  }, [isLoading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcessFile(file);
    }
  };

  const clearFile = () => {
    if (isLoading) return;
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm rounded-2xl border border-primary-200 dark:border-primary-900"
          >
            <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Analyzing Resume...</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center px-6">
              Our AI is extracting your skills, assessing your profile, and generating tailored career guidance.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out ${
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : error 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        whileHover={!selectedFile && !isLoading ? { scale: 1.01 } : {}}
        whileTap={!selectedFile && !isLoading ? { scale: 0.99 } : {}}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="application/pdf"
          className="hidden"
          disabled={isLoading}
        />

        <div className="p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
          {selectedFile ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/50 rounded-2xl flex items-center justify-center mb-4 text-primary-600 shadow-sm relative">
                <FileText className="w-10 h-10" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/80 dark:text-red-200 dark:hover:bg-red-900 rounded-full flex items-center justify-center shadow-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {selectedFile.name}
              </h4>
              <p className="text-sm text-slate-500 font-medium">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-primary-600 animate-bounce' : 'text-slate-400'}`} />
              </div>
              
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                Upload your resume
              </h3>
              
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Drag and drop your PDF file here, or click to browse from your computer.
              </p>
              
              <div className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors cursor-pointer shadow-sm">
                Browse Files
              </div>
              
              <p className="text-xs text-slate-400 mt-6 font-medium tracking-wide uppercase">
                Supported: PDF (Max 5MB)
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
      
      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mt-4 flex items-center p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50"
          >
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
