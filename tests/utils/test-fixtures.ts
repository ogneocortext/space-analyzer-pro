/**
 * Test Fixtures for Space Analyzer Application
 * Provides reusable test data and mock responses
 */

import { Page } from '@playwright/test';

export interface MockFileSystemNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  children?: MockFileSystemNode[];
}

export interface MockAnalysisResult {
  id: string;
  timestamp: string;
  totalSize: number;
  fileCount: number;
  directoryCount: number;
  scanDuration: number;
  largestFiles: Array<{
    name: string;
    path: string;
    size: number;
  }>;
  fileTypes: Array<{
    extension: string;
    count: number;
    totalSize: number;
  }>;
  aiInsights?: {
    categories: Array<{
      name: string;
      count: number;
      size: number;
      description: string;
    }>;
    recommendations: string[];
    summary: string;
  };
}

export interface MockBackendStatus {
  status: 'healthy' | 'degraded' | 'error';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  diskSpace: {
    total: number;
    used: number;
    available: number;
  };
  services: {
    database: 'online' | 'offline';
    ai: 'online' | 'offline';
    cache: 'online' | 'offline';
  };
}

export interface MockAIModel {
  id: string;
  name: string;
  provider: string;
  status: 'available' | 'unavailable' | 'loading';
  description: string;
  capabilities: string[];
}

export class TestDataFactory {
  /**
   * Generate mock file system data
   */
  static generateMockFileSystem(depth: number = 3, filesPerDir: number = 5): MockFileSystemNode {
    const generateDirectory = (currentDepth: number, path: string = ''): MockFileSystemNode => {
      const dir: MockFileSystemNode = {
        id: this.generateRandomId(),
        name: `folder-${this.generateRandomString(6)}`,
        path: path,
        type: 'directory',
        size: 0,
        modified: new Date().toISOString(),
        children: []
      };

      if (currentDepth > 0) {
        for (let i = 0; i < filesPerDir; i++) {
          // Add files
          dir.children!.push({
            id: this.generateRandomId(),
            name: `file-${this.generateRandomString(6)}.txt`,
            path: `${path}/${dir.name}/file-${this.generateRandomString(6)}.txt`,
            type: 'file',
            size: Math.floor(Math.random() * 1000000),
            modified: new Date().toISOString()
          });

          // Add subdirectories
          if (i < 2) {
            dir.children!.push(generateDirectory(currentDepth - 1, `${path}/${dir.name}`));
          }
        }
      }

      return dir;
    };

    return generateDirectory(depth);
  }

  /**
   * Generate mock analysis results
   */
  static generateMockAnalysisResult(): MockAnalysisResult {
    return {
      id: this.generateRandomId(),
      timestamp: new Date().toISOString(),
      totalSize: Math.floor(Math.random() * 10000000000), // Up to 10GB
      fileCount: Math.floor(Math.random() * 10000),
      directoryCount: Math.floor(Math.random() * 1000),
      scanDuration: Math.floor(Math.random() * 60000), // Up to 60 seconds
      largestFiles: Array.from({ length: 10 }, () => ({
        name: `large-file-${this.generateRandomString(6)}.bin`,
        path: `/path/to/large-file-${this.generateRandomString(6)}.bin`,
        size: Math.floor(Math.random() * 1000000000) // Up to 1GB
      })),
      fileTypes: [
        { extension: '.txt', count: Math.floor(Math.random() * 1000), totalSize: Math.floor(Math.random() * 100000000) },
        { extension: '.jpg', count: Math.floor(Math.random() * 500), totalSize: Math.floor(Math.random() * 500000000) },
        { extension: '.mp4', count: Math.floor(Math.random() * 100), totalSize: Math.floor(Math.random() * 2000000000) },
        { extension: '.pdf', count: Math.floor(Math.random() * 200), totalSize: Math.floor(Math.random() * 100000000) },
        { extension: '.doc', count: Math.floor(Math.random() * 300), totalSize: Math.floor(Math.random() * 50000000) }
      ],
      aiInsights: {
        categories: [
          {
            name: 'Documents',
            count: Math.floor(Math.random() * 500),
            size: Math.floor(Math.random() * 100000000),
            description: 'Word processing documents, spreadsheets, and presentations'
          },
          {
            name: 'Media',
            count: Math.floor(Math.random() * 300),
            size: Math.floor(Math.random() * 2000000000),
            description: 'Images, videos, and audio files'
          },
          {
            name: 'Code',
            count: Math.floor(Math.random() * 200),
            size: Math.floor(Math.random() * 50000000),
            description: 'Source code files and development resources'
          },
          {
            name: 'Archives',
            count: Math.floor(Math.random() * 100),
            size: Math.floor(Math.random() * 500000000),
            description: 'Compressed files and archives'
          }
        ],
        recommendations: [
          'Consider moving large media files to external storage',
          'Archive old documents that haven\'t been accessed recently',
          'Remove duplicate files to free up space',
          'Compress large files that are rarely used'
        ],
        summary: 'Your storage contains a good mix of document, media, and code files. Consider organizing media files better and archiving old documents.'
      }
    };
  }

  /**
   * Generate mock backend status
   */
  static generateMockBackendStatus(health: 'healthy' | 'degraded' | 'error' = 'healthy'): MockBackendStatus {
    return {
      status: health,
      uptime: Math.floor(Math.random() * 86400000), // Up to 24 hours in milliseconds
      memoryUsage: health === 'healthy' ? Math.random() * 0.7 : Math.random() * 0.9,
      cpuUsage: health === 'healthy' ? Math.random() * 0.5 : Math.random() * 0.8,
      diskSpace: {
        total: 1000000000000, // 1TB
        used: Math.floor(Math.random() * 500000000000), // Up to 500GB
        available: 500000000000 // 500GB
      },
      services: {
        database: health === 'error' ? 'offline' : 'online',
        ai: health === 'degraded' ? 'offline' : 'online',
        cache: 'online'
      }
    };
  }

  /**
   * Generate mock AI models for actual Ollama local API setup
   */
  static generateMockAIModels(): MockAIModel[] {
    return [
      {
        id: 'qwen3.5:4b',
        name: 'Qwen 3.5 4B',
        provider: 'Ollama',
        status: 'available',
        description: 'Qwen 3.5 model with 4B parameters for general analysis',
        capabilities: ['text-analysis', 'categorization', 'summarization']
      },
      {
        id: 'deepseek-coder:6.7b-instruct',
        name: 'DeepSeek Coder 6.7B Instruct',
        provider: 'Ollama',
        status: 'available',
        description: 'DeepSeek Coder model optimized for code analysis and instruction following',
        capabilities: ['text-analysis', 'categorization', 'code-analysis', 'summarization']
      },
      {
        id: 'qwen2.5-coder:7b-instruct',
        name: 'Qwen 2.5 Coder 7B Instruct',
        provider: 'Ollama',
        status: 'available',
        description: 'Qwen 2.5 Coder model with 7B parameters for advanced code analysis',
        capabilities: ['text-analysis', 'categorization', 'code-analysis', 'recommendations']
      },
      {
        id: 'gemma4:e2b',
        name: 'Gemma 4 E2B',
        provider: 'Ollama',
        status: 'available',
        description: 'Gemma 4 model with E2B parameters for efficient analysis',
        capabilities: ['text-analysis', 'categorization', 'summarization']
      },
      {
        id: 'phi4-mini:latest',
        name: 'Phi 4 Mini',
        provider: 'Ollama',
        status: 'available',
        description: 'Phi 4 Mini model for lightweight and fast analysis',
        capabilities: ['text-analysis', 'categorization', 'recommendations']
      },
      {
        id: 'qwen3-vl:4b',
        name: 'Qwen 3 VL 4B',
        provider: 'Ollama',
        status: 'available',
        description: 'Qwen 3 Vision-Language model with 4B parameters',
        capabilities: ['text-analysis', 'categorization', 'visual-analysis', 'summarization']
      },
      {
        id: 'gemma3:4b',
        name: 'Gemma 3 4B',
        provider: 'Ollama',
        status: 'available',
        description: 'Gemma 3 model with 4B parameters for general analysis',
        capabilities: ['text-analysis', 'categorization', 'summarization']
      },
      {
        id: 'llamusic/LLAMUsic2:1b',
        name: 'LLAMUsic 2 1B',
        provider: 'Ollama',
        status: 'available',
        description: 'Lightweight music generation model with 1B parameters',
        capabilities: ['text-analysis', 'audio-analysis', 'categorization']
      },
      {
        id: 'llamusic/llamusic:latest',
        name: 'LLAMUsic Latest',
        provider: 'Ollama',
        status: 'available',
        description: 'Latest LLAMUsic model for music analysis and generation',
        capabilities: ['text-analysis', 'audio-analysis', 'categorization', 'recommendations']
      }
    ];
  }

  /**
   * Generate random ID
   */
  static generateRandomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate random string
   */
  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email
   */
  static generateRandomEmail(): string {
    return `test-${this.generateRandomString(8)}@example.com`;
  }

  /**
   * Generate random file path
   */
  static generateRandomFilePath(): string {
    const fileName = `file-${this.generateRandomString(6)}.txt`;
    const pathParts = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () =>
      `folder-${this.generateRandomString(4)}`
    );
    return `/${pathParts.join('/')}/${fileName}`;
  }
}

export class MockAPIResponses {
  /**
   * Setup mock API responses for common endpoints
   */
  static async setupCommonMocks(page: Page): Promise<void> {
    // Mock backend health check
    await page.route('**/api/health', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TestDataFactory.generateMockBackendStatus())
      });
    });

    // Mock file system scan
    await page.route('**/api/scan', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TestDataFactory.generateRandomId(),
          status: 'completed',
          results: TestDataFactory.generateMockAnalysisResult()
        })
      });
    });

    // Mock AI models endpoint
    await page.route('**/api/ai/models', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TestDataFactory.generateMockAIModels())
      });
    });

    // Mock AI analysis endpoint
    await page.route('**/api/ai/analyze', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          insights: TestDataFactory.generateMockAnalysisResult().aiInsights,
          confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
          processingTime: Math.floor(Math.random() * 5000) + 1000
        })
      });
    });
  }

  /**
   * Setup mock error responses
   */
  static async setupErrorMocks(page: Page): Promise<void> {
    // Mock backend error
    await page.route('**/api/health', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Database connection failed'
        })
      });
    });

    // Mock scan error
    await page.route('**/api/scan', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid directory path'
        })
      });
    });

    // Mock AI error
    await page.route('**/api/ai/analyze', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: 'AI service is currently unavailable'
        })
      });
    });
  }

  /**
   * Setup slow responses for testing loading states
   */
  static async setupSlowResponses(page: Page, delay: number = 5000): Promise<void> {
    await page.route('**/api/**', (route) => {
      setTimeout(() => {
        route.continue();
      }, delay);
    });
  }
}

export class TestEnvironment {
  /**
   * Setup test environment with common configurations
   */
  static async setup(page: Page, options: {
    mockAPI?: boolean;
    mockErrors?: boolean;
    slowResponses?: boolean;
    responseDelay?: number;
  } = {}): Promise<void> {
    const {
      mockAPI = true,
      mockErrors = false,
      slowResponses = false,
      responseDelay = 5000
    } = options;

    if (mockErrors) {
      await MockAPIResponses.setupErrorMocks(page);
    } else if (mockAPI) {
      await MockAPIResponses.setupCommonMocks(page);
    }

    if (slowResponses) {
      await MockAPIResponses.setupSlowResponses(page, responseDelay);
    }

    // Setup console error monitoring
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Setup page error monitoring
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Store errors on page for later retrieval
    await page.evaluate(() => {
      (window as any).testErrors = [];
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page.evaluate((error) => {
          (window as any).testErrors.push(error);
        }, msg.text());
      }
    });
  }

  /**
   * Get test errors from page
   */
  static async getTestErrors(page: Page): Promise<string[]> {
    return await page.evaluate(() => (window as any).testErrors || []);
  }

  /**
   * Clear test errors from page
   */
  static async clearTestErrors(page: Page): Promise<void> {
    await page.evaluate(() => {
      (window as any).testErrors = [];
    });
  }
}
