import { useState, useCallback, useRef, useEffect } from 'react';
import * as Comlink from 'comlink';
import type { WorkerAPI, FileNode, AnalysisOptions, AnalysisResult, NeuralNode, FileInsights } from '../workers/analysisWorker';

interface UseWorkerState {
  isProcessing: boolean;
  error: string | null;
  progress: number;
}

interface UseWorkerReturn extends UseWorkerState {
  analyzeFileTree: (files: FileNode[], options?: AnalysisOptions) => Promise<AnalysisResult | null>;
  calculateNeuralPhysics: (nodes: NeuralNode[], deltaTime: number) => Promise<NeuralNode[] | null>;
  processLargeDataset: (data: any[], operation: string) => Promise<any>;
  generateFileInsights: (files: FileNode[]) => Promise<FileInsights | null>;
  calculateDuplicates: (files: FileNode[]) => Promise<any[] | null>;
  compressAnalysis: (data: any) => Promise<any>;
  clearError: () => void;
}

export const useWorker = (): UseWorkerReturn => {
  const [state, setState] = useState<UseWorkerState>({
    isProcessing: false,
    error: null,
    progress: 0
  });

  const workerRef = useRef<Comlink.Remote<WorkerAPI> | null>(null);
  const workerInstanceRef = useRef<Worker | null>(null);

  // Initialize worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        // Create worker instance
        const worker = new Worker(
          new URL('../workers/analysisWorker.ts', import.meta.url),
          { type: 'module' }
        );

        workerInstanceRef.current = worker;
        
        // Wrap with Comlink
        const workerAPI = Comlink.wrap<WorkerAPI>(worker);
        workerRef.current = workerAPI;

        // Handle worker errors
        worker.addEventListener('error', (event) => {
          console.error('Worker error:', event);
          setState(prev => ({
            ...prev,
            error: 'Worker encountered an error',
            isProcessing: false
          }));
        });

        worker.addEventListener('messageerror', (event) => {
          console.error('Worker message error:', event);
          setState(prev => ({
            ...prev,
            error: 'Worker message error',
            isProcessing: false
          }));
        });

      } catch (error) {
        console.error('Failed to initialize worker:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize worker',
          isProcessing: false
        }));
      }
    };

    initWorker();

    // Cleanup
    return () => {
      if (workerInstanceRef.current) {
        workerInstanceRef.current.terminate();
      }
      if (workerRef.current) {
        // Comlink cleanup is handled automatically when worker is terminated
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const executeWithProgress = useCallback(async <T,>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> => {
    if (!workerRef.current) {
      setState(prev => ({
        ...prev,
        error: 'Worker not initialized',
        isProcessing: false
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      progress: 0
    }));

    try {
      const result = await operation();
      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100
      }));
      return result;
    } catch (error) {
      console.error(`Error in ${operationName}:`, error);
      setState(prev => ({
        ...prev,
        error: `Failed to ${operationName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isProcessing: false,
        progress: 0
      }));
      return null;
    }
  }, []);

  const analyzeFileTree = useCallback(async (
    files: FileNode[],
    options?: AnalysisOptions
  ): Promise<AnalysisResult | null> => {
    return executeWithProgress(
      () => workerRef.current!.analyzeFileTree(files, options),
      'analyze file tree'
    );
  }, [executeWithProgress]);

  const calculateNeuralPhysics = useCallback(async (
    nodes: NeuralNode[],
    deltaTime: number
  ): Promise<NeuralNode[] | null> => {
    return executeWithProgress(
      () => workerRef.current!.calculateNeuralPhysics(nodes, deltaTime),
      'calculate neural physics'
    );
  }, [executeWithProgress]);

  const processLargeDataset = useCallback(async (
    data: any[],
    operation: string
  ): Promise<any> => {
    return executeWithProgress(
      () => workerRef.current!.processLargeDataset(data, operation),
      'process large dataset'
    );
  }, [executeWithProgress]);

  const generateFileInsights = useCallback(async (
    files: FileNode[]
  ): Promise<FileInsights | null> => {
    return executeWithProgress(
      () => workerRef.current!.generateFileInsights(files),
      'generate file insights'
    );
  }, [executeWithProgress]);

  const calculateDuplicates = useCallback(async (
    files: FileNode[]
  ): Promise<any[] | null> => {
    return executeWithProgress(
      () => workerRef.current!.calculateDuplicates(files),
      'calculate duplicates'
    );
  }, [executeWithProgress]);

  const compressAnalysis = useCallback(async (
    data: any
  ): Promise<any> => {
    return executeWithProgress(
      () => workerRef.current!.compressAnalysis(data),
      'compress analysis'
    );
  }, [executeWithProgress]);

  return {
    ...state,
    analyzeFileTree,
    calculateNeuralPhysics,
    processLargeDataset,
    generateFileInsights,
    calculateDuplicates,
    compressAnalysis,
    clearError
  };
};

// Hook for neural physics optimization
export const useNeuralPhysics = () => {
  const worker = useWorker();
  const [nodes, setNodes] = useState<NeuralNode[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);

  const startPhysics = useCallback((initialNodes: NeuralNode[]) => {
    setNodes(initialNodes);
    setIsRunning(true);
    lastTimeRef.current = performance.now();
  }, []);

  const stopPhysics = useCallback(() => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const updatePhysics = useCallback(async () => {
    if (!isRunning || !worker.isProcessing) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1); // Cap at 100ms
    lastTimeRef.current = currentTime;

    const updatedNodes = await worker.calculateNeuralPhysics(nodes, deltaTime);
    if (updatedNodes) {
      setNodes(updatedNodes);
    }

    if (isRunning) {
      animationRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [isRunning, worker, nodes]);

  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(updatePhysics);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, updatePhysics]);

  return {
    nodes,
    isRunning,
    startPhysics,
    stopPhysics,
    isProcessing: worker.isProcessing,
    error: worker.error
  };
};

export default useWorker;
