import React, { FC, useState, ReactNode } from 'react';
import { HelpCircle, TrendingUp, AlertTriangle, Target, Lightbulb } from 'lucide-react';

interface XAIReasoning {
  logic: string;
  confidence: number;
  factors: { label: string; impact: number; type: 'positive' | 'negative' | 'neutral' }[];
  evidence: string[];
  recommendation?: string;
}

interface ExplainableAITooltipProps {
  reasoning: XAIReasoning;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const ExplainableAITooltip: FC<ExplainableAITooltipProps> = ({
  reasoning,
  children,
  position = 'top'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-400 border-green-500/30 bg-green-500/10';
    if (confidence >= 70) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  const getFactorIcon = (type: string) => {
    switch (type) {
      case 'positive': return <TrendingUp size={12} className="text-green-400" />;
      case 'negative': return <AlertTriangle size={12} className="text-red-400" />;
      default: return <Target size={12} className="text-blue-400" />;
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top': return 'bottom-full mb-2 left-1/2 -translate-x-1/2';
      case 'bottom': return 'top-full mt-2 left-1/2 -translate-x-1/2';
      case 'left': return 'right-full mr-2 top-1/2 -translate-y-1/2';
      case 'right': return 'left-full ml-2 top-1/2 -translate-y-1/2';
      default: return 'bottom-full mb-2 left-1/2 -translate-x-1/2';
    }
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="cursor-help"
      >
        {children}
      </div>

      {isOpen && (
        <div className={`absolute z-50 ${getPositionClasses()} w-80 p-4 rounded-xl border backdrop-blur-md shadow-2xl text-sm bg-slate-900/95 border-white/20`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <HelpCircle size={16} className="text-blue-400" />
              <span className="font-semibold text-white">AI Explanation</span>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(reasoning.confidence)}`}>
              {reasoning.confidence}% Confidence
            </div>
          </div>

          {/* Logic Explanation */}
          <div className="mb-4">
            <p className="text-gray-200 leading-relaxed">{reasoning.logic}</p>
          </div>

          {/* Contributing Factors */}
          <div className="mb-4">
            <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contributing Factors</h5>
            <div className="space-y-2">
              {reasoning.factors.map((factor, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getFactorIcon(factor.type)}
                    <span className="text-gray-300 text-xs truncate">{factor.label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          factor.type === 'positive' ? 'bg-green-400' :
                          factor.type === 'negative' ? 'bg-red-400' :
                          'bg-blue-400'
                        }`}
                        style={{ width: `${Math.abs(factor.impact)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-medium ${
                      factor.type === 'positive' ? 'text-green-400' :
                      factor.type === 'negative' ? 'text-red-400' :
                      'text-blue-400'
                    }`}>
                      {factor.impact > 0 ? '+' : ''}{factor.impact}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          {reasoning.evidence && reasoning.evidence.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evidence</h5>
              <ul className="space-y-1">
                {reasoning.evidence.slice(0, 3).map((evidence, index) => (
                  <li key={index} className="text-gray-300 text-xs flex items-start space-x-2">
                    <span className="text-gray-500 mt-1">•</span>
                    <span className="leading-relaxed">{evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {reasoning.recommendation && (
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-start space-x-2">
                <Lightbulb size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Recommendation</span>
                  <p className="text-gray-200 text-sm mt-1">{reasoning.recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tooltip Arrow */}
          <div className={`absolute w-2 h-2 bg-slate-900/95 border rotate-45 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l border-t border-white/20' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-r border-b border-white/20' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r border-white/20' :
            'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l border-white/20'
          }`}></div>
        </div>
      )}
    </div>
  );
};