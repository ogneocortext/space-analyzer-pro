import { ref, computed } from "vue";

interface HistoricalDataPoint {
  date: string;
  size: number;
  files: number;
  categories?: Record<string, { size: number; count: number; growth?: number }>;
}

interface AnalysisResult {
  totalSize?: number;
  totalFiles?: number;
  categories?: Record<string, { size: number; count: number; growth?: number }>;
  summary?: {
    totalSize: number;
    totalFiles: number;
  };
  file_analysis?: {
    total_size: {
      bytes: number;
      formatted: string;
    };
    total_files: number;
  };
  [key: string]: unknown;
}

class HistoricalDataService {
  private storageKey = "space-analyzer-historical-data";
  private maxDataPoints = 24; // Keep 24 months of data

  async saveAnalysisData(result: AnalysisResult): Promise<void> {
    try {
      const historicalData = this.getHistoricalData();
      const today = new Date().toISOString().split("T")[0];

      // Extract total size and files from different possible structures
      const totalSize =
        result.totalSize ||
        result.summary?.totalSize ||
        result.file_analysis?.total_size?.bytes ||
        0;

      const totalFiles =
        result.totalFiles || result.summary?.totalFiles || result.file_analysis?.total_files || 0;

      const newDataPoint: HistoricalDataPoint = {
        date: today,
        size: totalSize,
        files: totalFiles,
        categories: result.categories,
      };

      // Remove existing entry for today if it exists
      const existingIndex = historicalData.findIndex((d) => d.date === today);
      if (existingIndex >= 0) {
        historicalData[existingIndex] = newDataPoint;
      } else {
        historicalData.push(newDataPoint);
      }

      // Sort by date and keep only recent data
      historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (historicalData.length > this.maxDataPoints) {
        historicalData.splice(0, historicalData.length - this.maxDataPoints);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(historicalData));
    } catch (error) {
      console.error("Failed to save historical data:", error);
    }
  }

  getHistoricalData(): HistoricalDataPoint[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load historical data:", error);
      return [];
    }
  }

  calculateGrowthRate(data: HistoricalDataPoint[]): number {
    if (data.length < 2) return 0;

    // Use linear regression on the last 6 data points for more accurate growth rate
    const recentData = data.slice(-6);
    if (recentData.length < 2) return 0;

    const n = recentData.length;
    const sumX = recentData.reduce((sum, _, index) => sum + index, 0);
    const sumY = recentData.reduce((sum, point) => sum + Math.log(point.size), 0);
    const sumXY = recentData.reduce((sum, point, index) => sum + index * Math.log(point.size), 0);
    const sumX2 = recentData.reduce((sum, _, index) => sum + index * index, 0);

    // Calculate slope (growth rate) using linear regression
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Convert from log growth to monthly percentage
    return Math.exp(slope) - 1;
  }

  calculateMonthlyGrowth(data: HistoricalDataPoint[]): number {
    if (data.length < 2) return 0;

    const first = data[0];
    const last = data[data.length - 1];
    const months = data.length - 1;

    if (!first || !last || months === 0 || first.size === 0) return 0;

    // Compound monthly growth rate
    return Math.pow(last.size / first.size, 1 / months) - 1;
  }

  generateProjections(currentData: AnalysisResult, growthRate: number) {
    // Extract total size from different possible structures
    const currentSize =
      currentData?.totalSize ||
      currentData?.summary?.totalSize ||
      currentData?.file_analysis?.total_size?.bytes ||
      0;

    const targetSize = 100 * 1024 * 1024 * 1024; // 100GB

    if (growthRate <= 0 || currentSize === 0) {
      return {
        nextMonth: currentSize,
        nextQuarter: currentSize,
        nextYear: currentSize,
        fillDate: null,
      };
    }

    const monthlyGrowth = growthRate;

    // Calculate projections using compound growth
    const nextMonth = currentSize * (1 + monthlyGrowth);
    const nextQuarter = currentSize * Math.pow(1 + monthlyGrowth, 3);
    const nextYear = currentSize * Math.pow(1 + monthlyGrowth, 12);

    // Calculate when storage will be full
    let fillDate: Date | null = null;
    if (monthlyGrowth > 0 && currentSize < targetSize) {
      const monthsToFill = Math.log(targetSize / currentSize) / Math.log(1 + monthlyGrowth);
      if (monthsToFill > 0 && monthsToFill < 120) {
        // Reasonable limit of 10 years
        fillDate = new Date();
        fillDate.setMonth(fillDate.getMonth() + Math.ceil(monthsToFill));
      }
    }

    return {
      nextMonth,
      nextQuarter,
      nextYear,
      fillDate,
    };
  }

  getCategoryTrends(
    data: HistoricalDataPoint[]
  ): Array<{ category: string; current: number; growth: number }> {
    if (data.length < 2) {
      // Return fallback data if no historical data
      return [
        { category: "Documents", current: 15.2 * 1024 * 1024 * 1024, growth: 12 },
        { category: "Images", current: 25.8 * 1024 * 1024 * 1024, growth: 28 },
        { category: "Videos", current: 22.4 * 1024 * 1024 * 1024, growth: 45 },
        { category: "Code", current: 8.5 * 1024 * 1024 * 1024, growth: 8 },
        { category: "Archives", current: 6.7 * 1024 * 1024 * 1024, growth: -5 },
      ];
    }

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    if (!latest.categories) {
      return [];
    }

    return Object.entries(latest.categories).map(([category, currentData]) => {
      const currentSize = (currentData as { size: number }).size || 0;
      const previousSize = previous.categories?.[category]?.size || 0;
      const growth = previousSize > 0 ? ((currentSize - previousSize) / previousSize) * 100 : 0;

      return {
        category,
        current: currentSize,
        growth,
      };
    });
  }

  clearHistoricalData(): void {
    localStorage.removeItem(this.storageKey);
  }
}

export const historicalDataService = new HistoricalDataService();
export type { HistoricalDataPoint, AnalysisResult };
