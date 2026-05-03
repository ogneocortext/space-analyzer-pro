/**
 * Path Validator Module
 * Handles path validation, normalization, and security
 */

export class PathValidator {
  /**
   * Enhanced path validation and normalization
   */
  static validateAndNormalizePath(path: string): string {
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    // First, clean the path by removing quotes and whitespace
    let normalizedPath = path.replace(/^["']|["']$/g, "").trim();

    // Check if this is a File System Access API result with actual directory path
    if (normalizedPath.startsWith("[Selected Directory]")) {
      throw new Error("Invalid directory path: placeholder detected instead of actual path");
    }

    // Security checks
    this.performSecurityChecks(normalizedPath);

    // Check if this is an absolute path (Windows drive letter or Unix path)
    if (this.isAbsolutePath(normalizedPath)) {
      // Keep absolute paths as-is
      return normalizedPath;
    } else {
      // Handle relative paths
      return this.normalizeRelativePath(normalizedPath);
    }
  }

  /**
   * Security checks for path traversal and malicious paths
   */
  private static performSecurityChecks(path: string): void {
    // Check for path traversal attempts
    const traversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\.\.\.\//,
      /\.\.\.\\/,
      /\.\.\.\.\//,
      /\.\.\.\.\\/,
    ];

    for (const pattern of traversalPatterns) {
      if (pattern.test(path)) {
        throw new Error('Security error: Path traversal detected');
      }
    }

    // Check for suspicious characters
    const suspiciousChars = /[<>:"|?*\x00-\x1f]/;
    if (suspiciousChars.test(path)) {
      throw new Error('Security error: Invalid characters in path');
    }

    // Check for extremely long paths
    if (path.length > 260) { // Windows MAX_PATH limit
      throw new Error('Security error: Path too long');
    }
  }

  /**
   * Check if path is absolute
   */
  private static isAbsolutePath(path: string): boolean {
    // Windows drive letter pattern (e.g., C:\ or D:/)
    const windowsPattern = /^[a-zA-Z]:[/\\]/;
    // Unix absolute path pattern (e.g., /home/user)
    const unixPattern = /^\//;
    
    return windowsPattern.test(path) || unixPattern.test(path);
  }

  /**
   * Normalize relative paths
   */
  private static normalizeRelativePath(path: string): string {
    // Remove leading ./ and ../
    let normalizedPath = path.replace(/^\.\//, "").replace(/^\.\.\//, "");
    
    // If it doesn't start with ., add current directory context
    if (!normalizedPath.startsWith(".")) {
      normalizedPath = `./${normalizedPath}`;
    }
    
    return normalizedPath;
  }

  /**
   * Extract directory name from path
   */
  static extractDirectoryName(path: string): string {
    const normalizedPath = this.validateAndNormalizePath(path);
    
    if (this.isAbsolutePath(normalizedPath)) {
      // For absolute paths, get the last component
      const parts = normalizedPath.split(/[/\\]/);
      return parts[parts.length - 1] || normalizedPath;
    } else {
      // For relative paths, get the last component after ./
      const parts = normalizedPath.replace(/^\.\//, "").split(/[/\\]/);
      return parts[parts.length - 1] || normalizedPath;
    }
  }

  /**
   * Check if path exists (client-side validation only)
   */
  static async validatePathExists(path: string): Promise<boolean> {
    try {
      // This is a basic client-side validation
      // Server-side validation should be performed for actual existence checks
      const normalizedPath = this.validateAndNormalizePath(path);
      
      // Basic checks that would indicate obvious invalid paths
      if (normalizedPath.length === 0) return false;
      if (normalizedPath === '.' || normalizedPath === './') return false;
      
      return true; // Assume valid for client-side
    } catch (error) {
      return false;
    }
  }

  /**
   * Get path type (file vs directory)
   */
  static getPathType(path: string): 'file' | 'directory' | 'unknown' {
    try {
      const normalizedPath = this.validateAndNormalizePath(path);
      
      // Basic heuristic: if path ends with slash or separator, it's likely a directory
      if (normalizedPath.endsWith('/') || normalizedPath.endsWith('\\')) {
        return 'directory';
      }
      
      // If path has an extension, it's likely a file
      if (/\.[^.\/\\]+$/.test(normalizedPath)) {
        return 'file';
      }
      
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }
}
