import React, { useState, useEffect } from "react";
import styles from "./SmartNavigation.module.css";

interface NavigationItem {
  id: string;
  title: string;
  path: string;
  category: string;
  icon?: string;
  description?: string;
  keywords?: string[];
}

interface SmartNavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userHistory?: string[];
  maxSuggestions?: number;
}

const SmartNavigation: React.FC<SmartNavigationProps> = ({
  currentPage,
  onNavigate,
  userHistory = [],
  maxSuggestions = 5,
}) => {
  const [suggestedPages, setSuggestedPages] = useState<NavigationItem[]>([]);
  const [recentPages, setRecentPages] = useState<NavigationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const allPages: NavigationItem[] = [
    {
      id: "dashboard",
      title: "Dashboard",
      path: "dashboard",
      category: "Main",
      icon: "📊",
      description: "Main dashboard with overview",
      keywords: ["home", "main", "overview", "start"],
    },
    {
      id: "file-browser",
      title: "File Browser",
      path: "file-browser",
      category: "Analyze",
      icon: "📁",
      description: "Browse and explore files",
      keywords: ["files", "browse", "explore", "directory"],
    },
    {
      id: "neural",
      title: "Neural View",
      path: "neural",
      category: "Visualize",
      icon: "🧠",
      description: "Neural network visualization",
      keywords: ["neural", "network", "connections", "relationships"],
    },
    {
      id: "treemap",
      title: "Storage Treemap",
      path: "treemap",
      category: "Visualize",
      icon: "🗺️",
      description: "Visual storage representation",
      keywords: ["treemap", "storage", "visualization", "size"],
    },
    {
      id: "temperature",
      title: "File Temperature",
      path: "temperature",
      category: "Visualize",
      icon: "🌡️",
      description: "File access heatmap",
      keywords: ["temperature", "heatmap", "access", "frequency"],
    },
    {
      id: "ai-features",
      title: "AI Features",
      path: "ai-features",
      category: "AI Insights",
      icon: "🤖",
      description: "AI-powered analysis tools",
      keywords: ["ai", "artificial", "intelligence", "analysis"],
    },
    {
      id: "chat",
      title: "AI Assistant",
      path: "chat",
      category: "AI Insights",
      icon: "💬",
      description: "Chat with AI assistant",
      keywords: ["chat", "assistant", "help", "ai"],
    },
    {
      id: "smart-analysis",
      title: "Smart Analysis",
      path: "smart-analysis",
      category: "Analyze",
      icon: "⚡",
      description: "Intelligent file analysis",
      keywords: ["smart", "analysis", "intelligent", "insights"],
    },
    {
      id: "duplicates",
      title: "Duplicate Files",
      path: "duplicates",
      category: "Analyze",
      icon: "🔄",
      description: "Find duplicate files",
      keywords: ["duplicates", "duplicate", "copies", "repeat"],
    },
    {
      id: "timetravel",
      title: "Time Travel",
      path: "timetravel",
      category: "Tools",
      icon: "⏰",
      description: "Compare file snapshots",
      keywords: ["time", "travel", "history", "compare", "snapshots"],
    },
    {
      id: "export",
      title: "Export Data",
      path: "export",
      category: "Tools",
      icon: "📤",
      description: "Export analysis results",
      keywords: ["export", "save", "download", "results"],
    },
    {
      id: "settings",
      title: "Settings",
      path: "settings",
      category: "System",
      icon: "⚙️",
      description: "Application settings",
      keywords: ["settings", "preferences", "config", "options"],
    },
  ];

  useEffect(() => {
    // Generate suggestions based on user history and current page
    const generateSuggestions = () => {
      const suggestions: NavigationItem[] = [];

      // Add pages from user history that aren't current page
      const historySuggestions = userHistory
        .filter((page) => page !== currentPage)
        .slice(0, 3)
        .map((pageId) => allPages.find((p) => p.id === pageId))
        .filter(Boolean) as NavigationItem[];

      suggestions.push(...historySuggestions);

      // Add contextual suggestions based on current page
      const contextualSuggestions = getContextualSuggestions(currentPage);
      suggestions.push(...contextualSuggestions);

      // Remove duplicates and limit
      const uniqueSuggestions = Array.from(
        new Map(suggestions.map((item) => [item.id, item])).values()
      ).slice(0, maxSuggestions);

      setSuggestedPages(uniqueSuggestions);
    };

    generateSuggestions();
  }, [currentPage, userHistory, maxSuggestions]);

  useEffect(() => {
    // Set recent pages from history
    const recent = userHistory
      .slice(-5)
      .map((pageId) => allPages.find((p) => p.id === pageId))
      .filter(Boolean) as NavigationItem[];

    setRecentPages(recent);
  }, [userHistory]);

  const getContextualSuggestions = (current: string): NavigationItem[] => {
    const contextMap: Record<string, string[]> = {
      dashboard: ["file-browser", "ai-features", "neural"],
      "file-browser": ["smart-analysis", "duplicates", "treemap"],
      neural: ["treemap", "temperature", "ai-features"],
      treemap: ["temperature", "file-browser", "smart-analysis"],
      temperature: ["neural", "timetravel", "file-browser"],
      "ai-features": ["chat", "smart-analysis", "dashboard"],
      chat: ["ai-features", "dashboard", "file-browser"],
      "smart-analysis": ["duplicates", "export", "ai-features"],
      duplicates: ["file-browser", "export", "smart-analysis"],
      timetravel: ["export", "temperature", "dashboard"],
      export: ["settings", "dashboard", "timetravel"],
      settings: ["dashboard", "ai-features"],
    };

    const suggestionIds = contextMap[current] || [];
    return suggestionIds
      .map((id) => allPages.find((p) => p.id === id))
      .filter(Boolean) as NavigationItem[];
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setShowSearch(false);
      return;
    }

    const results = allPages.filter((page) => {
      const searchStr = query.toLowerCase();
      return (
        page.title.toLowerCase().includes(searchStr) ||
        page.description?.toLowerCase().includes(searchStr) ||
        page.keywords?.some((keyword) => keyword.toLowerCase().includes(searchStr)) ||
        page.category.toLowerCase().includes(searchStr)
      );
    });

    if (results.length > 0) {
      setSuggestedPages(results.slice(0, maxSuggestions));
      setShowSearch(true);
    } else {
      setShowSearch(false);
    }
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setSearchQuery("");
    setShowSearch(false);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "start-analysis":
        handleNavigate("file-browser");
        break;
      case "ai-chat":
        handleNavigate("chat");
        break;
      case "view-dashboard":
        handleNavigate("dashboard");
        break;
      case "settings":
        handleNavigate("settings");
        break;
    }
  };

  return (
    <nav className={styles.smartNavigation}>
      {/* Breadcrumb Navigation */}
      <div className={styles.breadcrumb}>
        <div className={styles.breadcrumbItems}>
          <button className={styles.breadcrumbItem} onClick={() => handleNavigate("dashboard")}>
            Home
          </button>
          {currentPage !== "dashboard" && (
            <>
              <span className={styles.breadcrumbSeparator}>/</span>
              <button className={styles.breadcrumbItem} onClick={() => handleNavigate(currentPage)}>
                {allPages.find((p) => p.id === currentPage)?.title || currentPage}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <button
          className={styles.quickActionButton}
          onClick={() => handleQuickAction("start-analysis")}
          title="Start Analysis"
        >
          <span className={styles.quickActionIcon}>🔍</span>
        </button>
        <button
          className={styles.quickActionButton}
          onClick={() => handleQuickAction("ai-chat")}
          title="AI Assistant"
        >
          <span className={styles.quickActionIcon}>💬</span>
        </button>
        <button
          className={styles.quickActionButton}
          onClick={() => handleQuickAction("view-dashboard")}
          title="Dashboard"
        >
          <span className={styles.quickActionIcon}>📊</span>
        </button>
        <button
          className={styles.quickActionButton}
          onClick={() => handleQuickAction("settings")}
          title="Settings"
        >
          <span className={styles.quickActionIcon}>⚙️</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search pages..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
        />
        {searchQuery && (
          <button
            className={styles.clearButton}
            onClick={() => {
              setSearchQuery("");
              setShowSearch(false);
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Search Results/Suggestions */}
      {(showSearch || suggestedPages.length > 0) && (
        <div className={styles.suggestionsPanel}>
          {searchQuery && <div className={styles.suggestionsHeader}>Search Results</div>}

          <div className={styles.suggestionsList}>
            {suggestedPages.map((page) => (
              <button
                key={page.id}
                className={styles.suggestionItem}
                onClick={() => handleNavigate(page.id)}
              >
                <div className={styles.suggestionIcon}>{page.icon}</div>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTitle}>{page.title}</div>
                  <div className={styles.suggestionDescription}>{page.description}</div>
                  <div className={styles.suggestionCategory}>{page.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Pages */}
      {recentPages.length > 0 && !showSearch && (
        <div className={styles.recentPages}>
          <div className={styles.recentPagesHeader}>Recent</div>
          <div className={styles.recentPagesList}>
            {recentPages.map((page) => (
              <button
                key={page.id}
                className={styles.recentPageItem}
                onClick={() => handleNavigate(page.id)}
              >
                <span className={styles.recentPageIcon}>{page.icon}</span>
                <span className={styles.recentPageTitle}>{page.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default SmartNavigation;
