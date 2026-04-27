import React, { createContext, useContext, useReducer, ReactNode } from "react";

// UI Context State
interface UIState {
  theme: "light" | "dark" | "auto";
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  loadingStates: Record<string, boolean>;
  modalStates: Record<string, boolean>;
  notifications: Array<{
    id: string;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>;
  breadcrumbs: Array<{
    label: string;
    path: string;
  }>;
  searchQuery: string;
  activeView: string;
  layout: {
    showToolbar: boolean;
    showStatusBar: boolean;
    showMinimap: boolean;
  };
}

// UI Context Actions
type UIAction =
  | { type: "SET_THEME"; payload: UIState["theme"] }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_SIDEBAR_WIDTH"; payload: number }
  | { type: "SET_LOADING_STATE"; payload: { key: string; loading: boolean } }
  | { type: "SET_MODAL_STATE"; payload: { key: string; open: boolean } }
  | {
      type: "ADD_NOTIFICATION";
      payload: Omit<UIState["notifications"][0], "id" | "timestamp" | "read">;
    }
  | { type: "REMOVE_NOTIFICATION"; payload: string }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "CLEAR_NOTIFICATIONS" }
  | { type: "SET_BREADCRUMBS"; payload: UIState["breadcrumbs"] }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_ACTIVE_VIEW"; payload: string }
  | { type: "UPDATE_LAYOUT"; payload: Partial<UIState["layout"]> };

// Initial state
const initialUIState: UIState = {
  theme: "dark",
  sidebarCollapsed: false,
  sidebarWidth: 280,
  loadingStates: {},
  modalStates: {},
  notifications: [],
  breadcrumbs: [],
  searchQuery: "",
  activeView: "dashboard",
  layout: {
    showToolbar: true,
    showStatusBar: true,
    showMinimap: false,
  },
};

// Reducer function
function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "SET_THEME":
      return { ...state, theme: action.payload };

    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case "SET_SIDEBAR_WIDTH":
      return { ...state, sidebarWidth: action.payload };

    case "SET_LOADING_STATE":
      return {
        ...state,
        loadingStates: {
          ...state.loadingStates,
          [action.payload.key]: action.payload.loading,
        },
      };

    case "SET_MODAL_STATE":
      return {
        ...state,
        modalStates: {
          ...state.modalStates,
          [action.payload.key]: action.payload.open,
        },
      };

    case "ADD_NOTIFICATION":
      const newNotification = {
        ...action.payload,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false,
      };
      return {
        ...state,
        notifications: [newNotification, ...state.notifications],
      };

    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.payload),
      };

    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };

    case "CLEAR_NOTIFICATIONS":
      return { ...state, notifications: [] };

    case "SET_BREADCRUMBS":
      return { ...state, breadcrumbs: action.payload };

    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };

    case "SET_ACTIVE_VIEW":
      return { ...state, activeView: action.payload };

    case "UPDATE_LAYOUT":
      return {
        ...state,
        layout: { ...state.layout, ...action.payload },
      };

    default:
      return state;
  }
}

// Context
const UIContext = createContext<{
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
  actions: {
    setTheme: (theme: UIState["theme"]) => void;
    toggleSidebar: () => void;
    setSidebarWidth: (width: number) => void;
    setLoadingState: (key: string, loading: boolean) => void;
    setModalState: (key: string, open: boolean) => void;
    addNotification: (
      notification: Omit<UIState["notifications"][0], "id" | "timestamp" | "read">
    ) => void;
    removeNotification: (id: string) => void;
    markNotificationRead: (id: string) => void;
    clearNotifications: () => void;
    setBreadcrumbs: (breadcrumbs: UIState["breadcrumbs"]) => void;
    setSearchQuery: (query: string) => void;
    setActiveView: (view: string) => void;
    updateLayout: (layout: Partial<UIState["layout"]>) => void;
  };
  selectors: {
    isLoading: (key?: string) => boolean;
    getUnreadNotifications: () => UIState["notifications"];
    getCurrentTheme: () => UIState["theme"];
    isSidebarCollapsed: () => boolean;
    isModalOpen: (key: string) => boolean;
  };
} | null>(null);

// Provider component
export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);

  // Action creators
  const actions = {
    setTheme: (theme: UIState["theme"]) => {
      dispatch({ type: "SET_THEME", payload: theme });
    },

    toggleSidebar: () => {
      dispatch({ type: "TOGGLE_SIDEBAR" });
    },

    setSidebarWidth: (width: number) => {
      dispatch({ type: "SET_SIDEBAR_WIDTH", payload: width });
    },

    setLoadingState: (key: string, loading: boolean) => {
      dispatch({ type: "SET_LOADING_STATE", payload: { key, loading } });
    },

    setModalState: (key: string, open: boolean) => {
      dispatch({ type: "SET_MODAL_STATE", payload: { key, open } });
    },

    addNotification: (
      notification: Omit<UIState["notifications"][0], "id" | "timestamp" | "read">
    ) => {
      dispatch({ type: "ADD_NOTIFICATION", payload: notification });
    },

    removeNotification: (id: string) => {
      dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
    },

    markNotificationRead: (id: string) => {
      dispatch({ type: "MARK_NOTIFICATION_READ", payload: id });
    },

    clearNotifications: () => {
      dispatch({ type: "CLEAR_NOTIFICATIONS" });
    },

    setBreadcrumbs: (breadcrumbs: UIState["breadcrumbs"]) => {
      dispatch({ type: "SET_BREADCRUMBS", payload: breadcrumbs });
    },

    setSearchQuery: (query: string) => {
      dispatch({ type: "SET_SEARCH_QUERY", payload: query });
    },

    setActiveView: (view: string) => {
      dispatch({ type: "SET_ACTIVE_VIEW", payload: view });
    },

    updateLayout: (layout: Partial<UIState["layout"]>) => {
      dispatch({ type: "UPDATE_LAYOUT", payload: layout });
    },
  };

  // Selectors
  const selectors = {
    isLoading: (key?: string) => {
      if (key) return state.loadingStates[key] || false;
      return Object.values(state.loadingStates).some(Boolean);
    },

    getUnreadNotifications: () => {
      return state.notifications.filter((n) => !n.read);
    },

    getCurrentTheme: () => {
      return state.theme;
    },

    isSidebarCollapsed: () => {
      return state.sidebarCollapsed;
    },

    isModalOpen: (key: string) => {
      return state.modalStates[key] || false;
    },
  };

  const value = {
    state,
    dispatch,
    actions,
    selectors,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

// Custom hook to use the UI context
export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within a UIProvider");
  }
  return context;
};

// Selector hooks for specific parts of the state
export const useTheme = () => {
  const { state, actions } = useUIContext();
  return {
    theme: state.theme,
    setTheme: actions.setTheme,
  };
};

export const useSidebar = () => {
  const { state, actions } = useUIContext();
  return {
    collapsed: state.sidebarCollapsed,
    width: state.sidebarWidth,
    toggle: actions.toggleSidebar,
    setWidth: actions.setSidebarWidth,
  };
};

export const useLoadingStates = () => {
  const { actions, selectors } = useUIContext();
  return {
    setLoadingState: actions.setLoadingState,
    isLoading: selectors.isLoading,
  };
};

export const useNotifications = () => {
  const { state, actions, selectors } = useUIContext();
  return {
    notifications: state.notifications,
    unreadNotifications: selectors.getUnreadNotifications(),
    addNotification: actions.addNotification,
    removeNotification: actions.removeNotification,
    markNotificationRead: actions.markNotificationRead,
    clearNotifications: actions.clearNotifications,
  };
};

export const useBreadcrumbs = () => {
  const { state, actions } = useUIContext();
  return {
    breadcrumbs: state.breadcrumbs,
    setBreadcrumbs: actions.setBreadcrumbs,
  };
};

export const useSearch = () => {
  const { state, actions } = useUIContext();
  return {
    searchQuery: state.searchQuery,
    setSearchQuery: actions.setSearchQuery,
  };
};

export const useActiveView = () => {
  const { state, actions } = useUIContext();
  return {
    activeView: state.activeView,
    setActiveView: actions.setActiveView,
  };
};

export const useLayout = () => {
  const { state, actions } = useUIContext();
  return {
    layout: state.layout,
    updateLayout: actions.updateLayout,
  };
};
