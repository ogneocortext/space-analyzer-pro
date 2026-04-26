import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: object) => void;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export const useWebSocket = (url?: string): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const wsUrl = url || `ws://${window.location.hostname}:8080`;
    console.log('🔌 Attempting WebSocket connection to:', wsUrl);
    
    try {
      setConnectionState('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected successfully!');
        setIsConnected(true);
        setConnectionState('connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message);
          setLastMessage(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        setConnectionState('disconnected');
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionState('error');
    }
  }, [url]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent.');
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connectionState
  };
};

// Hook for real-time analysis progress
export const useAnalysisProgress = (analysisId: string | null) => {
  const [progress, setProgress] = useState({
    files: 0,
    percentage: 0,
    currentFile: '',
    completed: false
  });
  const [scannedFiles, setScannedFiles] = useState<Array<{name: string; path: string; size: number; category: string}>>([]);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    // Also check for analysisId from window object (set by AnalysisBridge)
    const currentAnalysisId = analysisId || (typeof window !== 'undefined' ? (window as any).__currentAnalysisId : null);
    
    console.log('🔍 useAnalysisProgress - analysisId:', analysisId);
    console.log('🔍 useAnalysisProgress - currentAnalysisId (with fallback):', currentAnalysisId);
    console.log('🔍 useAnalysisProgress - lastMessage:', lastMessage);
    
    if (lastMessage && (lastMessage.type === 'progress' || lastMessage.type === 'progress_update') && lastMessage.analysisId === currentAnalysisId) {
      console.log('✅ Progress message matched, updating progress');
      // Handle both 'progress' and 'progress_update' message types
      const progressData = lastMessage.progress || lastMessage; // Handle nested progress data
      console.log('📊 Progress data:', progressData);
      setProgress({
        files: progressData.files || 0,
        percentage: progressData.percentage || 0,
        currentFile: progressData.currentFile || '',
        completed: progressData.completed || progressData.status === 'complete' || false
      });
      
      // If progress message includes file details, add to scanned files
      if (progressData.file) {
        setScannedFiles(prev => [...prev.slice(-49), progressData.file]);
      }
    }
    
    if (lastMessage && lastMessage.type === 'file_scanned' && lastMessage.analysisId === currentAnalysisId) {
      console.log('📁 File scanned:', lastMessage.file);
      setScannedFiles(prev => [...prev.slice(-49), lastMessage.file]); // Keep last 50 files
      setProgress(prev => ({
        ...prev,
        files: lastMessage.fileCount || prev.files,
        currentFile: lastMessage.file?.name || prev.currentFile
      }));
    }
    
    if (lastMessage && lastMessage.type === 'analysis_complete' && lastMessage.analysisId === currentAnalysisId) {
      console.log('✅ Analysis complete message received');
      setProgress(prev => ({
        ...prev,
        percentage: 100,
        completed: true
      }));
    }
  }, [lastMessage, analysisId]);

  return { progress, scannedFiles };
};

// Hook for real-time file updates
export const useFileUpdates = () => {
  const [updates, setUpdates] = useState<Array<{type: string; path: string; timestamp: string}>>([]);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'file_deleted' || lastMessage.type === 'file_renamed') {
        setUpdates(prev => [...prev.slice(-9), {
          type: lastMessage.type,
          path: lastMessage.path || lastMessage.newPath,
          timestamp: lastMessage.timestamp
        }]);
      }
    }
  }, [lastMessage]);

  return updates;
};