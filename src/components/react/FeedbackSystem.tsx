import React, { FC, useState } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle2, Sparkles, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackSystemProps {
  onFeedback: (type: "positive" | "negative", comment?: string) => void;
  showCommentPrompt?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal" | "detailed";
}

export const FeedbackSystem: FC<FeedbackSystemProps> = ({
  onFeedback,
  showCommentPrompt = true,
  size = "md",
  variant = "default",
}) => {
  const [status, setStatus] = useState<"idle" | "learning" | "complete" | "feedback-given">("idle");
  const [selectedFeedback, setSelectedFeedback] = useState<"positive" | "negative" | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState("");

  const handleFeedback = (type: "positive" | "negative") => {
    setSelectedFeedback(type);
    setStatus("learning");

    // Simulate AI learning animation
    setTimeout(() => {
      setStatus("complete");
      onFeedback(type, comment || undefined);

      // Reset after showing completion
      setTimeout(() => {
        setStatus("feedback-given");
        setShowCommentInput(false);
        setComment("");
      }, 2000);
    }, 1500);

    // Show comment prompt for negative feedback
    if (type === "negative" && showCommentPrompt) {
      setShowCommentInput(true);
    }
  };

  const handleSubmitComment = () => {
    if (selectedFeedback) {
      onFeedback(selectedFeedback, comment);
    }
    setShowCommentInput(false);
  };

  const resetFeedback = () => {
    setStatus("idle");
    setSelectedFeedback(null);
    setShowCommentInput(false);
    setComment("");
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return { button: "w-8 h-8", icon: 14, text: "text-xs" };
      case "lg":
        return { button: "w-12 h-12", icon: 20, text: "text-base" };
      default:
        return { button: "w-10 h-10", icon: 16, text: "text-sm" };
    }
  };

  const sizeConfig = getSizeClasses();

  if (variant === "minimal") {
    return (
      <div className="flex items-center space-x-2">
        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex space-x-1"
            >
              <button
                onClick={() => handleFeedback("positive")}
                className={`flex items-center justify-center ${sizeConfig.button} rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 transition-all duration-200 group`}
                title="Good response"
              >
                <ThumbsUp
                  size={sizeConfig.icon}
                  className="text-green-400 group-hover:text-green-300 transition-colors"
                />
              </button>
              <button
                onClick={() => handleFeedback("negative")}
                className={`flex items-center justify-center ${sizeConfig.button} rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 group`}
                title="Needs improvement"
              >
                <ThumbsDown
                  size={sizeConfig.icon}
                  className="text-red-400 group-hover:text-red-300 transition-colors"
                />
              </button>
            </motion.div>
          )}

          {status === "learning" && (
            <motion.div
              key="learning"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center space-x-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Sparkles size={sizeConfig.icon} className="text-blue-400" />
              </motion.div>
              <span className={`${sizeConfig.text} text-blue-300`}>AI learning...</span>
            </motion.div>
          )}

          {status === "complete" && (
            <motion.div
              key="complete"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center space-x-2"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <CheckCircle2 size={sizeConfig.icon} className="text-green-400" />
              </motion.div>
              <span className={`${sizeConfig.text} text-green-300`}>Thanks for feedback!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div key="idle" className="flex items-center space-x-3" exit={{ opacity: 0 }}>
            <span className={`${sizeConfig.text} text-gray-400`}>Was this helpful?</span>
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFeedback("positive")}
                className={`flex items-center justify-center ${sizeConfig.button} rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 transition-all duration-200 group`}
                title="Helpful response"
              >
                <ThumbsUp
                  size={sizeConfig.icon}
                  className="text-green-400 group-hover:text-green-300 transition-colors"
                />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFeedback("negative")}
                className={`flex items-center justify-center ${sizeConfig.button} rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 group`}
                title="Could be better"
              >
                <ThumbsDown
                  size={sizeConfig.icon}
                  className="text-red-400 group-hover:text-red-300 transition-colors"
                />
              </motion.button>
            </div>
          </motion.div>
        )}

        {status === "learning" && (
          <motion.div
            key="learning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-3"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Sparkles size={sizeConfig.icon} className="text-blue-400" />
            </motion.div>
            <div>
              <span className={`${sizeConfig.text} text-blue-300 font-medium`}>
                AI is learning from your feedback...
              </span>
              <div className="w-full bg-blue-500/20 rounded-full h-1 mt-1">
                <motion.div
                  className="bg-blue-400 h-1 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {status === "complete" && (
          <motion.div
            key="complete"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center space-x-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <CheckCircle2 size={sizeConfig.icon} className="text-green-400" />
            </motion.div>
            <div>
              <span className={`${sizeConfig.text} text-green-300 font-medium`}>
                Feedback recorded!
              </span>
              <p className="text-xs text-gray-400 mt-1">AI model updated with your input</p>
            </div>
          </motion.div>
        )}

        {status === "feedback-given" && (
          <motion.div key="feedback-given" className="flex items-center space-x-3">
            <div
              className={`flex items-center justify-center ${sizeConfig.button} rounded-lg ${
                selectedFeedback === "positive"
                  ? "bg-green-500/20 border border-green-500/30"
                  : "bg-red-500/20 border border-red-500/30"
              }`}
            >
              {selectedFeedback === "positive" ? (
                <ThumbsUp size={sizeConfig.icon} className="text-green-400" />
              ) : (
                <ThumbsDown size={sizeConfig.icon} className="text-red-400" />
              )}
            </div>
            <div>
              <span
                className={`${sizeConfig.text} ${
                  selectedFeedback === "positive" ? "text-green-300" : "text-red-300"
                } font-medium`}
              >
                {selectedFeedback === "positive" ? "Marked as helpful" : "Feedback noted"}
              </span>
              <button
                onClick={resetFeedback}
                className="ml-2 text-xs text-gray-400 hover:text-gray-300 underline"
              >
                <RotateCcw size={12} className="inline mr-1" />
                Change
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comment Input Modal */}
      <AnimatePresence>
        {showCommentInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCommentInput(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 border border-white/20 rounded-xl p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Help us improve</h3>
              <p className="text-gray-300 text-sm mb-4">
                What could be better about this response?
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Your feedback helps us improve..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={3}
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowCommentInput(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmitComment}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-lg transition-colors"
                >
                  Submit Feedback
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
