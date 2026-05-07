/**
 * Utility functions for the Space Analyzer application
 */

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param func The function to debounce
 * @param wait The delay in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format file size in bytes to human readable format
 * @param bytes Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format date to localized string
 * @param date Date object or timestamp
 * @returns Formatted date string
 */
export function formatDate(date: Date | number | string): string {
  const dateObj = typeof date === "number" || typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleString();
}

/**
 * Check if a path is a directory
 * @param path File system path
 * @returns True if path is a directory
 */
export function isDirectory(path: string): boolean {
  return path.endsWith("\\") || path.endsWith("/");
}

/**
 * Get file extension from path
 * @param path File path
 * @returns File extension without dot
 */
export function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  return lastDot > 0 ? path.substring(lastDot + 1) : "";
}

/**
 * Generate a unique ID
 * @returns Unique identifier string
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Deep clone an object
 * @param obj Object to clone
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param value Value to check
 * @returns True if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}
