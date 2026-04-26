// Custom hook for managing analysis state
import { useState, useCallback, startTransition } from 'react';
import { bridge, AnalysisResult } from '../services/AnalysisBridge';

interface AnalysisState {
  path: string;
  status: string;
  progress: number;
  data: AnalysisResult | null;
  error: string | null;
  isAnalysisRunning: boolean;
  isBackendOnline: boolean;
  analysisId: string | null;
  currentFile: string;
  filesScanned: number;
}

export const useAnalysisState = (initialPath: string = '') => {
  const [state, setState] = useState<AnalysisState>({
    path: initialPath,
    status: 'Idle',
    progress: 0,
    data: null,
    error: null,
    isAnalysisRunning: false,
    isBackendOnline: false,
    analysisId: null,
    currentFile: '',
    filesScanned: 0
  });

  const setPath = useCallback((path: string) => {
    setState(prev => ({ ...prev, path }));
  }, []);

  const setStatus = useCallback((status: string) => {
    setState(prev => ({ ...prev, status }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress }));
  }, []);

  const setData = useCallback((data: AnalysisResult | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setIsAnalysisRunning = useCallback((isAnalysisRunning: boolean) => {
    setState(prev => ({ ...prev, isAnalysisRunning }));
  }, []);

  const setIsBackendOnline = useCallback((isBackendOnline: boolean) => {
    setState(prev => ({ ...prev, isBackendOnline }));
  }, []);

  const setAnalysisId = useCallback((analysisId: string | null) => {
    setState(prev => ({ ...prev, analysisId }));
  }, []);

  const handleAnalysis = useCallback(async (useAI: boolean = true) => {
    if (!state.path) {
      setState(prev => ({ ...prev, error: 'Please enter a directory path' }));
      return;
    }

    try {
      // Critical state update - immediate
      setState(prev => ({
        ...prev,
        isAnalysisRunning: true,
        error: null,
        status: 'Starting Analysis...',
        progress: 0,
        analysisId: null,
        currentFile: 'Initializing...',
        filesScanned: 0
      }));

      const response = await bridge.analyzeDirectoryWithProgress(state.path, (p) => {
        console.log('📊 Progress update:', p);
        // Non-critical UI updates - use startTransition for smoother UX
        startTransition(() => {
          setState(prev => ({
            ...prev,
            progress: p.percentage,
            currentFile: p.currentFile || 'Scanning...',
            filesScanned: p.files || 0,
            status: `Scanning: ${p.currentFile || 'Processing...'} (${Math.round(p.percentage)}%)`
          }));
        });
      }, { useOllama: useAI });

      // Critical state update - immediate
      setState(prev => ({
        ...prev,
        data: response.result,
        analysisId: response.analysisId || null,
        status: 'Analysis Complete',
        progress: 100,
        currentFile: 'Complete',
        filesScanned: response.result?.totalFiles || 0
      }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({
        ...prev,
        error: err.message || 'Analysis failed',
        status: 'Error',
        currentFile: '',
        filesScanned: 0
      }));
    } finally {
      setState(prev => ({ ...prev, isAnalysisRunning: false }));
    }
  }, [state.path]);

  const resetAnalysis = useCallback(() => {
    setState({
      path: state.path,
      status: 'Idle',
      progress: 0,
      data: null,
      error: null,
      isAnalysisRunning: false,
      isBackendOnline: state.isBackendOnline,
      analysisId: null,
      currentFile: '',
      filesScanned: 0
    });
  }, [state.path, state.isBackendOnline]);

  return {
    ...state,
    setPath,
    setStatus,
    setProgress,
    setData,
    setError,
    setIsAnalysisRunning,
    setIsBackendOnline,
    setAnalysisId,
    handleAnalysis,
    resetAnalysis,
  };
};
