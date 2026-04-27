import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { TransformedFileData } from "../utils/dataTransformers";

// File Context State
interface FileState {
  files: TransformedFileData[];
  selectedFiles: Set<string>;
  currentPath: string;
  loading: boolean;
  error: string | null;
  filters: {
    search?: string;
    categories?: string[];
    sizeRange?: [number, number];
    dateRange?: [Date, Date];
    extensions?: string[];
  };
  sortOptions: {
    sortBy: "name" | "size" | "modified" | "type" | "path";
    direction: "asc" | "desc";
  };
}

// File Context Actions
type FileAction =
  | { type: "SET_FILES"; payload: TransformedFileData[] }
  | { type: "SET_SELECTED_FILES"; payload: Set<string> }
  | { type: "SET_CURRENT_PATH"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_FILTERS"; payload: Partial<FileState["filters"]> }
  | { type: "SET_SORT_OPTIONS"; payload: FileState["sortOptions"] }
  | { type: "CLEAR_FILTERS" }
  | { type: "CLEAR_SELECTION" }
  | { type: "SELECT_FILE"; payload: string }
  | { type: "DESELECT_FILE"; payload: string }
  | { type: "TOGGLE_FILE_SELECTION"; payload: string };

// Initial state
const initialFileState: FileState = {
  files: [],
  selectedFiles: new Set(),
  currentPath: "",
  loading: false,
  error: null,
  filters: {},
  sortOptions: {
    sortBy: "name",
    direction: "asc",
  },
};

// Reducer function
function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case "SET_FILES":
      return { ...state, files: action.payload };

    case "SET_SELECTED_FILES":
      return { ...state, selectedFiles: action.payload };

    case "SET_CURRENT_PATH":
      return { ...state, currentPath: action.payload };

    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.payload } };

    case "SET_SORT_OPTIONS":
      return { ...state, sortOptions: action.payload };

    case "CLEAR_FILTERS":
      return {
        ...state,
        filters: {},
        sortOptions: { sortBy: "name", direction: "asc" },
      };

    case "CLEAR_SELECTION":
      return { ...state, selectedFiles: new Set() };

    case "SELECT_FILE":
      return {
        ...state,
        selectedFiles: new Set([...state.selectedFiles, action.payload]),
      };

    case "DESELECT_FILE":
      const newSelection = new Set(state.selectedFiles);
      newSelection.delete(action.payload);
      return { ...state, selectedFiles: newSelection };

    case "TOGGLE_FILE_SELECTION":
      const toggledSelection = new Set(state.selectedFiles);
      if (toggledSelection.has(action.payload)) {
        toggledSelection.delete(action.payload);
      } else {
        toggledSelection.add(action.payload);
      }
      return { ...state, selectedFiles: toggledSelection };

    default:
      return state;
  }
}

// Context
const FileContext = createContext<{
  state: FileState;
  dispatch: React.Dispatch<FileAction>;
  actions: {
    setFiles: (files: TransformedFileData[]) => void;
    setSelectedFiles: (files: Set<string>) => void;
    setCurrentPath: (path: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setFilters: (filters: Partial<FileState["filters"]>) => void;
    setSortOptions: (options: FileState["sortOptions"]) => void;
    clearFilters: () => void;
    clearSelection: () => void;
    selectFile: (fileId: string) => void;
    deselectFile: (fileId: string) => void;
    toggleFileSelection: (fileId: string) => void;
    selectAllFiles: () => void;
  };
} | null>(null);

// Provider component
export const FileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(fileReducer, initialFileState);

  // Action creators
  const actions = {
    setFiles: (files: TransformedFileData[]) => {
      dispatch({ type: "SET_FILES", payload: files });
    },

    setSelectedFiles: (files: Set<string>) => {
      dispatch({ type: "SET_SELECTED_FILES", payload: files });
    },

    setCurrentPath: (path: string) => {
      dispatch({ type: "SET_CURRENT_PATH", payload: path });
    },

    setLoading: (loading: boolean) => {
      dispatch({ type: "SET_LOADING", payload: loading });
    },

    setError: (error: string | null) => {
      dispatch({ type: "SET_ERROR", payload: error });
    },

    setFilters: (filters: Partial<FileState["filters"]>) => {
      dispatch({ type: "SET_FILTERS", payload: filters });
    },

    setSortOptions: (options: FileState["sortOptions"]) => {
      dispatch({ type: "SET_SORT_OPTIONS", payload: options });
    },

    clearFilters: () => {
      dispatch({ type: "CLEAR_FILTERS" });
    },

    clearSelection: () => {
      dispatch({ type: "CLEAR_SELECTION" });
    },

    selectFile: (fileId: string) => {
      dispatch({ type: "SELECT_FILE", payload: fileId });
    },

    deselectFile: (fileId: string) => {
      dispatch({ type: "DESELECT_FILE", payload: fileId });
    },

    toggleFileSelection: (fileId: string) => {
      dispatch({ type: "TOGGLE_FILE_SELECTION", payload: fileId });
    },

    selectAllFiles: () => {
      const allFileIds = new Set(state.files.map((f) => f.id));
      dispatch({ type: "SET_SELECTED_FILES", payload: allFileIds });
    },
  };

  const value = {
    state,
    dispatch,
    actions,
  };

  return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
};

// Custom hook to use the File context
export const useFileContext = () => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useFileContext must be used within a FileProvider");
  }
  return context;
};

// Selector hooks for specific parts of the state
export const useFileState = () => {
  const { state } = useFileContext();
  return state;
};

export const useFileActions = () => {
  const { actions } = useFileContext();
  return actions;
};

export const useSelectedFiles = () => {
  const { state } = useFileContext();
  return state.selectedFiles;
};

export const useFileFilters = () => {
  const { state, actions } = useFileContext();
  return {
    filters: state.filters,
    sortOptions: state.sortOptions,
    setFilters: actions.setFilters,
    setSortOptions: actions.setSortOptions,
    clearFilters: actions.clearFilters,
  };
};
