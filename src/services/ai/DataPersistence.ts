/**
 * Data Persistence Layer
 * Handles storage and retrieval of analysis data
 */

import { ScanResult } from './ScanningEngine';

export interface StoredAnalysis {
  id: string;
  timestamp: Date;
  scanResult: ScanResult;
  metadata: {
    version: string;
    tags: string[];
    notes?: string;
  };
}

export interface ExportRecord {
  id: string;
  timestamp: Date;
  format: string;
  filename: string;
  size: number;
  analysisId: string;
}

export class DataPersistence {
  private static instance: DataPersistence;
  private readonly STORAGE_KEYS = {
    ANALYSES: 'space_analyzer_analyses',
    EXPORTS: 'space_analyzer_exports',
    SETTINGS: 'space_analyzer_settings',
    CURRENT_ANALYSIS: 'space_analyzer_current'
  };

  static getInstance(): DataPersistence {
    if (!DataPersistence.instance) {
      DataPersistence.instance = new DataPersistence();
    }
    return DataPersistence.instance;
  }

  /**
   * Save analysis to localStorage
   */
  saveAnalysis(scanResult: ScanResult, tags: string[] = [], notes?: string): string {
    try {
      const analyses = this.getAnalyses();
      
      const analysis: StoredAnalysis = {
        id: scanResult.id,
        timestamp: scanResult.timestamp,
        scanResult,
        metadata: {
          version: '1.0',
          tags,
          notes
        }
      };

      // Add or update analysis
      const existingIndex = analyses.findIndex(a => a.id === analysis.id);
      if (existingIndex >= 0) {
        analyses[existingIndex] = analysis;
      } else {
        analyses.push(analysis);
      }

      // Keep only last 20 analyses
      if (analyses.length > 20) {
        analyses.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        analyses.splice(20);
      }

      localStorage.setItem(this.STORAGE_KEYS.ANALYSES, JSON.stringify(analyses));
      
      // Set as current analysis
      this.setCurrentAnalysis(analysis.id);
      
      return analysis.id;
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw new Error('Could not save analysis data');
    }
  }

  /**
   * Get all saved analyses
   */
  getAnalyses(): StoredAnalysis[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.ANALYSES);
      if (!data) return [];
      
      const analyses = JSON.parse(data);
      return analyses.map((analysis: any) => ({
        ...analysis,
        timestamp: new Date(analysis.timestamp),
        scanResult: {
          ...analysis.scanResult,
          timestamp: new Date(analysis.scanResult.timestamp)
        }
      }));
    } catch (error) {
      console.error('Failed to load analyses:', error);
      return [];
    }
  }

  /**
   * Get analysis by ID
   */
  getAnalysis(id: string): StoredAnalysis | null {
    const analyses = this.getAnalyses();
    return analyses.find(a => a.id === id) || null;
  }

  /**
   * Delete analysis
   */
  deleteAnalysis(id: string): boolean {
    try {
      const analyses = this.getAnalyses();
      const filtered = analyses.filter(a => a.id !== id);
      
      if (filtered.length === analyses.length) {
        return false; // Not found
      }

      localStorage.setItem(this.STORAGE_KEYS.ANALYSES, JSON.stringify(filtered));
      
      // Clear current analysis if it was the deleted one
      if (this.getCurrentAnalysis() === id) {
        this.setCurrentAnalysis(null);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      return false;
    }
  }

  /**
   * Get current analysis ID
   */
  getCurrentAnalysis(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEYS.CURRENT_ANALYSIS);
    } catch {
      return null;
    }
  }

  /**
   * Set current analysis ID
   */
  setCurrentAnalysis(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(this.STORAGE_KEYS.CURRENT_ANALYSIS, id);
      } else {
        localStorage.removeItem(this.STORAGE_KEYS.CURRENT_ANALYSIS);
      }
    } catch (error) {
      console.error('Failed to set current analysis:', error);
    }
  }

  /**
   * Get previous analyses for comparison
   */
  getPreviousAnalyses(limit: number = 3): StoredAnalysis[] {
    const analyses = this.getAnalyses();
    const currentId = this.getCurrentAnalysis();
    
    return analyses
      .filter(a => a.id !== currentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Record export
   */
  recordExport(format: string, filename: string, size: number, analysisId: string): string {
    try {
      const exports = this.getExports();
      
      const exportRecord: ExportRecord = {
        id: Date.now().toString(),
        timestamp: new Date(),
        format,
        filename,
        size,
        analysisId
      };

      exports.push(exportRecord);

      // Keep only last 50 exports
      if (exports.length > 50) {
        exports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        exports.splice(50);
      }

      localStorage.setItem(this.STORAGE_KEYS.EXPORTS, JSON.stringify(exports));
      
      return exportRecord.id;
    } catch (error) {
      console.error('Failed to record export:', error);
      throw new Error('Could not record export');
    }
  }

  /**
   * Get export records
   */
  getExports(): ExportRecord[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.EXPORTS);
      if (!data) return [];
      
      const exports = JSON.parse(data);
      return exports.map((exp: any) => ({
        ...exp,
        timestamp: new Date(exp.timestamp)
      }));
    } catch (error) {
      console.error('Failed to load exports:', error);
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    totalAnalyses: number;
    totalExports: number;
    storageUsed: number;
    lastAnalysis: Date | null;
  } {
    const analyses = this.getAnalyses();
    const exports = this.getExports();
    
    let storageUsed = 0;
    try {
      for (const key of Object.values(this.STORAGE_KEYS)) {
        const data = localStorage.getItem(key);
        if (data) {
          storageUsed += data.length;
        }
      }
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
    }

    const lastAnalysis = analyses.length > 0 
      ? analyses.reduce((latest, analysis) => 
          analysis.timestamp > latest.timestamp ? analysis : latest
        ).timestamp
      : null;

    return {
      totalAnalyses: analyses.length,
      totalExports: exports.length,
      storageUsed,
      lastAnalysis
    };
  }

  /**
   * Clear all data
   */
  clearAllData(): void {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Could not clear all data');
    }
  }

  /**
   * Export all data as JSON
   */
  exportAllData(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date(),
      analyses: this.getAnalyses(),
      exports: this.getExports(),
      settings: this.getSettings(),
      stats: this.getStorageStats()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from JSON
   */
  importData(jsonData: string): { analyses: number; exports: number } {
    try {
      const data = JSON.parse(jsonData);
      
      let importedAnalyses = 0;
      let importedExports = 0;

      if (data.analyses && Array.isArray(data.analyses)) {
        localStorage.setItem(this.STORAGE_KEYS.ANALYSES, JSON.stringify(data.analyses));
        importedAnalyses = data.analyses.length;
      }

      if (data.exports && Array.isArray(data.exports)) {
        localStorage.setItem(this.STORAGE_KEYS.EXPORTS, JSON.stringify(data.exports));
        importedExports = data.exports.length;
      }

      if (data.settings) {
        localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }

      return { analyses: importedAnalyses, exports: importedExports };
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Could not import data. Invalid format.');
    }
  }

  /**
   * Get user settings
   */
  getSettings(): Record<string, any> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save user settings
   */
  saveSettings(settings: Record<string, any>): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Could not save settings');
    }
  }

  /**
   * Check if storage is available
   */
  isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage quota information
   */
  getStorageQuota(): { used: number; available: number; percentage: number } {
    if (!this.isStorageAvailable()) {
      return { used: 0, available: 0, percentage: 0 };
    }

    let used = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
    }

    // Estimate 5MB total localStorage quota
    const available = 5 * 1024 * 1024; // 5MB in bytes
    const percentage = (used / available) * 100;

    return { used, available, percentage };
  }
}
