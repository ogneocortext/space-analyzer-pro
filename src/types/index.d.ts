// Additional type definitions for Space Analyzer
export interface PredictiveInsight {
  type: "growth" | "cleanup" | "organization" | "security";
  prediction: string;
  confidence: number;
  timeframe: string;
  actionItems: string[];
  reasoning: {
    primaryFactor: string;
    contributingFactors: string[];
    historicalEvidence: string[];
    dataPoints: {
      label: string;
      value: string;
      impact: "high" | "medium" | "low";
    }[];
    trendAnalysis: {
      direction: "increasing" | "decreasing" | "stable";
      rate: string;
      duration: string;
    };
  };
}

export interface AnalysisHistory {
  timestamp: number;
  fileCount: number;
  totalSize: number;
  categories: { [key: string]: { count: number; size: number } };
  fileChanges: FileChange[];
  patterns: FilePattern[];
}

export interface FileChange {
  path: string;
  type: "added" | "deleted" | "modified";
  timestamp: number;
  size?: number;
  category?: string;
}

export interface FilePattern {
  type: "growth" | "seasonal" | "weekly" | "daily";
  description: string;
  confidence: number;
  data: any;
}

// ML Library Types
export interface TensorFlow {
  sequential: any;
  layers: any;
  data: any;
  train: any;
  predict: any;
}

export interface BrainJS {
  NeuralNetwork: any;
  recurrent: any;
  LSTM: any;
  GRU: any;
  train: any;
  run: any;
}

// Global extensions
declare global {
  var tf: TensorFlow;
  var brain: BrainJS;
}

export {};
