import React, { FC, useState, useEffect } from 'react';
import { BrainCircuit, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamingResponseProps {
  isStreaming: boolean;
  response: string;
  isComplete?: boolean;
  error?: string | null;
  model?: string;
  confidence?: number;
  responseTime?: number;
  onCancel?: () => void;
}

export const StreamingResponse: FC<StreamingResponseProps> = ({
  isStreaming,
  response,
  isComplete = false,
  error = null,
  model = 'AI Assistant',
  confidence = 85,
  responseTime,
  onCancel
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Simulate streaming effect
  useEffect(() => {
    if (isStreaming && response) {
      if (currentIndex < response.length) {
        const timer = setTimeout(() => {
          setDisplayedText(response.slice(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }, 20); // Adjust speed as needed

        return () => clearTimeout(timer);
      }
    } else if (!isStreaming) {
      setDisplayedText(response);
      setCurrentIndex(response.length);
    }
  }, [isStreaming, response, currentIndex]);

  // Reset when new response starts
  useEffect(() => {
    if (isStreaming && !displayedText) {
      setDisplayedText('');
      setCurrentIndex(0);
    }
  }, [isStreaming, displayedText]);

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
      >
        <div className="flex items-center space-x-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div>
            <h4 className="text-red-300 font-medium">Response Error</h4>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <BrainCircuit size={16} className="text-blue-300" />
          </div>
          <div>
            <span className="text-white font-medium">{model}</span>
            {confidence && (
              <span className="ml-2 text-xs text-gray-400">
                {confidence}% confidence
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isStreaming && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Cancel
            </button>
          )}

          {isComplete && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center space-x-1 text-green-400"
            >
              <CheckCircle2 size={14} />
              <span className="text-xs">Complete</span>
            </motion.div>
          )}

          {responseTime && (
            <span className="text-xs text-gray-400">
              {responseTime}ms
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="prose prose-invert max-w-none">
          {isStreaming ? (
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <BrainCircuit size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white leading-relaxed whitespace-pre-wrap">
                    {displayedText}
                    {isStreaming && (
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="inline-block w-2 h-4 bg-blue-400 ml-1"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Streaming indicator */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center space-x-3 text-sm text-gray-400"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Sparkles size={14} />
                  </motion.div>
                  <span>AI is thinking...</span>
                  <div className="flex space-x-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          delay: i * 0.2
                        }}
                        className="w-1 h-1 bg-blue-400 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <BrainCircuit size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white leading-relaxed whitespace-pre-wrap">
                  {response}
                </div>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center space-x-2 text-xs text-gray-400"
                  >
                    <CheckCircle2 size={12} className="text-green-400" />
                    <span>Response complete</span>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar for streaming */}
      {isStreaming && (
        <div className="px-4 pb-3">
          <div className="w-full bg-gray-700 rounded-full h-1">
            <motion.div
              className="bg-gradient-to-r from-blue-400 to-purple-400 h-1 rounded-full"
              initial={{ width: '0%' }}
              animate={{
                width: response ? `${(displayedText.length / response.length) * 100}%` : '30%'
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Skeleton loading component for initial state
export const ResponseSkeleton: FC<{ variant?: 'default' | 'minimal' }> = ({
  variant = 'default'
}) => {
  if (variant === 'minimal') {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-gray-600 rounded-lg"></div>
          <div className="h-4 bg-gray-600 rounded w-24"></div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-600 rounded w-full"></div>
          <div className="h-3 bg-gray-600 rounded w-3/4"></div>
          <div className="h-3 bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header Skeleton */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-600 rounded-lg animate-pulse"></div>
          <div className="h-4 bg-gray-600 rounded w-20 animate-pulse"></div>
        </div>
        <div className="h-4 bg-gray-600 rounded w-16 animate-pulse"></div>
      </div>

      {/* Content Skeleton */}
      <div className="p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-gray-600 rounded-lg animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-600 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-600 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-gray-600 rounded w-4/6 animate-pulse"></div>
            <div className="h-4 bg-gray-600 rounded w-3/4 animate-pulse"></div>
          </div>
        </div>

        {/* Streaming indicator skeleton */}
        <div className="mt-4 flex items-center space-x-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <Sparkles size={14} className="text-blue-400" />
          </motion.div>
          <div className="h-3 bg-gray-600 rounded w-24 animate-pulse"></div>
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  delay: i * 0.2
                }}
                className="w-1 h-1 bg-blue-400 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};