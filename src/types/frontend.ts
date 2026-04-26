/* Frontend Type Definitions for Space Analyzer */

// Core Data Types
export interface FileData {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory' | 'pattern';
  category: string;
  modified?: string;
  created?: string;
  accessed?: string;
  checksum?: string;
  isHidden?: boolean;
  extension?: string;
  isCorrupted?: boolean;
  fileType?: 'video' | 'document' | 'system' | 'other';
  accessFrequency?: number;
  complexity?: number;
  language?: string;
}

export interface ConnectionData {
  from: string;
  to: string;
  strength: number;
  type: 'similarity' | 'dependency' | 'access' | 'contains';
  accessFrequency?: number;
}

export interface AnalysisMetrics {
  neuralDensity: number;
  connectionStrength: number;
  patternRecognition: number;
  anomalyScore: number;
  circularDependencies: number;
  missingDependencies: number;
}

export interface AnalysisResult {
  totalFiles: number;
  totalSize: number;
  fileTypes: string[];
  categories: Record<string, number>;
  files: FileData[];
  directories: string[];
  insights: InsightData[];
  dependencyGraph: {
    nodes: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      category: string;
      language?: string;
      complexity?: number;
    }>;
    edges: ConnectionData[];
  };
  analysisTime: string;
}

export interface InsightData {
  id: string;
  title: string;
  description: string;
  type: 'optimization' | 'anomaly' | 'pattern' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  action?: string;
}

// Neural View Types
export interface NeuralNode {
  id: string;
  x: number;
  y: number;
  size: number;
  type: 'file' | 'directory' | 'pattern';
  connections: string[];
  fileType?: 'video' | 'document' | 'system' | 'other';
  fileSize?: number;
  accessFrequency?: number;
  language?: string;
  complexity?: number;
  category?: string;
}

export interface NeuralConnection {
  from: string;
  to: string;
  strength: number;
  type: 'similarity' | 'dependency' | 'access';
  accessFrequency?: number;
}

export interface NeuralData {
  nodes: NeuralNode[];
  connections: NeuralConnection[];
  metrics: AnalysisMetrics;
}

export interface NeuralSimulationState {
  neurons: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
    pulse: number;
    size: number;
    id: string;
    connections: string[];
    type: string;
    pinned?: boolean;
  }>;
  isPlaying: boolean;
  neuralType: 'network' | 'heatmap' | 'graph';
  connectionLines: boolean;
  showLabels: boolean;
  hoveredNode: string | null;
  selectedNode: string | null;
  draggedNode: string | null;
  dragOffset: { x: number; y: number };
  mousePos: { x: number; y: number };
}

// UI Component Types
export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  beta?: boolean;
  keyboardShortcut?: string;
}

export interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastCheck: Date;
}

export interface DashboardStats {
  totalFiles: number;
  totalSize: number;
  analysisTime: string;
  aiInsights: number;
}

export interface ViewType {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  beta?: boolean;
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  disabled?: boolean;
  beta?: boolean;
}

// Form and Input Types
export interface SearchParams {
  query: string;
  sortBy: 'name' | 'size' | 'date' | 'type';
  sortOrder: 'asc' | 'desc';
  filterType: string;
  pageSize: number;
  currentPage: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Error Handling Types
export interface AppError {
  id: string;
  message: string;
  type: 'network' | 'validation' | 'processing' | 'ui' | 'unknown';
  timestamp: Date;
  component?: string;
  details?: Record<string, any>;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Performance Types
export interface PerformanceMetrics {
  fps: number;
  nodes: number;
  connections: number;
  processingTime: number;
  memoryUsage: number;
  renderTime: number;
}

// Accessibility Types
export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  role?: string;
}

export interface KeyboardNavigation {
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
}

// Theme and Styling Types
export interface Theme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  shadow: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface FontSize {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface Spacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

// Animation Types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  iterations?: number;
  fill?: 'forwards' | 'backwards' | 'both' | 'none';
}

export interface TransitionConfig {
  enter: AnimationConfig;
  exit: AnimationConfig;
  duration: number;
  easing: string;
}

// Export Types
export interface ExportOptions {
  format: 'png' | 'svg' | 'json' | 'pdf' | 'csv';
  includeMetadata: boolean;
  includeConnections: boolean;
  includeMetrics: boolean;
  resolution?: number;
  quality?: number;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  format: string;
  size: number;
  error?: string;
}

// Configuration Types
export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
  };
  performance: {
    virtualization: boolean;
    canvasOptimization: boolean;
    memoryLimit: number;
  };
}

// WebSocket and Real-time Types
export interface WebSocketMessage {
  type: 'progress' | 'error' | 'complete' | 'update';
  data: any;
  timestamp: Date;
}

export interface ProgressUpdate {
  percentage: number;
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  estimatedTime: string;
}

// Testing Types
export interface TestConfig {
  timeout: number;
  retries: number;
  viewport: {
    width: number;
    height: number;
  };
  theme: 'light' | 'dark';
}

export interface TestResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  performance: PerformanceMetrics;
  accessibility: {
    violations: any[];
    score: number;
  };
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & globalThis.Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never;

// Event Types
export interface CustomEventMap {
  'analysis:start': { path: string };
  'analysis:progress': ProgressUpdate;
  'analysis:complete': { result: AnalysisResult };
  'analysis:error': { error: string };
  'neural:node:select': { nodeId: string };
  'neural:node:hover': { nodeId: string | null };
  'export:start': { format: string };
  'export:complete': ExportResult;
}

declare global {
  interface Window {
    __APP_CONFIG__: AppConfig;
    __TEST_MODE__: boolean;
    __DEV_MODE__: boolean;
  }
}

export {};
