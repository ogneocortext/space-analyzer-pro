import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore - react-router-dom
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  Settings,
  Folder,
  Play,
  Activity,
  AlertTriangle,
  Menu,
  X,
  Search,
  Command,
  Globe,
  Code,
  Shield,
  Zap,
  FileText,
  Database,
  Cpu,
  Network,
  Bot,
  Sparkles,
  Eye,
  TrendingUp,
  Clock,
  Star,
  Heart,
  Trophy,
  Maximize2,
  Minimize2,
  FolderOpen,
  Lightbulb,
  EyeOff,
  TrendingDown,
  CheckCircle,
  Info,
  Home,
  Users,
  Globe2,
  Database as DatabaseIcon,
  Cpu as CpuIcon,
  Network as NetworkIcon,
  Bot as BotIcon,
  Sparkles as SparklesIcon,
  Eye as EyeIcon,
  TrendingUp as TrendingUpIcon,
  Clock as ClockIcon,
  Star as StarIcon,
  Heart as HeartIcon,
  Trophy as TrophyIcon,
  Maximize2 as Maximize2Icon,
  Minimize2 as Minimize2Icon,
  FolderOpen as FolderOpenIcon,
  Lightbulb as LightbulbIcon,
  EyeOff as EyeOffIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from 'lucide-react';
import { useUIStore, useNavigationStore, useErrorStore } from '../store';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  shortcut?: string;
  category: 'primary' | 'ai' | 'analysis' | 'tools' | 'system';
  disabled?: boolean;
  beta?: boolean;
  comingSoon?: boolean;
}

const navigationItems: NavigationItem[] = [
  // Primary Navigation
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    description: 'Overview and quick analysis',
    category: 'primary',
    shortcut: 'D'
  },
  {
    id: 'neural',
    label: 'Neural View',
    path: '/neural',
    icon: BrainCircuit,
    description: 'AI-powered file relationships',
    category: 'ai',
    shortcut: 'N'
  },
  {
    id: 'ai-chat',
    label: 'AI Assistant',
    path: '/ai-chat',
    icon: MessageSquare,
    description: 'Chat with AI about your files',
    category: 'ai',
    shortcut: 'A'
  },
  {
    id: 'treemap',
    label: 'Visualizations',
    path: '/treemap',
    icon: BarChart3,
    description: 'Interactive data visualizations',
    category: 'analysis',
    shortcut: 'V'
  },
  {
    id: 'file-browser',
    label: 'File Browser',
    path: '/file-browser',
    icon: Folder,
    description: 'Browse and manage files',
    category: 'tools',
    shortcut: 'F'
  },
  {
    id: 'export',
    label: 'Export Data',
    path: '/export',
    icon: FileText,
    description: 'Export analysis results',
    category: 'tools',
    shortcut: 'E'
  },

  // AI Features
  {
    id: 'ai-insights',
    label: 'AI Insights',
    path: '/ai-insights',
    icon: Lightbulb,
    description: 'AI-generated recommendations',
    category: 'ai',
    beta: true
  },
  {
    id: 'ai-features',
    label: 'AI Features',
    path: '/ai-features',
    icon: SparklesIcon,
    description: 'Advanced AI capabilities',
    category: 'ai',
    beta: true
  },

  // Analysis Tools
  {
    id: 'time-travel',
    label: 'Time Travel',
    path: '/time-travel',
    icon: ClockIcon,
    description: 'Historical analysis comparison',
    category: 'analysis',
    beta: true
  },
  {
    id: 'temperature',
    label: 'Temperature Map',
    path: '/temperature',
    icon: EyeIcon,
    description: 'File access patterns',
    category: 'analysis',
    beta: true
  },
  {
    id: 'optimization',
    label: 'Optimization',
    path: '/optimization',
    icon: TrendingUpIcon,
    description: 'Storage optimization tools',
    category: 'tools',
    beta: true
  },

  // System Tools
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    description: 'Application settings',
    category: 'system',
    shortcut: 'S'
  },
  {
    id: 'integrations',
    label: 'Integrations',
    path: '/integrations',
    icon: NetworkIcon,
    description: 'External service connections',
    category: 'system',
    beta: true
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    path: '/monitoring',
    icon: Activity,
    description: 'System performance monitoring',
    category: 'system',
    beta: true
  },
  {
    id: 'security',
    label: 'Security',
    path: '/security',
    icon: Shield,
    description: 'Security analysis and alerts',
    category: 'system',
    beta: true
  },
  {
    id: 'automation',
    label: 'Automation',
    path: '/automation',
    icon: CpuIcon,
    description: 'Automated workflows',
    category: 'tools',
    beta: true
  }
];

const EnhancedNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Store state
  const { sidebarOpen, toggleSidebar, setActivePage, theme, fontSize } = useUIStore();
  const { breadcrumbs, updateBreadcrumbs } = useNavigationStore();
  const { globalErrors } = useErrorStore();

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation();

  // Update breadcrumbs based on current location
  useEffect(() => {
    const currentPath = location.pathname;
    const currentItem = navigationItems.find(item => item.path === currentPath);
    
    if (currentItem) {
      setActivePage(currentItem.id);
      updateBreadcrumbs(currentPath, currentItem.label);
    }
  }, [location.pathname, setActivePage, updateBreadcrumbs]);

  // Filter navigation items based on search
  const filteredItems = navigationItems.filter(item => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NavigationItem[]>);

  const handleNavigation = useCallback((item: NavigationItem) => {
    if (item.disabled || item.comingSoon) return;
    
    navigate(item.path);
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  }, [navigate, toggleSidebar]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setIsSearchFocused(false);
    }
  };

  const hasErrors = globalErrors.length > 0;

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-blue-400" />
              <span className="font-semibold text-white">Space Analyzer</span>
            </div>
          </div>
          
          {/* Error Indicator */}
          {hasErrors && (
            <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-300">{globalErrors.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 md:static md:inset-0`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">Space Analyzer</h1>
              <p className="text-xs text-slate-400">Pro Edition</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {isSearchFocused && filteredItems.length > 0 && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-auto">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700 last:border-b-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-slate-300" />
                      <div>
                        <div className="text-white text-sm font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-slate-400">{item.description}</div>
                        )}
                      </div>
                    </div>
                    {item.beta && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                        Beta
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Categories */}
        <nav className="flex-1 overflow-y-auto py-4">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="mb-6">
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </div>
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item)}
                    disabled={item.disabled || item.comingSoon}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      location.pathname === item.path
                        ? 'bg-blue-500/20 text-blue-300 border-r-2 border-blue-400'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    } ${
                      item.disabled || item.comingSoon
                        ? 'opacity-50 cursor-not-allowed hover:bg-transparent'
                        : 'cursor-pointer'
                    }`}
                    title={item.description}
                  >
                    <item.icon className={`w-4 h-4 ${
                      location.pathname === item.path ? 'text-blue-400' : 'text-slate-400'
                    }`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600">
                        {item.shortcut}
                      </kbd>
                    )}
                    {item.beta && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                        Beta
                      </span>
                    )}
                    {item.comingSoon && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
                        Soon
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-900/50 p-4">
          {/* Error Status */}
          {/* @ts-ignore - hasErrors type */}
          {hasErrors > 0 && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">Errors</span>
                </div>
                <span className="text-xs text-red-400">{globalErrors.length}</span>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>Theme</span>
              <span className="text-slate-300 capitalize">{theme}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Font Size</span>
              <span className="text-slate-300 capitalize">{fontSize}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Version</span>
              <span className="text-slate-300">2.0.1</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
};

export default EnhancedNavigation;