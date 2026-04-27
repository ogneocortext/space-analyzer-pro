import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  AlertTriangle,
  Search,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  FileQuestion,
  Compass,
  Map,
  Bookmark,
  History,
  Star,
  Heart,
  MessageSquare,
  Send,
  X,
  Zap,
  Rocket,
  Globe,
  Navigation,
  Target,
  Lightbulb,
  Coffee,
  Brain,
  Sparkles,
  Telescope,
  Binoculars,
  Radar,
  MapPin,
  Route,
  Settings,
  User,
  Mail,
  Phone,
  ExternalLink,
  Copy,
  Share2,
  Download,
  Upload,
  Filter,
  Grid,
  List,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Shield,
  Wifi,
  Database,
  Cloud,
  Server,
  HardDrive,
  Cpu,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  // Desktop,
  Folder,
  Activity,
  Check,
  CheckCircle,
} from "lucide-react";
import styles from "./EnhancedNotFoundPage.module.css";

interface NotFoundPageProps {
  onNavigate?: (page: string) => void;
  errorInfo?: {
    path?: string;
    timestamp?: Date;
    userAgent?: string;
    referrer?: string;
  };
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  category: "navigation" | "search" | "help" | "popular";
  priority: number;
}

interface SearchResult {
  id: string;
  title: string;
  path: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

const EnhancedNotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate, errorInfo }) => {
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showHelp, setShowHelp] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [errorLogged, setErrorLogged] = useState(false);

  // Mock search results
  const mockSearchResults: SearchResult[] = [
    {
      id: "1",
      title: "Dashboard",
      path: "/dashboard",
      description: "Main dashboard with system overview",
      category: "navigation",
      icon: <Home size={20} />,
    },
    {
      id: "2",
      title: "File Browser",
      path: "/file-browser",
      description: "Browse and analyze files",
      category: "navigation",
      icon: <Folder size={20} />,
    },
    {
      id: "3",
      title: "AI Features",
      path: "/ai-features",
      description: "AI-powered analysis tools",
      category: "navigation",
      icon: <Brain size={20} />,
    },
    {
      id: "4",
      title: "Performance Monitor",
      path: "/performance",
      description: "System performance metrics",
      category: "navigation",
      icon: <Cpu size={20} />,
    },
    {
      id: "5",
      title: "Settings",
      path: "/settings",
      description: "Application configuration",
      category: "navigation",
      icon: <Settings size={20} />,
    },
    {
      id: "6",
      title: "Help Center",
      path: "/help",
      description: "Documentation and support",
      category: "help",
      icon: <HelpCircle size={20} />,
    },
  ];

  // Suggestions based on common navigation patterns
  const suggestions: Suggestion[] = [
    {
      id: "1",
      title: "Return to Dashboard",
      description: "Go back to the main dashboard",
      icon: <Home size={20} />,
      action: "dashboard",
      category: "navigation",
      priority: 1,
    },
    {
      id: "2",
      title: "Search for Content",
      description: "Use search to find what you need",
      icon: <Search size={20} />,
      action: "search",
      category: "search",
      priority: 2,
    },
    {
      id: "3",
      title: "Browse Popular Pages",
      description: "Explore frequently visited pages",
      icon: <Star size={20} />,
      action: "popular",
      category: "popular",
      priority: 3,
    },
    {
      id: "4",
      title: "Get Help",
      description: "Visit help center for assistance",
      icon: <HelpCircle size={20} />,
      action: "help",
      category: "help",
      priority: 4,
    },
    {
      id: "5",
      title: "Report Issue",
      description: "Let us know about this problem",
      icon: <MessageSquare size={20} />,
      action: "report",
      category: "help",
      priority: 5,
    },
  ];

  // Log error for analytics
  useEffect(() => {
    if (!errorLogged) {
      logError();
      setErrorLogged(true);
    }
  }, []);

  const logError = useCallback(() => {
    // Mock error logging - in real app, this would send to analytics service
    const errorData = {
      type: "404",
      path: errorInfo?.path || window.location.pathname,
      timestamp: errorInfo?.timestamp || new Date(),
      userAgent: errorInfo?.userAgent || navigator.userAgent,
      referrer: errorInfo?.referrer || document.referrer,
      sessionId: generateSessionId(),
    };

    console.warn("404 Error Logged:", errorData);

    // In production, send to analytics service
    // analytics.track('404_error', errorData);
  }, [errorInfo]);

  const generateSessionId = (): string => {
    return "session_" + Math.random().toString(36).substr(2, 9);
  };

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(true);

    // Simulate search delay
    setTimeout(() => {
      if (query.trim()) {
        const filtered = mockSearchResults.filter(
          (result) =>
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            result.description.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);
  }, []);

  // Handle suggestion action
  const handleSuggestionAction = useCallback(
    (action: string) => {
      switch (action) {
        case "dashboard":
          onNavigate?.("dashboard");
          break;
        case "search":
          document.getElementById("search-input")?.focus();
          break;
        case "popular":
          setSelectedCategory("popular");
          break;
        case "help":
          setShowHelp(true);
          break;
        case "report":
          setShowReportModal(true);
          break;
        default:
          onNavigate?.(action);
      }
    },
    [onNavigate]
  );

  // Handle search result click
  const handleSearchResultClick = useCallback(
    (result: SearchResult) => {
      onNavigate?.(result.path.replace("/", ""));
    },
    [onNavigate]
  );

  // Copy current path
  const copyPath = useCallback(() => {
    const path = errorInfo?.path || window.location.pathname;
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  }, [errorInfo]);

  // Submit error report
  const submitReport = useCallback(async () => {
    if (!reportMessage.trim()) return;

    setIsSubmittingReport(true);

    // Mock report submission
    setTimeout(() => {
      const reportData = {
        message: reportMessage,
        email: reportEmail,
        path: errorInfo?.path || window.location.pathname,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
      };

      console.warn("Error Report Submitted:", reportData);

      // In production, send to backend
      // await fetch('/api/error-report', { method: 'POST', body: JSON.stringify(reportData) });

      setIsSubmittingReport(false);
      setShowReportModal(false);
      setReportMessage("");
      setReportEmail("");

      // Show success message
      alert("Thank you for your report! We'll look into this issue.");
    }, 1000);
  }, [reportMessage, reportEmail, errorInfo]);

  // Filter suggestions by category
  const filteredSuggestions = suggestions.filter(
    (suggestion) => selectedCategory === "all" || suggestion.category === selectedCategory
  );

  // Filter search results by category
  const filteredSearchResults = searchResults.filter(
    (result) => selectedCategory === "all" || result.category === selectedCategory
  );

  return (
    <div className={styles.enhancedNotFoundPage}>
      {/* Background Animation */}
      <div className={styles.backgroundAnimation}>
        <div className={styles.orbitalRing} />
        <div className={styles.orbitalRing} />
        <div className={styles.orbitalRing} />
        <motion.div
          className={styles.floatingIcon}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <Compass size={40} />
        </motion.div>
        <motion.div
          className={styles.floatingIcon}
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        >
          <Telescope size={30} />
        </motion.div>
        <motion.div
          className={styles.floatingIcon}
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Radar size={25} />
        </motion.div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className={styles.iconContainer}>
            <motion.div
              className={styles.errorIcon}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <AlertTriangle size={48} />
            </motion.div>
          </div>

          <h1 className={styles.title}>Page Not Found</h1>
          <p className={styles.description}>
            The page you're looking for doesn't exist or is under development. Let's help you find
            what you need.
          </p>

          <div className={styles.errorInfo}>
            <span className={styles.errorCode}>Error Code: 404</span>
            <button onClick={copyPath} className={styles.copyButton} title="Copy path">
              {copiedPath ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copiedPath ? "Copied!" : "Copy Path"}
            </button>
          </div>
        </motion.div>

        {/* Search Section */}
        <motion.div
          className={styles.searchSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <Search size={20} className={styles.searchIcon} />
              <input
                id="search-input"
                type="text"
                placeholder="Search for pages, features, or help..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className={styles.clearButton}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className={styles.searchControls}>
              <div className={styles.categoryFilter}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.categorySelect}
                >
                  <option value="all">All Categories</option>
                  <option value="navigation">Navigation</option>
                  <option value="search">Search</option>
                  <option value="help">Help</option>
                  <option value="popular">Popular</option>
                </select>
              </div>

              <div className={styles.viewModeToggle}>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`${styles.viewModeButton} ${viewMode === "grid" ? styles.active : ""}`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`${styles.viewModeButton} ${viewMode === "list" ? styles.active : ""}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Search Results */}
          <AnimatePresence>
            {(searchQuery || searchResults.length > 0) && (
              <motion.div
                className={styles.searchResults}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {isSearching ? (
                  <div className={styles.searching}>
                    <RefreshCw className={styles.spinning} size={20} />
                    <span>Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className={`${styles.resultsGrid} ${styles[viewMode]}`}>
                    {filteredSearchResults.map((result) => (
                      <motion.div
                        key={result.id}
                        className={styles.resultItem}
                        onClick={() => handleSearchResultClick(result)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={styles.resultIcon}>{result.icon}</div>
                        <div className={styles.resultContent}>
                          <h3>{result.title}</h3>
                          <p>{result.description}</p>
                          <span className={styles.resultPath}>{result.path}</span>
                        </div>
                        <ChevronRight size={16} className={styles.resultArrow} />
                      </motion.div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className={styles.noResults}>
                    <FileQuestion size={48} />
                    <h3>No results found</h3>
                    <p>Try searching for different keywords or browse suggestions below.</p>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Suggestions Section */}
        <motion.div
          className={styles.suggestionsSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className={styles.suggestionsHeader}>
            <h2>Helpful Suggestions</h2>
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={styles.toggleButton}
            >
              {showSuggestions ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                className={styles.suggestionsGrid}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {filteredSuggestions.map((suggestion) => (
                  <motion.button
                    key={suggestion.id}
                    onClick={() => handleSuggestionAction(suggestion.action)}
                    className={styles.suggestionCard}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={styles.suggestionIcon}>{suggestion.icon}</div>
                    <div className={styles.suggestionContent}>
                      <h3>{suggestion.title}</h3>
                      <p>{suggestion.description}</p>
                    </div>
                    <ChevronRight size={16} className={styles.suggestionArrow} />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className={styles.quickActions}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <button onClick={() => window.history.back()} className={styles.actionButton}>
            <ArrowLeft size={16} />
            Go Back
          </button>

          <button onClick={() => window.location.reload()} className={styles.actionButton}>
            <RefreshCw size={16} />
            Refresh Page
          </button>

          <button onClick={() => setShowReportModal(true)} className={styles.actionButton}>
            <MessageSquare size={16} />
            Report Issue
          </button>

          <button onClick={() => setShowHelp(true)} className={styles.actionButton}>
            <HelpCircle size={16} />
            Get Help
          </button>
        </motion.div>
      </div>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.modalHeader}>
                <h3>Help & Support</h3>
                <button onClick={() => setShowHelp(false)} className={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.helpSection}>
                  <h4>Common Solutions</h4>
                  <ul>
                    <li>Check if the URL is spelled correctly</li>
                    <li>Try using the search bar above</li>
                    <li>Navigate back to the previous page</li>
                    <li>Contact support if the problem persists</li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Popular Pages</h4>
                  <div className={styles.quickLinks}>
                    <button onClick={() => onNavigate?.("dashboard")}>
                      <Home size={16} />
                      Dashboard
                    </button>
                    <button onClick={() => onNavigate?.("file-browser")}>
                      <HardDrive size={16} />
                      File Browser
                    </button>
                    <button onClick={() => onNavigate?.("settings")}>
                      <Settings size={16} />
                      Settings
                    </button>
                  </div>
                </div>

                <div className={styles.helpSection}>
                  <h4>Contact Support</h4>
                  <div className={styles.contactInfo}>
                    <div className={styles.contactItem}>
                      <Mail size={16} />
                      support@spaceanalyzer.com
                    </div>
                    <div className={styles.contactItem}>
                      <MessageSquare size={16} />
                      Live Chat Available
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.modalHeader}>
                <h3>Report Issue</h3>
                <button onClick={() => setShowReportModal(false)} className={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.reportForm}>
                  <div className={styles.formGroup}>
                    <label>What went wrong?</label>
                    <textarea
                      value={reportMessage}
                      onChange={(e) => setReportMessage(e.target.value)}
                      placeholder="Please describe the issue you encountered..."
                      className={styles.textarea}
                      rows={4}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Email (optional)</label>
                    <input
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="your@email.com"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formActions}>
                    <button
                      onClick={() => setShowReportModal(false)}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitReport}
                      disabled={!reportMessage.trim() || isSubmittingReport}
                      className={styles.submitButton}
                    >
                      {isSubmittingReport ? (
                        <>
                          <RefreshCw className={styles.spinning} size={16} />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Submit Report
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedNotFoundPage;
