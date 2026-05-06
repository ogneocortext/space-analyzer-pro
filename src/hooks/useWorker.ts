import { ref, onMounted, onUnmounted } from "vue";
import * as Comlink from "comlink";
import type {
  WorkerAPI,
  FileNode,
  AnalysisOptions,
  AnalysisResult,
  NeuralNode,
  FileInsights,
} from "../workers/analysisWorker";

interface UseWorkerReturn {
  isWorkerReady: boolean;
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  error: string | null;
  progress: number;
  startAnalysis: (options: AnalysisOptions) => void;
  cancelAnalysis: () => void;
  terminateWorker: () => void;
}

export const useWorker = (): UseWorkerReturn => {
  const workerRef = ref<Worker | null>(null);
  const workerApiRef = ref<Comlink.Remote<WorkerAPI> | null>(null);
  const isWorkerReady = ref(false);
  const isAnalyzing = ref(false);
  const result = ref<AnalysisResult | null>(null);
  const error = ref<string | null>(null);
  const progress = ref(0);

  const initializeWorker = () => {
    try {
      // Create worker from the analysis worker file
      workerRef.value = new Worker(
        new URL("../workers/analysisWorker.ts", import.meta.url),
        { type: "module" }
      );

      // Create Comlink wrapper
      workerApiRef.value = Comlink.wrap<WorkerAPI>(workerRef.value);

      // Setup worker event handlers
      workerRef.value.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case "ready":
            isWorkerReady.value = true;
            break;
          case "progress":
            progress.value = data.percentage;
            break;
          case "result":
            result.value = data;
            isAnalyzing.value = false;
            break;
          case "error":
            error.value = data.message;
            isAnalyzing.value = false;
            break;
        }
      };

      workerRef.value.onerror = (event) => {
        error.value = `Worker error: ${event.message}`;
        isWorkerReady.value = false;
      };

    } catch (err: any) {
      error.value = `Failed to initialize worker: ${err.message}`;
    }
  };

  const startAnalysis = (options: AnalysisOptions) => {
    if (!workerApiRef.value || !isWorkerReady.value) {
      error.value = "Worker not ready";
      return;
    }

    isAnalyzing.value = true;
    error.value = null;
    result.value = null;
    progress.value = 0;

    workerApiRef.value.analyzeFiles(options).catch((err: Error) => {
      error.value = err.message;
      isAnalyzing.value = false;
    });
  };

  const cancelAnalysis = () => {
    if (workerApiRef.value && isAnalyzing.value) {
      workerApiRef.value.cancelAnalysis();
      isAnalyzing.value = false;
    }
  };

  const terminateWorker = () => {
    if (workerRef.value) {
      workerRef.value.terminate();
      workerRef.value = null;
      workerApiRef.value = null;
      isWorkerReady.value = false;
      isAnalyzing.value = false;
    }
  };

  onMounted(() => {
    initializeWorker();
  });

  onUnmounted(() => {
    terminateWorker();
  });

  return {
    isWorkerReady,
    isAnalyzing,
    result,
    error,
    progress,
    startAnalysis,
    cancelAnalysis,
    terminateWorker,
  };
};
