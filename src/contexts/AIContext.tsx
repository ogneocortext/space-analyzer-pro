/**
 * Enhanced AI Context
 * Provides unified state management for AI features and context
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { portDetector } from "../services/PortDetector";

// AI Capability Types
export interface AICapabilities {
  vision: boolean;
  codeAnalysis: boolean;
  selfLearning: boolean;
  ollamaAvailable: boolean;
  enhancedWorkflow: boolean;
  streaming: boolean;
  toolCalling: boolean;
}

// Analysis Data Types
export interface AnalysisData {
  totalFiles: number;
  totalSize: number;
  categories: { [key: string]: { count: number; size: number } };
  largestFile: string;
  analysisTime: string;
  ai_insights?: any;
  files: any[];
}

// Chat History Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  confidence?: number;
  recommendations?: string[];
  workflowStage?: string;
  isStreaming?: boolean;
  completed?: boolean;
}

// Context State
export interface AIContextState {
  analysisData: AnalysisData | null;
  chatHistory: ChatMessage[];
  aiCapabilities: AICapabilities;
  aiStatus: {
    model?: string;
    stage?: string;
    streaming?: boolean;
    confidence?: number;
    error?: string;
  } | null;
  isLoading: boolean;
}

// Context Actions
export type AIContextAction =
  | { type: "SET_ANALYSIS_DATA"; payload: AnalysisData }
  | { type: "ADD_CHAT_MESSAGE"; payload: ChatMessage }
  | { type: "UPDATE_CHAT_HISTORY"; payload: ChatMessage[] }
  | { type: "SET_AI_CAPABILITIES"; payload: AICapabilities }
  | { type: "UPDATE_AI_STATUS"; payload: any }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_CONTEXT" };

// Reducer
const aiContextReducer = (state: AIContextState, action: AIContextAction): AIContextState => {
  switch (action.type) {
    case "SET_ANALYSIS_DATA":
      return {
        ...state,
        analysisData: action.payload,
      };

    case "ADD_CHAT_MESSAGE":
      return {
        ...state,
        chatHistory: [...state.chatHistory, action.payload],
      };

    case "UPDATE_CHAT_HISTORY":
      return {
        ...state,
        chatHistory: action.payload,
      };

    case "SET_AI_CAPABILITIES":
      return {
        ...state,
        aiCapabilities: action.payload,
      };

    case "UPDATE_AI_STATUS":
      return {
        ...state,
        aiStatus: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "CLEAR_CONTEXT":
      return {
        analysisData: null,
        chatHistory: [],
        aiCapabilities: {
          vision: false,
          codeAnalysis: false,
          selfLearning: false,
          ollamaAvailable: false,
          enhancedWorkflow: false,
          streaming: false,
          toolCalling: false,
        },
        aiStatus: null,
        isLoading: false,
      };

    default:
      return state;
  }
};

// Initial State
const initialState: AIContextState = {
  analysisData: null,
  chatHistory: [],
  aiCapabilities: {
    vision: false,
    codeAnalysis: false,
    selfLearning: false,
    ollamaAvailable: false,
    enhancedWorkflow: false,
    streaming: false,
    toolCalling: false,
  },
  aiStatus: null,
  isLoading: false,
};

// Create Context
const AIContextInternal = createContext<{
  state: AIContextState;
  dispatch: React.Dispatch<AIContextAction>;
} | null>(null);

// Export the context with a stable name
export { AIContextInternal as AIContext };

// Context Provider Component
const AIContextProviderInternal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(aiContextReducer, initialState);

  // Initialize AI capabilities on mount
  useEffect(() => {
    const initializeAICapabilities = async () => {
      try {
        // Get dynamic backend URL
        const config = await portDetector.detectAllServers();
        const healthUrl = `${portDetector.getApiBaseUrl()}/health`;

        // Check backend health and capabilities
        const response = await fetch(healthUrl);
        const health = await response.json();

        const capabilities: AICapabilities = {
          vision: health.vision || false,
          codeAnalysis: health.codeAnalysis || false,
          selfLearning: health.selfLearning || false,
          ollamaAvailable: health.ollama || false,
          enhancedWorkflow: health.enhancedWorkflow || false,
          streaming: health.streaming || false,
          toolCalling: health.toolCalling || false,
        };

        dispatch({ type: "SET_AI_CAPABILITIES", payload: capabilities });
        dispatch({ type: "UPDATE_AI_STATUS", payload: { initialized: true } });

        console.warn("🧠 AI Capabilities initialized:", capabilities);
      } catch (error) {
        console.error("❌ Failed to initialize AI capabilities:", error);
        dispatch({ type: "UPDATE_AI_STATUS", payload: { error: error.message } });
      }
    };

    initializeAICapabilities();
  }, []);

  const value = { state, dispatch };

  return <AIContextInternal.Provider value={value}>{children}</AIContextInternal.Provider>;
};

// Export the provider with a stable name
export { AIContextProviderInternal as AIContextProvider };

// Hook to use AI Context
export const useAIContext = () => {
  const context = useContext(AIContextInternal);

  if (!context) {
    throw new Error("useAIContext must be used within an AIContextProvider");
  }

  return context;
};

// Convenience Hooks
export const useAnalysisData = () => {
  const { state } = useAIContext();
  return state.analysisData;
};

export const useChatHistory = () => {
  const { state } = useAIContext();
  return state.chatHistory;
};

export const useAICapabilities = () => {
  const { state } = useAIContext();
  return state.aiCapabilities;
};

export const useAIStatus = () => {
  const { state } = useAIContext();
  return state.aiStatus;
};

export const useAIActions = () => {
  const { dispatch } = useAIContext();

  return {
    updateAnalysisData: (data: AnalysisData) =>
      dispatch({ type: "SET_ANALYSIS_DATA", payload: data }),

    addChatMessage: (message: ChatMessage) =>
      dispatch({ type: "ADD_CHAT_MESSAGE", payload: message }),

    updateChatHistory: (history: ChatMessage[]) =>
      dispatch({ type: "UPDATE_CHAT_HISTORY", payload: history }),

    updateAIStatus: (status: any) => dispatch({ type: "UPDATE_AI_STATUS", payload: status }),

    setLoading: (loading: boolean) => dispatch({ type: "SET_LOADING", payload: loading }),

    clearContext: () => dispatch({ type: "CLEAR_CONTEXT" }),
  };
};
