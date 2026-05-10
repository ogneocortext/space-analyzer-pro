/**
 * Progress Tracker - Handles scan progress tracking and management
 * Extracted from analysis store for better maintainability
 */

import { ref, computed } from "vue";
import { useNotificationStore } from "@/store/notificationStore";

export interface ProgressData {
  files: number;
  percentage: number;
  currentFile: string;
  completed: boolean;
  totalSize: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface ProgressCallbacks {
  onProgress?: (progress: ProgressData) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export class ProgressTracker {
  private progress = ref<ProgressData>({
    files: 0,
    percentage: 0,
    currentFile: "Starting scan...",
    completed: false,
    totalSize: 0,
  });

  private callbacks = ref<ProgressCallbacks>({});
  private isTracking = ref(false);
  private analysisStartTime = ref<number | null>(null);
  private pollingInterval: number | null = null;

  constructor() {
    // Auto-cleanup on unmount
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Start tracking a new analysis
   */
  startTracking(analysisId: string, callbacks?: ProgressCallbacks): void {
    this.isTracking.value = true;
    this.analysisStartTime.value = Date.now();
    this.callbacks.value = callbacks || {};

    // Reset progress data
    this.progress.value = {
      files: 0,
      percentage: 0,
      currentFile: "Starting scan...",
      completed: false,
      totalSize: 0,
      startTime: Date.now(),
    };

    // Start polling for progress updates
    this.startProgressPolling(analysisId);
  }

  /**
   * Update progress from external source
   */
  updateProgress(progressInfo: Partial<ProgressData>): void {
    if (!this.isTracking.value) return;

    this.progress.value = {
      ...this.progress.value,
      ...progressInfo,
    };

    // Call progress callback
    if (this.callbacks.value.onProgress) {
      this.callbacks.value.onProgress(this.progress.value);
    }

    // Check if completed
    if (progressInfo.completed) {
      this.completeTracking();
    }
  }

  /**
   * Complete tracking and notify callbacks
   */
  completeTracking(result?: any): void {
    if (!this.isTracking.value) return;

    const endTime = Date.now();
    const duration = this.analysisStartTime.value ? endTime - this.analysisStartTime.value : 0;

    this.progress.value = {
      ...this.progress.value,
      percentage: 100,
      completed: true,
      currentFile: "Analysis complete",
      endTime,
    };

    this.isTracking.value = false;
    this.stopPolling();

    // Show completion notification
    this.showCompletionNotification();

    // Call completion callback
    if (this.callbacks.value.onComplete) {
      this.callbacks.value.onComplete(result);
    }
  }

  /**
   * Handle tracking error
   */
  handleError(error: string): void {
    if (!this.isTracking.value) return;

    this.progress.value = {
      ...this.progress.value,
      error,
      completed: true,
      currentFile: "Analysis failed",
      endTime: Date.now(),
    };

    this.isTracking.value = false;
    this.stopPolling();

    // Call error callback
    if (this.callbacks.value.onError) {
      this.callbacks.value.onError(error);
    }
  }

  /**
   * Start progress polling for a specific analysis
   */
  private startProgressPolling(analysisId: string): void {
    this.stopPolling(); // Clear any existing polling

    this.pollingInterval = setInterval(async () => {
      if (!this.isTracking.value) {
        this.stopPolling();
        return;
      }

      try {
        const response = await fetch(`/api/progress/${analysisId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.updateProgress({
              files: data.files || 0,
              percentage: data.percentage || 0,
              currentFile: data.currentFile || "Scanning...",
              completed: data.completed || false,
              totalSize: data.totalSize || 0,
            });
          }
        }
      } catch (error) {
        console.warn("Failed to poll progress:", error);
        // Don't treat polling errors as critical unless tracking is active
      }
    }, 1000); // Poll every 1 second
  }

  /**
   * Stop progress polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Show completion notification
   */
  private showCompletionNotification(): void {
    const notificationStore = useNotificationStore();
    const duration = this.analysisStartTime.value
      ? Math.round((Date.now() - this.analysisStartTime.value) / 1000)
      : 0;

    notificationStore.success(
      "Scan Complete! 🎉",
      `Successfully scanned ${this.progress.value.files.toLocaleString()} files in ${duration} seconds`
    );
  }

  /**
   * Get current progress data
   */
  get currentProgress(): ProgressData {
    return this.progress.value;
  }

  /**
   * Get progress percentage
   */
  get progressPercentage(): number {
    return this.progress.value.percentage;
  }

  /**
   * Get files scanned count
   */
  get filesScanned(): number {
    return this.progress.value.files;
  }

  /**
   * Get current file being scanned
   */
  get currentFile(): string {
    return this.progress.value.currentFile;
  }

  /**
   * Check if tracking is active
   */
  get isActive(): boolean {
    return this.isTracking.value;
  }

  /**
   * Check if scan is completed
   */
  get isCompleted(): boolean {
    return this.progress.value.completed;
  }

  /**
   * Get error message if any
   */
  get errorMessage(): string | null {
    return this.progress.value.error || null;
  }

  /**
   * Get scan duration in seconds
   */
  get duration(): number {
    if (this.progress.value.startTime && this.progress.value.endTime) {
      return Math.round((this.progress.value.endTime - this.progress.value.startTime) / 1000);
    }
    return 0;
  }

  /**
   * Get estimated time remaining
   */
  get estimatedTimeRemaining(): number | null {
    if (!this.isTracking.value || this.progress.value.percentage >= 100) {
      return null;
    }

    const elapsed = this.progress.value.startTime ? Date.now() - this.progress.value.startTime : 0;
    const progress = this.progress.value.percentage;

    if (progress === 0) return null;

    // Rough estimate: if we're at X%, assume linear progress
    const remainingPercent = 100 - progress;
    return Math.ceil(remainingPercent * (elapsed / Math.max(progress, 1)));
  }

  /**
   * Reset progress tracking
   */
  reset(): void {
    this.stopPolling();
    this.isTracking.value = false;
    this.progress.value = {
      files: 0,
      percentage: 0,
      currentFile: "Starting scan...",
      completed: false,
      totalSize: 0,
    };
    this.callbacks.value = {};
    this.analysisStartTime.value = null;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopPolling();
    this.reset();
  }
}

// Create reactive computed properties for easy access
export function useProgressTracker() {
  const tracker = new ProgressTracker();

  const progress = computed(() => tracker.currentProgress);
  const percentage = computed(() => tracker.progressPercentage);
  const filesScanned = computed(() => tracker.filesScanned);
  const currentFile = computed(() => tracker.currentFile);
  const isActive = computed(() => tracker.isActive);
  const isCompleted = computed(() => tracker.isCompleted);
  const duration = computed(() => tracker.duration);
  const estimatedTimeRemaining = computed(() => tracker.estimatedTimeRemaining);

  return {
    // State
    progress,
    percentage,
    filesScanned,
    currentFile,
    isActive,
    isCompleted,
    duration,
    estimatedTimeRemaining,
    // Methods
    startTracking: tracker.startTracking.bind(tracker),
    updateProgress: tracker.updateProgress.bind(tracker),
    completeTracking: tracker.completeTracking.bind(tracker),
    handleError: tracker.handleError.bind(tracker),
    reset: tracker.reset.bind(tracker),
    cleanup: tracker.cleanup.bind(tracker),
    // Direct access to tracker instance
    tracker,
  };
}

export default ProgressTracker;
