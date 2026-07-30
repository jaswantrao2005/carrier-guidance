import React from 'react';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

interface SkillTagProps {
  skill: string;
  type: 'technical' | 'soft' | 'missing' | 'role';
}

export const SkillTag: React.FC<SkillTagProps> = ({ skill, type }) => {
  let styles = '';
  let Icon = null;

  switch (type) {
    case 'technical':
      styles = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50';
      Icon = CheckCircle2;
      break;
    case 'soft':
      styles = 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800/50';
      Icon = CheckCircle2;
      break;
    case 'missing':
      styles = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50';
      Icon = XCircle;
      break;
    case 'role':
      styles = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50';
      Icon = ChevronRight;
      break;
  }

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-medium shadow-sm transition-colors ${styles}`}>
      {Icon && <Icon className="w-4 h-4 mr-1.5 opacity-70" />}
      {skill}
    </div>
  );
};
