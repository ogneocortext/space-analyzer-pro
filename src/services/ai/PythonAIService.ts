/**
 * Python AI Service Client
 * TypeScript client for the Python FastAPI ML service
 * Provides file categorization and cleanup recommendations
 */

export interface FileData {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified_time: number;
  category?: string;
}

export interface CategoryPrediction {
  path: string;
  predicted_category: string;
  confidence: number;
  alternatives: Array<{
    category: string;
    confidence: number;
  }>;
}

export interface CleanupRecommendation {
  file_path: string;
  confidence: number;
  action: 'delete' | 'archive' | 'review';
  reason: string;
}

export interface DirectoryAnalysis {
  directory_path: string;
  total_files: number;
  total_size: number;
  file_types: Record<string, number>;
  age_distribution: Record<string, number>;
  largest_files: FileData[];
}

export interface MLModelStatus {
  model_name: string;
  trained: boolean;
  accuracy: number | null;
  last_trained: string | null;
  sample_count: number;
}

export interface AIServiceHealth {
  success: boolean;
  node: string;
  ai_service: 'healthy' | 'degraded' | 'unavailable';
  ai_service_url: string;
  error?: string;
}

class PythonAIService {
  private baseUrl: string;

  constructor() {
    // Use the Node.js backend proxy, not directly to Python service
    this.baseUrl = '/api/ai';
  }

  /**
   * Check health of both Node backend and Python AI service
   */
  async checkHealth(): Promise<AIServiceHealth> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get status of all ML models
   */
  async getModelsStatus(): Promise<MLModelStatus[]> {
    const response = await fetch(`${this.baseUrl}/models`);
    if (!response.ok) {
      throw new Error(`Failed to get models status: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models;
  }

  /**
   * Predict category for a single file
   */
  async predictCategory(fileData: FileData): Promise<CategoryPrediction> {
    const response = await fetch(`${this.baseUrl}/predict/category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fileData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to predict category');
    }

    const data = await response.json();
    return data.prediction;
  }

  /**
   * Predict categories for multiple files in batch
   */
  async predictCategoriesBatch(files: FileData[]): Promise<CategoryPrediction[]> {
    const response = await fetch(`${this.baseUrl}/predict/categories-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to batch predict categories');
    }

    const data = await response.json();
    return data.predictions;
  }

  /**
   * Get cleanup recommendations for a directory
   */
  async predictCleanup(analysis: DirectoryAnalysis): Promise<CleanupRecommendation[]> {
    const response = await fetch(`${this.baseUrl}/predict/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysis),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get cleanup recommendations');
    }

    const data = await response.json();
    return data.recommendations;
  }

  /**
   * Train the file categorizer model
   */
  async trainCategorizer(files: FileData[]): Promise<{ message: string; files_count: number }> {
    const response = await fetch(`${this.baseUrl}/train/categorizer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to train categorizer');
    }

    return response.json();
  }

  /**
   * Train the cleanup predictor model
   */
  async trainCleanupPredictor(analyses: DirectoryAnalysis[]): Promise<{ message: string; analyses_count: number }> {
    const response = await fetch(`${this.baseUrl}/train/cleanup-predictor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ analyses }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to train cleanup predictor');
    }

    return response.json();
  }

  /**
   * Convert a file object to FileData format
   */
  static toFileData(file: {
    path: string;
    name?: string;
    size: number;
    extension?: string;
    modified_time?: number;
  }): FileData {
    const now = Date.now() / 1000;
    return {
      path: file.path,
      name: file.name || file.path.split('/').pop() || 'unknown',
      size: file.size,
      extension: file.extension || file.path.split('.').pop() || '',
      modified_time: file.modified_time || now,
    };
  }

  /**
   * Get category icon/emoji for display
   */
  static getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      documents: '📄',
      images: '🖼️',
      videos: '🎬',
      audio: '🎵',
      archives: '📦',
      code: '💻',
      data: '📊',
      executables: '⚙️',
      other: '📁',
    };
    return icons[category] || '📁';
  }

  /**
   * Get action icon for cleanup recommendations
   */
  static getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      delete: '🗑️',
      archive: '📦',
      review: '👀',
    };
    return icons[action] || '❓';
  }

  /**
   * Get confidence color based on score
   */
  static getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  }
}

export default PythonAIService;
