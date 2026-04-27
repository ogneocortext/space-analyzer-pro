import React, { FC, useState, useEffect, useRef } from "react";
import {
  Search,
  Command,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  X,
  BrainCircuit,
  FolderSearch,
  BarChart3,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  placeholder?: string;
}

export const CommandPalette: FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  placeholder = "Search commands...",
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = commands.filter(
    (command) =>
      command.title.toLowerCase().includes(query.toLowerCase()) ||
      command.description.toLowerCase().includes(query.toLowerCase()) ||
      command.keywords?.some((keyword) => keyword.toLowerCase().includes(query.toLowerCase())) ||
      command.category.toLowerCase().includes(query.toLowerCase())
  );

  // Group commands by category
  const groupedCommands = filteredCommands.reduce(
    (groups, command) => {
      const category = command.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(command);
      return groups;
    },
    {} as Record<string, CommandItem[]>
  );

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "analysis":
        return FolderSearch;
      case "visualization":
        return BarChart3;
      case "automation":
        return Zap;
      case "ai":
        return BrainCircuit;
      default:
        return Command;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "analysis":
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "visualization":
        return "text-green-400 bg-green-500/10 border-green-500/20";
      case "automation":
        return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "ai":
        return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4"
      >
        <motion.div
          ref={paletteRef}
          initial={{ scale: 0.95, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -20 }}
          className="w-full max-w-2xl bg-slate-900/95 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center space-x-3 p-4 border-b border-white/10">
            <div className="p-2 bg-white/5 rounded-lg">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-lg"
            />
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category} className="border-b border-white/5 last:border-b-0">
                {/* Category Header */}
                <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(category)}`}
                    >
                      {React.createElement(getCategoryIcon(category), { size: 12 })}
                      <span className="ml-1">{category}</span>
                    </div>
                  </div>
                </div>

                {/* Commands */}
                {categoryCommands.map((command, index) => {
                  const globalIndex = filteredCommands.findIndex((cmd) => cmd.id === command.id);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <motion.button
                      key={command.id}
                      onClick={() => {
                        command.action();
                        onClose();
                      }}
                      className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/5 transition-colors text-left ${
                        isSelected ? "bg-white/10" : ""
                      }`}
                      whileHover={{ x: 2 }}
                    >
                      <div
                        className={`p-2 rounded-lg ${isSelected ? "bg-blue-500/20" : "bg-white/5"}`}
                      >
                        <command.icon
                          size={16}
                          className={isSelected ? "text-blue-300" : "text-gray-400"}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-medium truncate ${isSelected ? "text-blue-300" : "text-white"}`}
                        >
                          {command.title}
                        </div>
                        <div className="text-sm text-gray-400 truncate">{command.description}</div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center space-x-1 text-blue-300">
                          <CornerDownLeft size={14} />
                          <span className="text-xs">Enter</span>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ))}

            {filteredCommands.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Search size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">No commands found</h3>
                <p className="text-gray-500">Try searching for something else</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-white/5 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <ArrowUp size={12} />
                  <ArrowDown size={12} />
                  <span>Navigate</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CornerDownLeft size={12} />
                  <span>Select</span>
                </div>
                <div className="flex items-center space-x-1">
                  <kbd className="px-1 py-0.5 bg-white/10 rounded text-xs">Esc</kbd>
                  <span>Close</span>
                </div>
              </div>
              <div className="text-gray-500">
                {filteredCommands.length} command{filteredCommands.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Hook for managing command palette state
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }

      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(!isOpen),
  };
};
