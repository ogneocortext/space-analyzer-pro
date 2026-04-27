import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, Focus, Grid3X3, List, Eye, EyeOff, Zap } from "lucide-react";
import Sidebar from "../navigation/Sidebar";
import PageContainer from "./PageContainer";
import Breadcrumb, { generateBreadcrumbs } from "../shared/Breadcrumb";
import LoadingState from "../shared/LoadingState";
import styles from "../../styles/components/AppLayout.module.css";

interface AppLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
  isLoading?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  currentPage,
  onNavigate,
  children,
  isLoading = false,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<"default" | "compact" | "immersive">("default");
  const [showContextualHints, setShowContextualHints] = useState(true);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed]);

  const handleToggleFocusMode = useCallback(() => {
    setFocusMode(!focusMode);
    // Auto-collapse sidebar in focus mode for more screen real estate
    if (!focusMode) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [focusMode]);

  const handleViewModeChange = useCallback((mode: "default" | "compact" | "immersive") => {
    setViewMode(mode);
  }, []);

  // Keyboard shortcuts for enhanced UX
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        switch (event.key) {
          case "f":
            event.preventDefault();
            handleToggleFocusMode();
            break;
          case "c":
            event.preventDefault();
            setViewMode((prev) => (prev === "compact" ? "default" : "compact"));
            break;
          case "i":
            event.preventDefault();
            setViewMode((prev) => (prev === "immersive" ? "default" : "immersive"));
            break;
          case "h":
            event.preventDefault();
            setShowContextualHints(!showContextualHints);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleFocusMode, showContextualHints]);

  // Show breadcrumbs on all pages except dashboard
  const showBreadcrumbs = currentPage !== "dashboard" && !focusMode;
  const breadcrumbItems = generateBreadcrumbs(currentPage);

  // Dynamic layout classes based on modes
  const layoutClasses = [
    styles.appLayout,
    focusMode && styles.focusMode,
    viewMode === "compact" && styles.compactMode,
    viewMode === "immersive" && styles.immersiveMode,
    sidebarCollapsed && styles.sidebarCollapsed,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClasses}>
      {/* Enhanced Sidebar with focus mode support */}
      <AnimatePresence>
        {!focusMode && (
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Sidebar
              currentPage={currentPage}
              onNavigate={onNavigate}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PageContainer className={sidebarCollapsed ? styles.sidebarCollapsed : ""}>
        {/* Enhanced Header with Quick Actions */}
        <motion.div
          className={styles.layoutHeader}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Quick Actions Toggle */}
          <div className={styles.quickActionsContainer}>
            <button
              onClick={() => setQuickActionsVisible(!quickActionsVisible)}
              className={`${styles.quickActionsToggle} ${quickActionsVisible ? styles.active : ""}`}
              aria-label="Toggle quick actions"
              title="Quick Actions (Alt+Q)"
            >
              <Zap size={16} />
            </button>

            <AnimatePresence>
              {quickActionsVisible && (
                <motion.div
                  className={styles.quickActionsPanel}
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Focus Mode Toggle */}
                  <button
                    onClick={handleToggleFocusMode}
                    className={`${styles.quickActionBtn} ${focusMode ? styles.active : ""}`}
                    title={`Focus Mode (${focusMode ? "On" : "Off"}) - Alt+F`}
                  >
                    {focusMode ? <EyeOff size={14} /> : <Focus size={14} />}
                    <span>{focusMode ? "Exit Focus" : "Focus"}</span>
                  </button>

                  {/* View Mode Toggle */}
                  <button
                    onClick={() =>
                      handleViewModeChange(viewMode === "compact" ? "default" : "compact")
                    }
                    className={`${styles.quickActionBtn} ${viewMode === "compact" ? styles.active : ""}`}
                    title="Compact View - Alt+C"
                  >
                    <Grid3X3 size={14} />
                    <span>Compact</span>
                  </button>

                  {/* Immersive Mode Toggle */}
                  <button
                    onClick={() =>
                      handleViewModeChange(viewMode === "immersive" ? "default" : "immersive")
                    }
                    className={`${styles.quickActionBtn} ${viewMode === "immersive" ? styles.active : ""}`}
                    title="Immersive View - Alt+I"
                  >
                    <Maximize2 size={14} />
                    <span>Immersive</span>
                  </button>

                  {/* Contextual Hints Toggle */}
                  <button
                    onClick={() => setShowContextualHints(!showContextualHints)}
                    className={`${styles.quickActionBtn} ${showContextualHints ? styles.active : ""}`}
                    title={`Contextual Hints (${showContextualHints ? "On" : "Off"}) - Alt+H`}
                  >
                    {showContextualHints ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>Hints</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Keyboard Shortcuts Hint */}
          {showContextualHints && (
            <motion.div
              className={styles.keyboardHints}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.3 }}
            >
              <span className={styles.hintText}>
                =� Press <kbd>Alt+F</kbd> for focus mode, <kbd>Alt+?</kbd> for shortcuts
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Breadcrumbs with enhanced styling */}
        <AnimatePresence>
          {showBreadcrumbs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Breadcrumb
                items={breadcrumbItems}
                onNavigate={onNavigate}
                className={styles.breadcrumbContainer}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced Content Area */}
        <motion.div className={styles.contentArea} layout transition={{ duration: 0.3 }}>
          {isLoading ? (
            <LoadingState message="Loading page..." />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {children}
            </motion.div>
          )}
        </motion.div>

        {/* Focus Mode Overlay */}
        <AnimatePresence>
          {focusMode && (
            <motion.div
              className={styles.focusOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.focusIndicator}>
                <Focus size={20} />
                <span>Focus Mode Active</span>
                <button
                  onClick={handleToggleFocusMode}
                  className={styles.exitFocusBtn}
                  aria-label="Exit focus mode"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PageContainer>
    </div>
  );
};

export default AppLayout;
