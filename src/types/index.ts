// Basic type definitions for Space Analyzer

export interface AnalysisData {
  files: FileData[];
  categories: CategoryData;
  totalSize: number;
  totalFiles: number;
  scanTime?: number;
  directoryPath?: string;
}

export interface FileData {
  path: string;
  name: string;
  size: number;
  extension?: string;
  category?: string;
  modified?: string;
  created?: string;
  accessed?: string;
  type?: "file" | "directory";
}

export interface CategoryData {
  [categoryName: string]: {
    count: number;
    size: number;
    files?: FileData[];
  };
}

export interface NeuralViewProps {
  data: {
    nodes: Array<{
      id: string;
      x: number;
      y: number;
      size: number;
      type: string;
      connections: string[];
    }>;
    connections: Array<{
      from: string;
      to: string;
      strength: number;
      type: string;
    }>;
  };
  isLoading?: boolean;
  error?: string | null;
}
