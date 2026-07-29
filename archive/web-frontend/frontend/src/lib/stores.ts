import type { Writable } from 'svelte/store';

export interface ScanResult {
  total_files: number;
  total_directories: number;
  total_size: number;
  file_types: Record<string, number>;
  extension_sizes: Record<string, number>;
  size_distribution: Record<string, number>;
  largest_files: Array<{
    path: string;
    name: string;
    size: number;
    modified: string | null;
    file_type: string;
    extension: string;
  }>;
  empty_directories: string[];
  errors: string[];
  subdirectories: Array<{
    path: string;
    name: string;
    total_size: number;
    file_count: number;
    dir_count: number;
    largest_file_size: number;
  }>;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: string | null;
  file_type: string;
  extension: string;
}

function createScanStore(): Writable<ScanResult | null> {
  return {
    subscribe: (run) => {
      let value: ScanResult | null = null;
      const listener = () => {
        const stored = localStorage.getItem('lastScanResult');
        if (stored) {
          try {
            value = JSON.parse(stored);
          } catch {
            value = null;
          }
        } else {
          value = null;
        }
        run(value);
      };
      listener();
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
    set(value) {
      if (value === null) {
        localStorage.removeItem('lastScanResult');
      } else {
        localStorage.setItem('lastScanResult', JSON.stringify(value));
      }
    },
    update(fn) {
      const current = typeof fn === 'function' ? (fn as (v: ScanResult | null) => ScanResult | null)(null) : null;
      this.set(current);
    },
  };
}

export const lastScanResult = createScanStore();

export function saveLastScan(result: ScanResult) {
  lastScanResult.set(result);
}
