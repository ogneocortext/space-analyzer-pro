import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Brain,
  Sparkles,
  Clock,
  FileText,
  HardDrive,
  Calendar,
  Filter,
} from "lucide-react";

interface NLQuery {
  text: string;
  intent: "search" | "filter" | "analyze" | "compare";
  entities: QueryEntity[];
  confidence: number;
  generatedQuery?: string;
}

interface QueryEntity {
  type: "size" | "date" | "type" | "name" | "location" | "action";
  value: string | number | Date;
  operator?: ">" | "<" | "=" | ">=" | "<=" | "contains" | "startswith" | "endswith";
  unit?: string;
}

interface NaturalLanguageSearchProps {
  onQuery: (query: NLQuery) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const NaturalLanguageSearch: React.FC<NaturalLanguageSearchProps> = ({
  onQuery,
  onSearch,
  placeholder = "Ask me anything about your files...",
  className = "",
  disabled = false,
}) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  // Sample query patterns for suggestions
  const queryPatterns = [
    "Show me files larger than 100MB",
    "Find videos modified last week",
    "What's taking up the most space?",
    "Show me duplicate files",
    "Files older than 6 months",
    "Find all PDF files",
    "Show me recent downloads",
    "What are my largest folders?",
    "Find temporary files",
    "Show me files I haven't used recently",
  ];

  // Parse natural language query
  const parseQuery = useCallback(async (text: string): Promise<NLQuery> => {
    const lowerText = text.toLowerCase();
    let intent: NLQuery["intent"] = "search";
    const entities: QueryEntity[] = [];
    const confidence = 0.8;

    // Detect intent
    if (lowerText.includes("show") || lowerText.includes("find") || lowerText.includes("search")) {
      intent = "search";
    } else if (lowerText.includes("filter") || lowerText.includes("only")) {
      intent = "filter";
    } else if (
      lowerText.includes("analyze") ||
      lowerText.includes("what") ||
      lowerText.includes("how much")
    ) {
      intent = "analyze";
    } else if (
      lowerText.includes("compare") ||
      lowerText.includes("versus") ||
      lowerText.includes("vs")
    ) {
      intent = "compare";
    }

    // Extract size entities
    const sizePatterns = [
      { pattern: /larger than (\d+(?:\.\d+)?)\s*(mb|gb|tb|kb)/i, operator: ">" as const },
      { pattern: /bigger than (\d+(?:\.\d+)?)\s*(mb|gb|tb|kb)/i, operator: ">" as const },
      { pattern: /smaller than (\d+(?:\.\d+)?)\s*(mb|gb|tb|kb)/i, operator: "<" as const },
      { pattern: /over (\d+(?:\.\d+)?)\s*(mb|gb|tb|kb)/i, operator: ">" as const },
      { pattern: /under (\d+(?:\.\d+)?)\s*(mb|gb|tb|kb)/i, operator: "<" as const },
      { pattern: /(\d+(?:\.\d+)?)\s*(mb|gb|tb|kb)\s*(?:or more|plus)/i, operator: ">=" as const },
    ];

    for (const { pattern, operator } of sizePatterns) {
      const match = text.match(pattern);
      if (match) {
        const size = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        // Convert to bytes
        let bytes = size;
        switch (unit) {
          case "kb":
            bytes *= 1024;
            break;
          case "mb":
            bytes *= 1024 * 1024;
            break;
          case "gb":
            bytes *= 1024 * 1024 * 1024;
            break;
          case "tb":
            bytes *= 1024 * 1024 * 1024 * 1024;
            break;
        }

        entities.push({
          type: "size",
          value: bytes,
          operator,
          unit,
        });
        break;
      }
    }

    // Extract date entities
    const datePatterns = [
      { pattern: /today/i, value: new Date(), operator: "=" as const },
      {
        pattern: /yesterday/i,
        value: new Date(Date.now() - 24 * 60 * 60 * 1000),
        operator: "=" as const,
      },
      {
        pattern: /last week/i,
        value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        operator: ">=" as const,
      },
      {
        pattern: /last month/i,
        value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        operator: ">=" as const,
      },
      {
        pattern: /last (\d+) days?/i,
        value: new Date(Date.now() - parseInt(RegExp.$1) * 24 * 60 * 60 * 1000),
        operator: ">=" as const,
      },
      {
        pattern: /older than (\d+) months?/i,
        value: new Date(Date.now() - parseInt(RegExp.$1) * 30 * 24 * 60 * 60 * 1000),
        operator: "<=" as const,
      },
      {
        pattern: /older than (\d+) weeks?/i,
        value: new Date(Date.now() - parseInt(RegExp.$1) * 7 * 24 * 60 * 60 * 1000),
        operator: "<=" as const,
      },
      {
        pattern: /older than (\d+) days?/i,
        value: new Date(Date.now() - parseInt(RegExp.$1) * 24 * 60 * 60 * 1000),
        operator: "<=" as const,
      },
      {
        pattern: /recent/i,
        value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        operator: ">=" as const,
      },
    ];

    for (const { pattern, operator } of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let dateValue: Date;
        if (pattern.source.includes("today")) {
          dateValue = new Date();
        } else if (match[0] === "recent") {
          dateValue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        } else {
          dateValue = new Date();
        }

        entities.push({
          type: "date",
          value: dateValue,
          operator,
        });
        break;
      }
    }

    // Extract file type entities
    const typePatterns = [
      {
        pattern: /\b(pdf|doc|docx|txt|jpg|jpeg|png|gif|mp4|avi|mov|mp3|wav|zip|rar|exe|dmg)\b/i,
        type: "extension" as const,
      },
      {
        pattern: /\b(image|video|audio|document|text|archive|executable)\b/i,
        type: "category" as const,
      },
      {
        pattern: /\b(pictures?|photos?|videos?|music|documents?|files?)\b/i,
        type: "category" as const,
      },
    ];

    for (const { pattern, type } of typePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          entities.push({
            type: "type",
            value: match.toLowerCase(),
            operator: "contains",
          });
        });
      }
    }

    // Extract name entities (search terms)
    const namePattern = /(?:named|called|containing|with)\s+["']([^"']+)["']|["']([^"']+)["']/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      entities.push({
        type: "name",
        value: nameMatch[1] || nameMatch[2],
        operator: "contains",
      });
    }

    // Generate structured query
    let generatedQuery = text;
    if (entities.length > 0) {
      generatedQuery = entities
        .map((entity) => {
          switch (entity.type) {
            case "size":
              return `size:${entity.operator}${entity.value}`;
            case "date":
              return `date:${entity.operator}${entity.value}`;
            case "type":
              return `type:${entity.value}`;
            case "name":
              return `name:${entity.operator}${entity.value}`;
            default:
              return "";
          }
        })
        .join(" ");
    }

    return {
      text,
      intent,
      entities,
      confidence,
      generatedQuery,
    };
  }, []);

  // Handle input change
  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value.length > 2) {
      // Filter suggestions based on input
      const filtered = queryPatterns.filter((pattern) =>
        pattern.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
      setSelectedSuggestion(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, []);

  // Handle query submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || disabled) return;

      setIsProcessing(true);
      setShowSuggestions(false);

      try {
        const query = await parseQuery(input);
        onQuery(query);

        // Also trigger traditional search for compatibility
        if (query.generatedQuery) {
          onSearch(query.generatedQuery);
        } else {
          onSearch(input);
        }
      } catch (error) {
        console.error("Error parsing query:", error);
        // Fallback to traditional search
        onSearch(input);
      } finally {
        setIsProcessing(false);
      }
    },
    [input, disabled, parseQuery, onQuery, onSearch]
  );

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestion(0);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedSuggestion((prev) => (prev + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case "Enter":
          e.preventDefault();
          if (suggestions[selectedSuggestion]) {
            handleSuggestionClick(suggestions[selectedSuggestion]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    },
    [showSuggestions, suggestions, selectedSuggestion, handleSuggestionClick]
  );

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-10 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />

          {/* AI indicator */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
              </motion.div>
            ) : (
              <Brain className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full px-4 py-3 text-left flex items-center space-x-3 transition-colors ${
                    index === selectedSuggestion
                      ? "bg-gray-700 text-blue-400"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="flex-1">{suggestion}</span>
                  {index === selectedSuggestion && <span className="text-xs text-gray-400">↵</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Query info display */}
      <AnimatePresence>
        {input && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-xs text-gray-400"
          >
            Type natural language queries like "show me files larger than 100MB" or "find recent
            videos"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NaturalLanguageSearch;
