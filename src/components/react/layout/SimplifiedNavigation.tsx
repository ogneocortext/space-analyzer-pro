import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  FolderSearch,
  Settings,
  Menu,
  X,
  ChevronRight,
  Home,
  Search,
  Download,
} from "lucide-react";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

interface SimplifiedNavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isMobile?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview and insights",
  },
  {
    id: "analysis",
    label: "Analysis",
    icon: BrainCircuit,
    description: "AI-powered analysis",
  },
  {
    id: "browser",
    label: "File Browser",
    icon: FolderSearch,
    description: "Browse and manage files",
  },
  {
    id: "visualizations",
    label: "Visualizations",
    icon: BarChart3,
    description: "Charts and graphs",
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    description: "Export your data",
  },
];

const SimplifiedNavigation: React.FC<SimplifiedNavigationProps> = ({
  currentView,
  onNavigate,
  isSidebarOpen,
  onToggleSidebar,
  isMobile = false,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNavigation = (itemId: string) => {
    if (!navigationItems.find((item) => item.id === itemId)?.disabled) {
      onNavigate(itemId);
      if (isMobile) {
        onToggleSidebar(); // Close sidebar on mobile after navigation
      }
    }
  };

  const renderNavigationItem = (item: NavigationItem) => {
    const isActive = currentView === item.id;
    const isHovered = hoveredItem === item.id;
    const Icon = item.icon;

    return (
      <motion.div
        key={item.id}
        className="relative"
        onHoverStart={() => setHoveredItem(item.id)}
        onHoverEnd={() => setHoveredItem(null)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <button
          onClick={() => handleNavigation(item.id)}
          disabled={item.disabled}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
            ${
              isActive
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                : item.disabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
            }
          `}
          title={item.description}
        >
          <Icon size={20} className={isActive ? "text-white" : "text-current"} />

          <div className="flex-1 text-left">
            <div className="font-medium">{item.label}</div>
            {isHovered && item.description && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs opacity-70"
              >
                {item.description}
              </motion.div>
            )}
          </div>

          {item.badge && (
            <span
              className={`
              px-2 py-1 text-xs rounded-full
              ${isActive ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-600"}
            `}
            >
              {item.badge}
            </span>
          )}

          {isActive && <ChevronRight size={16} className="text-white" />}
        </button>
      </motion.div>
    );
  };

  if (isMobile) {
    return (
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Mobile Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={onToggleSidebar}
            />

            {/* Mobile Sidebar */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 md:hidden"
            >
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <BrainCircuit size={20} className="text-white" />
                    </div>
                    <span className="font-bold text-lg">Space Analyzer</span>
                  </div>
                  <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Mobile Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {navigationItems.map(renderNavigationItem)}
                </nav>

                {/* Mobile Footer */}
                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={() => handleNavigation("settings")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
                  >
                    <Settings size={20} />
                    <span className="font-medium">Settings</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.nav
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Desktop Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <BrainCircuit size={24} className="text-white" />
          </motion.div>
          <div>
            <h1 className="font-bold text-xl text-gray-900">Space Analyzer</h1>
            <p className="text-xs text-gray-500">AI-Powered Analysis</p>
          </div>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigationItems.map(renderNavigationItem)}
      </div>

      {/* Desktop Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => handleNavigation("settings")}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
            ${
              currentView === "settings"
                ? "bg-gray-900 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }
          `}
        >
          <Settings size={20} />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </motion.nav>
  );
};

export default SimplifiedNavigation;
