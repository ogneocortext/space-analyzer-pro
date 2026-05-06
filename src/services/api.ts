/**
 * API Configuration and Communication Service
 * Handles all frontend-backend communication with proper error handling
 */

// Dynamic API base URL detection
const getApiBaseUrl = (): string => {
  // Check if we're in development or production
  const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV !== "production";

  if (isDevelopment) {
    // Try to detect the actual backend port
    const currentHost = window.location.hostname;
    const currentPort = window.location.port;

    // If frontend is served from a different port, use default backend port
    if (currentPort === "3000" || currentPort === "5173") {
      return `http://${currentHost}:8080`; // Backend port from config
    }

    // If frontend and backend are on same port, use relative URLs
    return `http://${currentHost}:${currentPort}`;
  }

  // Production - use same origin
  return window.location.origin;
};

// API configuration
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  ENDPOINTS: {
    // Analysis endpoints
    ANALYSIS_START: "/analysis/start",
    ANALYSIS_STATUS: "/analysis/status",
    ANALYSIS_CURRENT: "/analysis/current",
    ANALYSIS_HISTORY: "/analysis/history",
    ANALYSIS_CANCEL: "/analysis/cancel",

    // Reports endpoints
    REPORTS: "/reports",
    REPORTS_ANALYSIS: "/reports/analysis",
    REPORTS_COMPLEXITY: "/reports/complexity",
    REPORTS_PREVIEW: "/reports/preview",
    REPORTS_TEMPLATES: "/reports/templates",
    REPORTS_BATCH: "/reports/batch",

    // File system endpoints
    FILES_LIST: "/files/list",
    FILES_DELETE: "/files/delete",
    FILES_REVEAL: "/files/reveal",

    // System endpoints
    SYSTEM_HEALTH: "/system/health",
    SYSTEM_INFO: "/system/info",
    SYSTEM_METRICS: "/system/metrics",

    // AI endpoints
    AI_STATUS: "/ai/status",
    AI_CHAT: "/ai/chat",
    AI_ANALYZE: "/ai/analyze",

    // Error endpoints
    ERRORS_RECENT: "/errors/recent",
    ERRORS_EXPORT: "/errors/export",
    ERRORS_CLEAR: "/errors/clear",
    ERRORS_STATS: "/errors/stats",

    // Settings endpoints
    SETTINGS: "/settings",
  },
};

// Enhanced fetch wrapper with error handling
export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`🌐 API Request: ${options.method || "GET"} ${url}`);

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
        credentials: "include",
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} ${response.statusText}`, errorText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      console.log(`✅ API Response:`, data);
      return data;
    } catch (error) {
      console.error(`❌ Network Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // GET requests
  async get<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return this.request<T>(url);
  }

  // POST requests
  async post<T>(
    endpoint: string,
    data?: any
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT requests
  async put<T>(
    endpoint: string,
    data?: any
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE requests
  async delete<T>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Export convenience methods for common operations
export const api = {
  // Analysis
  startAnalysis: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.ANALYSIS_START, data),
  getAnalysisStatus: (id: string) => apiClient.get(API_CONFIG.ENDPOINTS.ANALYSIS_STATUS, { id }),
  getCurrentAnalysis: () => apiClient.get(API_CONFIG.ENDPOINTS.ANALYSIS_CURRENT),
  getAnalysisHistory: () => apiClient.get(API_CONFIG.ENDPOINTS.ANALYSIS_HISTORY),
  cancelAnalysis: (id: string) => apiClient.delete(`${API_CONFIG.ENDPOINTS.ANALYSIS_CANCEL}/${id}`),

  // Reports
  getReports: () => apiClient.get(API_CONFIG.ENDPOINTS.REPORTS),
  generateAnalysisReport: (data: any) =>
    apiClient.post(API_CONFIG.ENDPOINTS.REPORTS_ANALYSIS, data),
  generateComplexityReport: (data: any) =>
    apiClient.post(API_CONFIG.ENDPOINTS.REPORTS_COMPLEXITY, data),
  getReportPreview: (filename: string) =>
    apiClient.get(`${API_CONFIG.ENDPOINTS.REPORTS_PREVIEW}/${filename}`),
  getTemplates: () => apiClient.get(API_CONFIG.ENDPOINTS.REPORTS_TEMPLATES),
  createTemplate: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.REPORTS_TEMPLATES, data),
  updateTemplate: (id: string, data: any) =>
    apiClient.put(`${API_CONFIG.ENDPOINTS.REPORTS_TEMPLATES}/${id}`, data),
  deleteTemplate: (id: string) =>
    apiClient.delete(`${API_CONFIG.ENDPOINTS.REPORTS_TEMPLATES}/${id}`),
  getBatchJobs: () => apiClient.get(API_CONFIG.ENDPOINTS.REPORTS_BATCH),
  createBatchJob: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.REPORTS_BATCH, data),
  cancelBatchJob: (id: number) => apiClient.delete(`${API_CONFIG.ENDPOINTS.REPORTS_BATCH}/${id}`),

  // Files
  listFiles: (path: string) => apiClient.get(API_CONFIG.ENDPOINTS.FILES_LIST, { path }),
  deleteFile: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.FILES_DELETE, data),
  revealFile: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.FILES_REVEAL, data),

  // System
  getHealth: () => apiClient.get(API_CONFIG.ENDPOINTS.SYSTEM_HEALTH),
  getSystemInfo: () => apiClient.get(API_CONFIG.ENDPOINTS.SYSTEM_INFO),
  getSystemMetrics: () => apiClient.get(API_CONFIG.ENDPOINTS.SYSTEM_METRICS),

  // AI
  getAIStatus: () => apiClient.get(API_CONFIG.ENDPOINTS.AI_STATUS),
  sendChatMessage: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.AI_CHAT, data),
  analyzeWithAI: (data: any) => apiClient.post(API_CONFIG.ENDPOINTS.AI_ANALYZE, data),

  // Errors
  getRecentErrors: (limit: number = 100) =>
    apiClient.get(API_CONFIG.ENDPOINTS.ERRORS_RECENT, { limit: limit.toString() }),
  exportErrors: (limit: number = 1000) =>
    apiClient.get(API_CONFIG.ENDPOINTS.ERRORS_EXPORT, { limit: limit.toString() }),
  clearErrors: () => apiClient.delete(API_CONFIG.ENDPOINTS.ERRORS_CLEAR),
  getErrorStats: (days: number = 7) =>
    apiClient.get(API_CONFIG.ENDPOINTS.ERRORS_STATS, { days: days.toString() }),
};

// Export for easy usage
export default api;
