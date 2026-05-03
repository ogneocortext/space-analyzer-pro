/**
 * SSE Manager Module
 * Handles Server-Sent Events for real-time progress updates
 */

import type { AnalysisProgress } from '../types';

export interface SSEConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
  connectionTimeout: number;
}

export class SSEManager {
  private config: SSEConfig;
  private baseUrl: string;

  constructor(baseUrl: string, config: Partial<SSEConfig> = {}) {
    this.baseUrl = baseUrl;
    this.config = {
      maxReconnectAttempts: 3,
      reconnectDelay: 2000,
      connectionTimeout: 10000,
      ...config,
    };
  }

  /**
   * Enhanced SSE Progress Subscription with better error handling
   */
  subscribeToProgress(
    analysisId: string,
    onProgress: (progress: AnalysisProgress) => void,
    onError?: (error: string) => void
  ): () => void {
    console.log(`[SSE] Subscribing to progress for analysis: ${analysisId}`);

    const url = `${this.baseUrl}/api/progress/stream/${analysisId}`;
    console.log(`[SSE] Connecting to: ${url}`);
    
    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    let isActive = true;
    
    const createEventSource = (): void => {
      if (!isActive) return;

      try {
        eventSource = new EventSource(url);
        
        // Set connection timeout
        const timeoutId = setTimeout(() => {
          if (eventSource?.readyState === EventSource.CONNECTING) {
            console.warn(`[SSE] Connection timeout for ${analysisId}`);
            eventSource?.close();
            handleConnectionError();
          }
        }, this.config.connectionTimeout);
        
        eventSource.onopen = () => {
          clearTimeout(timeoutId);
          console.log(`[SSE] Connection opened for ${analysisId}`);
          reconnectAttempts = 0; // Reset on successful connection
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`[SSE] Progress update:`, data);

            // Validate progress data
            if (!data || typeof data !== 'object') {
              console.warn(`[SSE] Invalid progress data received`);
              return;
            }

            // Call progress callback with validated data
            const normalizedProgress = this.normalizeProgressData(data, analysisId);
            onProgress(normalizedProgress);

            // Close connection if analysis is complete or failed
            if (this.isAnalysisComplete(data)) {
              console.log(`[SSE] Analysis ${analysisId} finished, closing SSE`);
              this.closeConnection();
            }
          } catch (error) {
            console.error("[SSE] Error parsing SSE data:", error);
            if (onError) onError(`Failed to parse progress data: ${error}`);
          }
        };

        eventSource.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error("[SSE] SSE error:", error);

          // Attempt reconnection if not exceeded max attempts
          if (reconnectAttempts < this.config.maxReconnectAttempts && 
              eventSource?.readyState === EventSource.CLOSED && 
              isActive) {
            reconnectAttempts++;
            console.log(`[SSE] Attempting reconnection ${reconnectAttempts}/${this.config.maxReconnectAttempts}`);
            setTimeout(createEventSource, this.config.reconnectDelay * reconnectAttempts);
            return;
          }

          handleConnectionError();
        };

      } catch (error) {
        console.error("[SSE] Failed to create EventSource:", error);
        if (onError) onError(`Failed to create SSE connection: ${error}`);
      }
    };
    
    const handleConnectionError = (): void => {
      if (onError) {
        onError(`SSE connection error for ${analysisId} after ${reconnectAttempts} attempts`);
      }
      this.closeConnection();
    };

    const closeConnection = (): void => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    // Start the connection
    createEventSource();

    // Return cleanup function
    return () => {
      console.log(`[SSE] Unsubscribing from progress: ${analysisId}`);
      isActive = false;
      closeConnection();
    };
  }

  /**
   * Normalize SSE progress data to ensure consistent format
   */
  private normalizeProgressData(data: any, analysisId: string): AnalysisProgress {
    return {
      analysisId: data.analysisId || analysisId,
      files: Math.max(0, data.files || 0),
      percentage: Math.min(100, Math.max(0, data.percentage || 0)),
      currentFile: data.currentFile || "",
      completed: data.completed || data.status === "complete",
      totalSize: data.totalSize || 0,
    };
  }

  /**
   * Check if analysis is complete based on SSE data
   */
  private isAnalysisComplete(data: any): boolean {
    return data.completed || 
           data.status === "complete" || 
           data.status === "completed" || 
           data.status === "failed";
  }

  /**
   * Test SSE connection (for debugging)
   */
  async testConnection(analysisId: string): Promise<{ connected: boolean; error?: string }> {
    return new Promise((resolve) => {
      const url = `${this.baseUrl}/api/progress/stream/${analysisId}`;
      let eventSource: EventSource | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      eventSource = new EventSource(url);

      // Set timeout for connection test
      timeoutId = setTimeout(() => {
        eventSource?.close();
        resolve({ connected: false, error: 'Connection timeout' });
      }, 5000);

      eventSource.onopen = () => {
        clearTimeout(timeoutId);
        eventSource?.close();
        resolve({ connected: true });
      };

      eventSource.onerror = () => {
        clearTimeout(timeoutId);
        eventSource?.close();
        resolve({ connected: false, error: 'Connection failed' });
      };
    });
  }

  /**
   * Get SSE connection status
   */
  getConnectionStatus(analysisId: string): 'connecting' | 'open' | 'closed' | 'error' {
    // This would need to be implemented with state tracking
    // For now, return a placeholder
    return 'closed';
  }

  /**
   * Close all active SSE connections (for cleanup)
   */
  closeAllConnections(): void {
    // This would need to be implemented with connection tracking
    console.log('[SSE] Closing all connections');
  }
}
