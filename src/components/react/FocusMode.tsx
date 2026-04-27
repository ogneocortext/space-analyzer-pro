import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, X, Settings, Monitor, Eye } from "lucide-react";

interface FocusModeProps {
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  title?: string;
  showControls?: boolean;
  className?: string;
}

interface FocusModeControlsProps {
  isActive: boolean;
  onToggle: () => void;
  onSettings?: () => void;
  title?: string;
  showTitle?: boolean;
}

const FocusModeControls: React.FC<FocusModeControlsProps> = ({
  isActive,
  onToggle,
  onSettings,
  title,
  showTitle = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity: isHovered || isActive ? 1 : 0.3,
        y: isHovered || isActive ? 0 : -20,
      }}
      className="fixed top-4 right-4 z-50 flex items-center space-x-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2 flex items-center space-x-2">
        {showTitle && title && <span className="text-white text-sm font-medium mr-2">{title}</span>}

        {onSettings && (
          <button
            onClick={onSettings}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            title="Visualization Settings"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        )}

        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-800 rounded transition-colors"
          title={isActive ? "Exit Focus Mode" : "Enter Focus Mode"}
        >
          {isActive ? (
            <Minimize2 className="w-4 h-4 text-blue-400" />
          ) : (
            <Maximize2 className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

const FocusMode: React.FC<FocusModeProps> = ({
  isActive,
  onToggle,
  children,
  title,
  showControls = true,
  className = "",
}) => {
  const [keyPressed, setKeyPressed] = useState<string | null>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F for focus mode
      if (e.key === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeElement = document.activeElement;
        const isInput =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.getAttribute("contenteditable") === "true");

        if (!isInput) {
          e.preventDefault();
          onToggle();
          setKeyPressed("F");
          setTimeout(() => setKeyPressed(null), 200);
        }
      }

      // Escape to exit focus mode
      if (e.key === "Escape" && isActive) {
        onToggle();
        setKeyPressed("ESC");
        setTimeout(() => setKeyPressed(null), 200);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onToggle]);

  // Prevent scroll when in focus mode
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = "0";
      document.body.style.left = "0";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, [isActive]);

  return (
    <>
      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            transition={{ duration: 0.3 }}
          >
            {/* Background gradient for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `
                  linear-gradient(to right, white 1px, transparent 1px),
                  linear-gradient(to bottom, white 1px, transparent 1px)
                `,
                backgroundSize: "50px 50px",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Container */}
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="focus-mode"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Main content area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full h-full max-w-7xl max-h-full flex items-center justify-center"
            >
              <div className="w-full h-full bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header with title and exit hint */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-gray-900/90 to-transparent p-6">
                  <div className="flex items-center justify-between">
                    {title && (
                      <motion.h2
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-2xl font-bold text-white"
                      >
                        {title}
                      </motion.h2>
                    )}
                    <div className="flex items-center space-x-4">
                      <div className="text-gray-400 text-sm">
                        Press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">ESC</kbd> to
                        exit
                      </div>
                      <button
                        onClick={onToggle}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="w-full h-full p-8 pt-20">{children}</div>
              </div>
            </motion.div>

            {/* Keyboard indicator */}
            <AnimatePresence>
              {keyPressed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-xs text-white">
                      {keyPressed}
                    </kbd>
                    <span className="text-gray-300 text-sm">
                      {keyPressed === "F" ? "Focus Mode" : "Exited"}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="normal-mode" className={className} transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {showControls && <FocusModeControls isActive={isActive} onToggle={onToggle} title={title} />}
    </>
  );
};

// Hook for managing focus mode
export const useFocusMode = () => {
  const [isActive, setIsActive] = useState(false);
  const [title, setTitle] = useState<string>("");

  const enterFocusMode = useCallback((newTitle?: string) => {
    if (newTitle) setTitle(newTitle);
    setIsActive(true);
  }, []);

  const exitFocusMode = useCallback(() => {
    setIsActive(false);
    setTitle("");
  }, []);

  const toggleFocusMode = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  return {
    isActive,
    title,
    enterFocusMode,
    exitFocusMode,
    toggleFocusMode,
  };
};

export default FocusMode;
