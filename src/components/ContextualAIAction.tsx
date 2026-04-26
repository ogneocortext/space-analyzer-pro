import React, { FC, useState } from 'react';
import { Sparkles, MessageCircle, BrainCircuit } from 'lucide-react';

interface ContextualAIActionProps {
  context: string;
  contextType: 'file' | 'directory' | 'anomaly' | 'metric' | 'trend';
  onAskAI: (query: string, context: string) => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

export const ContextualAIAction: FC<ContextualAIActionProps> = ({
  context,
  contextType,
  onAskAI,
  position = 'top',
  size = 'md'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const getContextPrompts = () => {
    switch (contextType) {
      case 'file':
        return [
          `Analyze this file: ${context}`,
          `What does this file contain? ${context}`,
          `Is this file optimized? ${context}`
        ];
      case 'directory':
        return [
          `Analyze this directory: ${context}`,
          `What's the structure of ${context}?`,
          `Optimize storage in ${context}`
        ];
      case 'anomaly':
        return [
          `Explain this anomaly: ${context}`,
          `Why is this happening? ${context}`,
          `How to fix this issue? ${context}`
        ];
      case 'metric':
        return [
          `Explain this metric: ${context}`,
          `What does this mean? ${context}`,
          `How to improve this? ${context}`
        ];
      case 'trend':
        return [
          `Analyze this trend: ${context}`,
          `What's causing this change? ${context}`,
          `Predict future values for ${context}`
        ];
      default:
        return [
          `Tell me about: ${context}`,
          `Analyze: ${context}`,
          `What can you tell me about ${context}?`
        ];
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'w-6 h-6';
      case 'lg': return 'w-10 h-10';
      default: return 'w-8 h-8';
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

  const prompts = getContextPrompts();

  return (
    <div className="relative inline-block">
      {/* Sparkle Icon */}
      <button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsExpanded(false);
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          group relative flex items-center justify-center rounded-lg transition-all duration-200
          ${getSizeClasses()}
          ${isHovered
            ? 'bg-purple-500/20 scale-110 shadow-lg shadow-purple-500/25'
            : 'bg-white/5 hover:bg-purple-500/10'
          }
          border border-transparent hover:border-purple-500/30
        `}
        title="Ask AI about this"
      >
        <Sparkles
          className={`
            transition-all duration-200
            ${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'}
            ${isHovered ? 'text-purple-300 animate-pulse' : 'text-purple-400 group-hover:text-purple-300'}
          `}
        />

        {/* Ripple effect */}
        {isHovered && (
          <div className="absolute inset-0 rounded-lg bg-purple-400/20 animate-ping"></div>
        )}
      </button>

      {/* Context Menu */}
      {isExpanded && (
        <div className={`absolute z-50 ${getPositionClasses()} w-64 p-2 rounded-xl border backdrop-blur-md shadow-2xl bg-slate-900/95 border-white/20`}>
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
              Ask AI about {contextType}
            </div>

            {prompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => {
                  onAskAI(prompt, context);
                  setIsExpanded(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors flex items-center space-x-3 group"
              >
                <div className="p-1 bg-blue-500/20 rounded group-hover:bg-blue-500/30 transition-colors">
                  <MessageCircle size={12} className="text-blue-400" />
                </div>
                <span className="truncate">{prompt}</span>
              </button>
            ))}

            {/* Custom prompt option */}
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  const customPrompt = prompt(`Ask AI about ${context}:`, `Tell me more about ${context}`);
                  if (customPrompt?.trim()) {
                    onAskAI(customPrompt, context);
                    setIsExpanded(false);
                  }
                }}
                className="w-full px-3 py-2 text-left text-sm text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 rounded-lg transition-colors flex items-center space-x-3 group"
              >
                <div className="p-1 bg-purple-500/20 rounded group-hover:bg-purple-500/30 transition-colors">
                  <BrainCircuit size={12} className="text-purple-400" />
                </div>
                <span>Custom question...</span>
              </button>
            </div>
          </div>

          {/* Tooltip Arrow */}
          <div className={`absolute w-2 h-2 bg-slate-900/95 border rotate-45 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l border-t border-white/20' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-r border-b border-white/20' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r border-white/20' :
            'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l border-white/20'
          }`}></div>
        </div>
      )}

      {/* Hover Tooltip */}
      {isHovered && !isExpanded && (
        <div className={`absolute z-40 ${getPositionClasses()} px-3 py-2 rounded-lg border backdrop-blur-md shadow-lg bg-slate-900/95 border-white/20 text-sm text-gray-200 whitespace-nowrap`}>
          Ask AI about {contextType}
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