import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

export type TransactionStep = 'select' | 'enter' | 'review' | 'confirm' | 'done';

interface POSStepIndicatorProps {
  currentStep: TransactionStep;
  onStepClick?: (step: TransactionStep) => void;
  className?: string;
}

const STEPS: { id: TransactionStep; label: string; number: number }[] = [
  { id: 'select', label: 'Select', number: 1 },
  { id: 'enter', label: 'Enter Lines', number: 2 },
  { id: 'review', label: 'Review', number: 3 },
  { id: 'confirm', label: 'Confirm & Pay', number: 4 },
  { id: 'done', label: 'Done', number: 5 }
];

export const POSStepIndicator: React.FC<POSStepIndicatorProps> = ({
  currentStep,
  onStepClick,
  className = ''
}) => {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className={`flex items-center justify-between py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs ${className}`}>
      <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto no-scrollbar w-full justify-between sm:justify-start">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0 hidden sm:block" />
              )}
              <div
                onClick={() => {
                  if (isDone && onStepClick) onStepClick(step.id);
                }}
                className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : isDone
                    ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : step.number}
                </div>
                <span className="hidden xs:inline">{step.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

