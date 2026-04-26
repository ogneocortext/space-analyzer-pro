import React, { useState } from 'react';

interface XAIReasoning {
  logic: string;
  confidence: number;
  factors: { label: string; impact: number }[];
}

export const InsightTooltip = ({ reasoning }: { reasoning: XAIReasoning }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/40 transition-colors"
      >
        Why?
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full mb-2 w-64 p-4 rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-md shadow-2xl text-sm">
          <p className="font-medium text-white mb-2">{reasoning.logic}</p>
          <div className="space-y-2">
            {reasoning.factors.map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-400">
                  <span>{f.label}</span>
                  <span>{f.impact}% Impact</span>
                </div>
                <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400" style={{ width: `${f.impact}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};