// Custom hook for managing navigation state
import { useState, useCallback } from 'react';

type ViewType = 'dashboard' | 'neural' | 'chat' | 'treemap' | 'export' | 'browser' | 'settings' | 'timeline' | 'system' | '3d' | 'predictions' | 'learning' | 'codeanalysis' | 'duplicates' | 'dependencies';

export const useNavigationState = (initialView: ViewType = 'dashboard') => {
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navigateTo = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return {
    currentView,
    isSidebarOpen,
    navigateTo,
    toggleSidebar,
    openSidebar,
    closeSidebar,
  };
};
