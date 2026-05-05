/**
 * Local Tool Registry for Space Analyzer
 * Provides localhost-only tools that don't require Ollama Cloud
 * All tools execute locally using system APIs or environment variables
 */

import { ollamaRateLimiter } from "../OllamaRateLimiter";

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Tool definition for Ollama chat API
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

// Tool handler function type
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

// Tool registry entry
interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  requiresCloud: boolean;
}

class LocalToolRegistry {
  private tools: Map<string, ToolEntry> = new Map();
  private initialized = false;

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register all default localhost tools
   */
  private registerDefaultTools(): void {
    // File system analysis tools
    this.registerFileSystemTools();
    
    // Disk usage tools
    this.registerDiskUsageTools();
    
    // System information tools
    this.registerSystemTools();
    
    // Search and filtering tools
    this.registerSearchTools();
    
    // Calculation tools
    this.registerCalculationTools();
    
    this.initialized = true;
  }

  /**
   * File system analysis tools
   */
  private registerFileSystemTools(): void {
    // Analyze directory structure
    this.register({
      definition: {
        type: "function",
        function: {
          name: "analyze_directory",
          description: "Analyze a directory's structure, size, and file distribution. Returns total size, file count, and subdirectory breakdown.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Absolute or relative path to the directory to analyze",
              },
              max_depth: {
                type: "number",
                description: "Maximum depth to traverse (1-5). Default: 2",
              },
              include_hidden: {
                type: "boolean",
                description: "Whether to include hidden files (starting with .). Default: false",
              },
            },
            required: ["path"],
          },
        },
      },
      handler: async (args) => {
        try {
          // This will be implemented by the file system scanner
          const result = await this.callFileSystemAPI("analyze", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to analyze directory: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });

    // Find duplicate files
    this.register({
      definition: {
        type: "function",
        function: {
          name: "find_duplicates",
          description: "Find duplicate files in a directory or across multiple directories. Returns groups of duplicate files with their paths and sizes.",
          parameters: {
            type: "object",
            properties: {
              paths: {
                type: "array",
                description: "Array of directory paths to search for duplicates",
              },
              min_size_bytes: {
                type: "number",
                description: "Minimum file size to consider (in bytes). Default: 1024 (1KB)",
              },
              hash_algorithm: {
                type: "string",
                description: "Hash algorithm for comparison: 'md5', 'sha256', or 'quick'. Default: 'quick'",
              },
            },
            required: ["paths"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("find_duplicates", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to find duplicates: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });

    // Find large files
    this.register({
      definition: {
        type: "function",
        function: {
          name: "find_large_files",
          description: "Find files larger than a specified size. Useful for identifying storage hogs.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Directory path to search",
              },
              min_size_mb: {
                type: "number",
                description: "Minimum file size in MB. Default: 100",
              },
              top_n: {
                type: "number",
                description: "Number of largest files to return. Default: 20",
              },
            },
            required: ["path"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("find_large", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to find large files: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });

    // Get file type distribution
    this.register({
      definition: {
        type: "function",
        function: {
          name: "get_file_distribution",
          description: "Get distribution of file types in a directory. Returns count and total size per file extension.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Directory path to analyze",
              },
              group_by: {
                type: "string",
                description: "Grouping method: 'extension', 'category', or 'size_range'. Default: 'extension'",
              },
            },
            required: ["path"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("distribution", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to get file distribution: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });
  }

  /**
   * Disk usage and cleanup tools
   */
  private registerDiskUsageTools(): void {
    // Get disk usage for a drive/path
    this.register({
      definition: {
        type: "function",
        function: {
          name: "get_disk_usage",
          description: "Get disk usage information for a drive or path. Returns total, used, and free space.",
          parameters: {
            type: "object",
            properties: {
              drive: {
                type: "string",
                description: "Drive letter (Windows) or mount point (Linux/Mac). Examples: 'C:', 'D:', '/'",
              },
            },
            required: ["drive"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("disk_usage", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to get disk usage: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });

    // Get cleanup recommendations
    this.register({
      definition: {
        type: "function",
        function: {
          name: "get_cleanup_recommendations",
          description: "Get AI-powered cleanup recommendations for a directory. Analyzes file patterns and suggests what can be safely deleted or archived.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Directory path to analyze",
              },
              min_age_days: {
                type: "number",
                description: "Minimum age in days to consider for cleanup. Default: 90",
              },
              include_temp: {
                type: "boolean",
                description: "Include temporary files in analysis. Default: true",
              },
              include_cache: {
                type: "boolean",
                description: "Include cache files in analysis. Default: true",
              },
            },
            required: ["path"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("cleanup_recommendations", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to get cleanup recommendations: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });

    // Find old files
    this.register({
      definition: {
        type: "function",
        function: {
          name: "find_old_files",
          description: "Find files that haven't been accessed or modified in a specified time period.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Directory path to search",
              },
              older_than_days: {
                type: "number",
                description: "Files older than this many days. Default: 365",
              },
              access_type: {
                type: "string",
                description: "Type of time check: 'modified', 'accessed', or 'created'. Default: 'accessed'",
              },
            },
            required: ["path"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("find_old", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to find old files: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });
  }

  /**
   * System information tools
   */
  private registerSystemTools(): void {
    // Get system info
    this.register({
      definition: {
        type: "function",
        function: {
          name: "get_system_info",
          description: "Get system information including OS, drives, and basic hardware info.",
          parameters: {
            type: "object",
            properties: {
              include_drives: {
                type: "boolean",
                description: "Include drive information. Default: true",
              },
            },
            required: [],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callSystemAPI("info", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to get system info: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });
  }

  /**
   * Search and filter tools
   */
  private registerSearchTools(): void {
    // Search files by name pattern
    this.register({
      definition: {
        type: "function",
        function: {
          name: "search_files",
          description: "Search for files by name pattern (supports wildcards like *.jpg, document*.*)",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Directory path to search",
              },
              pattern: {
                type: "string",
                description: "File name pattern. Examples: '*.txt', 'document*', '*.jpg'",
              },
              recursive: {
                type: "boolean",
                description: "Search recursively in subdirectories. Default: true",
              },
            },
            required: ["path", "pattern"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("search", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to search files: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });

    // Filter by file type/category
    this.register({
      definition: {
        type: "function",
        function: {
          name: "filter_by_category",
          description: "Filter files by category: 'images', 'videos', 'documents', 'audio', 'archives', 'code', 'executables', 'temporary'",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Directory path to filter",
              },
              category: {
                type: "string",
                description: "File category to filter by",
              },
              min_size_mb: {
                type: "number",
                description: "Minimum size in MB. Default: 0",
              },
            },
            required: ["path", "category"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("filter_category", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to filter files: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });
  }

  /**
   * Calculation and utility tools
   */
  private registerCalculationTools(): void {
    // Calculate size conversions
    this.register({
      definition: {
        type: "function",
        function: {
          name: "convert_size",
          description: "Convert between size units (B, KB, MB, GB, TB). Returns all common formats.",
          parameters: {
            type: "object",
            properties: {
              size: {
                type: "number",
                description: "Size value",
              },
              from_unit: {
                type: "string",
                description: "Source unit: 'B', 'KB', 'MB', 'GB', 'TB'",
              },
            },
            required: ["size", "from_unit"],
          },
        },
      },
      handler: async (args) => {
        const size = args.size as number;
        const fromUnit = (args.from_unit as string).toUpperCase();
        
        const units = ["B", "KB", "MB", "GB", "TB"];
        const multipliers: Record<string, number> = {
          B: 1,
          KB: 1024,
          MB: 1024 ** 2,
          GB: 1024 ** 3,
          TB: 1024 ** 4,
        };

        const bytes = size * (multipliers[fromUnit] || 1);
        
        const result: Record<string, string> = {};
        for (const unit of units) {
          result[unit] = (bytes / multipliers[unit]).toFixed(2);
        }

        return { success: true, data: result };
      },
      requiresCloud: false,
    });

    // Estimate cleanup savings
    this.register({
      definition: {
        type: "function",
        function: {
          name: "estimate_cleanup_savings",
          description: "Estimate potential space savings from cleanup operations.",
          parameters: {
            type: "object",
            properties: {
              operations: {
                type: "array",
                description: "Array of cleanup operations to estimate. Each should have 'type' and 'target_path'",
              },
            },
            required: ["operations"],
          },
        },
      },
      handler: async (args) => {
        try {
          const result = await this.callFileSystemAPI("estimate_savings", args);
          return { success: true, data: result };
        } catch (error) {
          return { 
            success: false, 
            error: `Failed to estimate savings: ${error instanceof Error ? error.message : "Unknown error"}` 
          };
        }
      },
      requiresCloud: false,
    });
  }

  /**
   * Register a tool
   */
  register(entry: ToolEntry): void {
    this.tools.set(entry.definition.function.name, entry);
  }

  /**
   * Get all tool definitions for Ollama API
   */
  getToolDefinitions(cloudAllowed = false): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    
    for (const [name, entry] of this.tools) {
      // Skip cloud-dependent tools if cloud is not allowed
      if (entry.requiresCloud && !cloudAllowed) {
        continue;
      }
      definitions.push(entry.definition);
    }
    
    return definitions;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const entry = this.tools.get(name);
    
    if (!entry) {
      return { success: false, error: `Tool '${name}' not found` };
    }

    // Check if tool requires cloud and if we're in local-only mode
    if (entry.requiresCloud && ollamaRateLimiter.isLocalOnlyMode()) {
      return { 
        success: false, 
        error: `Tool '${name}' requires Ollama Cloud but local-only mode is enabled` 
      };
    }

    try {
      return await entry.handler(args);
    } catch (error) {
      return { 
        success: false, 
        error: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}` 
      };
    }
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools that require cloud
   */
  getCloudDependentTools(): string[] {
    const cloudTools: string[] = [];
    for (const [name, entry] of this.tools) {
      if (entry.requiresCloud) {
        cloudTools.push(name);
      }
    }
    return cloudTools;
  }

  /**
   * Get localhost-only tools (no cloud required)
   */
  getLocalOnlyTools(): string[] {
    const localTools: string[] = [];
    for (const [name, entry] of this.tools) {
      if (!entry.requiresCloud) {
        localTools.push(name);
      }
    }
    return localTools;
  }

  /**
   * Call file system API (placeholder - to be implemented with actual Tauri/native APIs)
   */
  private async callFileSystemAPI(
    operation: string, 
    args: Record<string, unknown>
  ): Promise<unknown> {
    // This will be implemented to call your file system scanner
    // For now, return a placeholder
    console.log(`[LocalToolRegistry] FileSystem API call: ${operation}`, args);
    
    // TODO: Implement actual calls to your file system scanner
    // Example: return await invoke('file_system_operation', { operation, args });
    
    return { 
      operation, 
      args, 
      status: "not_implemented",
      note: "Implement with actual file system scanner APIs" 
    };
  }

  /**
   * Call system API (placeholder - to be implemented with actual Tauri/native APIs)
   */
  private async callSystemAPI(
    operation: string, 
    args: Record<string, unknown>
  ): Promise<unknown> {
    console.log(`[LocalToolRegistry] System API call: ${operation}`, args);
    
    // TODO: Implement actual system API calls
    
    return { 
      operation, 
      args, 
      status: "not_implemented",
      note: "Implement with actual system APIs" 
    };
  }
}

// Export singleton
export const localToolRegistry = new LocalToolRegistry();
export default localToolRegistry;
