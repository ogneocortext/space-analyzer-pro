/**
 * Progress Manager Module
 * Handles progress polling and tracking
 */

import type { AnalysisProgress } from '../types';

export interface ProgressConfig {
  maxPollAttempts: number;
  pollInterval: number;
  timeout: number;
}

export class ProgressManager {
  private config: ProgressConfig;
  private baseUrl: string;

  constructor(baseUrl: string, config: Partial<ProgressConfig> = {}) {
    this.baseUrl = baseUrl;
    this.config = {
      maxPollAttempts: 180,
      pollInterval: 2000,
      timeout: 10000,
      ...config,
    };
  }

  /**
   * Enhanced progress polling with better error handling
   */
  async pollProgress(
    analysisId: string,
    onProgress: (progress: AnalysisProgress) => void
  ): Promise<void> {
    let pollAttempts = 0;
    
    const pollProgress = async (): Promise<void> => {
      try {
        pollAttempts++;
        console.warn(`🔄 Progress poll attempt ${pollAttempts}/${this.config.maxPollAttempts}`);

        let progressResponse;
        try {
          progressResponse = await fetch(
            `${this.baseUrl}/api/progress/${analysisId}`,
            {
              signal: AbortSignal.timeout(this.config.timeout),
            }
          );
        } catch (fetchError) {
          console.error("❌ Progress fetch error:", fetchError);
          if (pollAttempts < this.config.maxPollAttempts) {
            setTimeout(pollProgress, this.config.pollInterval);
            return;
          } else {
            throw new Error(`Progress polling failed after ${this.config.maxPollAttempts} attempts`);
          }
        }

        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          console.warn("📊 Progress poll response:", progressData);
          
          // Validate progress data structure
          if (!progressData || typeof progressData !== 'object') {
            console.warn("⚠️ Invalid progress data received");
            if (pollAttempts < this.config.maxPollAttempts) {
              setTimeout(pollProgress, this.config.pollInterval);
              return;
            }
          }
          
          onProgress(this.normalizeProgressData(progressData));
          
          // Check if analysis is complete
          const isComplete = this.isAnalysisComplete(progressData);

          if (isComplete) {
            console.warn("✅ Analysis complete, stopping progress polling");
            return;
          } else if (pollAttempts < this.config.maxPollAttempts) {
            console.warn("🔄 Scheduling next poll in 2 seconds...");
            setTimeout(pollProgress, this.config.pollInterval);
          } else {
            console.warn("⏱️ Max polling attempts reached, stopping");
          }
        } else if (progressResponse.status === 404) {
          console.warn("⚠️ Analysis not found (404) - stopping progress polling for stale analysis ID");
          return;
        } else {
          console.warn("⚠️ Progress poll failed:", progressResponse.status);
          if (pollAttempts < this.config.maxPollAttempts) {
            setTimeout(pollProgress, this.config.pollInterval);
          }
        }
      } catch (error) {
        console.error("❌ Progress polling error:", error);
        if (pollAttempts < this.config.maxPollAttempts) {
          setTimeout(pollProgress, this.config.pollInterval);
        } else {
          throw new Error(`Progress polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };

    // Start polling
    await pollProgress();
  }

  /**
   * Normalize progress data to ensure consistent format
   */
  private normalizeProgressData(data: any): AnalysisProgress {
    return {
      analysisId: data.analysisId || '',
      files: Math.max(0, data.files || data.filesProcessed || 0),
      percentage: Math.min(100, Math.max(0, data.percentage || data.progress || 0)),
      currentFile: data.currentFile || data.current_file || "",
      completed: data.completed || data.status === "complete" || data.status === "completed",
      totalSize: data.totalSize || data.total_size || 0,
    };
  }

  /**
   * Check if analysis is complete based on progress data
   */
  private isAnalysisComplete(data: any): boolean {
    const progressInfo = data?.progress || data;
    return progressInfo?.status === "complete" || 
           progressInfo?.completed || 
           progressInfo?.status === "completed" ||
           data?.status === "complete" ||
           data?.completed;
  }

  /**
   * Get current progress status without polling
   */
  async getProgressStatus(analysisId: string): Promise<AnalysisProgress | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/progress/${analysisId}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return this.normalizeProgressData(data);
      } else if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Progress endpoint returned ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Failed to get progress status:", error);
      return null;
    }
  }

  /**
   * Cancel progress polling (cleanup)
   */
  createCancellablePoll(
    analysisId: string,
    onProgress: (progress: AnalysisProgress) => void
  ): { poll: () => Promise<void>; cancel: () => void } {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const poll = async (): Promise<void> => {
      if (cancelled) return;

      try {
        const progress = await this.getProgressStatus(analysisId);
        if (progress && !cancelled) {
          onProgress(progress);

          if (!progress.completed && !cancelled) {
            timeoutId = setTimeout(poll, this.config.pollInterval);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("❌ Progress polling error:", error);
          timeoutId = setTimeout(poll, this.config.pollInterval);
        }
      }
    };

    const cancel = (): void => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return { poll, cancel };
  }
}
