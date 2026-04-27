import React, { useState, useEffect, useRef } from "react";
import { FolderOpen, Search, Settings, BarChart3, Sparkles } from "lucide-react";

interface MoeOptimizedLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

/**
 * MoE-Optimized Layout Component
 * Implements visual hierarchy, layout optimization, and accessibility improvements
 * Based on 5 AI models' recommendations
 */
const MoeOptimizedLayout: React.FC<MoeOptimizedLayoutProps> = ({
  children,
  currentPage = "landing",
  onNavigate = () => {},
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Performance optimization: lazy load content
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Accessibility: keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsMenuOpen(false);
    }
  };

  const navigationItems = [
    { id: "landing", label: "Home", icon: FolderOpen, color: "text-blue-600" },
    { id: "dashboard", label: "Dashboard", icon: BarChart3, color: "text-green-600" },
    { id: "explorer", label: "Explorer", icon: Search, color: "text-purple-600" },
    { id: "settings", label: "Settings", icon: Settings, color: "text-gray-600" },
    { id: "ai-insights", label: "AI Insights", icon: Sparkles, color: "text-orange-600" },
  ];

  return (
    <div
      ref={containerRef}
      className={`moe-improved min-h-screen bg-gray-50 ${isLoaded ? "loaded" : "lazy-load"}`}
      onKeyDown={handleKeyDown}
    >
      {/* Header with improved visual hierarchy */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Logo and title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Space Analyzer Pro</h1>
              </div>
            </div>

            {/* Navigation - Desktop */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentPage === item.id
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                    aria-label={`Navigate to ${item.label}`}
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile navigation - Improved layout */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="container py-2">
              <nav className="flex flex-col space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === item.id
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                      aria-label={`Navigate to ${item.label}`}
                    >
                      <Icon className={`w-4 h-4 ${item.color}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main content - Optimized layout */}
      <main className="flex-1">
        <div className="container py-6">
          {/* Page header with improved hierarchy */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {navigationItems.find((item) => item.id === currentPage)?.label || "Page"}
            </h2>
            <p className="text-gray-600">
              {currentPage === "landing" &&
                "Welcome to Space Analyzer Pro - Your intelligent file analysis solution"}
              {currentPage === "dashboard" && "View your analysis results and insights"}
              {currentPage === "explorer" && "Browse and analyze your files"}
              {currentPage === "settings" && "Configure your analysis preferences"}
              {currentPage === "ai-insights" && "AI-powered recommendations and insights"}
            </p>
          </div>

          {/* Content area with loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          ) : (
            <div className="space-y-6">{children}</div>
          )}
        </div>
      </main>

      {/* Footer - Improved accessibility */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="container py-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <p className="text-sm text-gray-600">© 2026 Space Analyzer Pro. Powered by AI.</p>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Version 2.0.1</span>
              <span>•</span>
              <span>MoE Optimized</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MoeOptimizedLayout;
