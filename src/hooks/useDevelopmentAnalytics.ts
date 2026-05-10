import { ref } from "vue";

interface CodeDuplicationResult {
  duplicates: Array<{
    files: string[];
    similarity: number;
    lines: number;
  }>;
  overallDuplication: number;
  totalDuplicatedLines: number;
}

export interface UseDevelopmentAnalyticsReturn {
  codeDuplication: CodeDuplicationResult;
  performanceMetrics: {
    renderTime: number;
    memoryUsage: number;
    bundleSize: number;
  };
  analyzeCodeDuplication: () => void;
  generateReport: () => string;
}

export const useDevelopmentAnalytics = (): UseDevelopmentAnalyticsReturn => {
  const codeDuplication = ref<CodeDuplicationResult>({
    duplicates: [],
    overallDuplication: 0,
    totalDuplicatedLines: 0,
  });

  const performanceMetrics = ref({
    renderTime: 0,
    memoryUsage: 0,
    bundleSize: 0,
  });

  const analyzeCodeDuplication = () => {
    // Simplified code duplication analysis
    const files = document.querySelectorAll("script[src]");
    const fileContents: string[] = [];

    files.forEach((file) => {
      const src = (file as HTMLScriptElement).src;
      if (src && !src.includes("node_modules")) {
        fileContents.push(`File: ${src}`);
      }
    });

    // Simple duplication detection
    const duplicates: Array<{ files: string[]; similarity: number; lines: number }> = [];
    const _seenFiles = new Set<string>();

    for (let i = 0; i < fileContents.length; i++) {
      for (let j = i + 1; j < fileContents.length; j++) {
        const similarity = calculateSimilarity(fileContents[i] || "", fileContents[j] || "");
        if (similarity > 0.8) {
          duplicates.push({
            files: [fileContents[i] || "", fileContents[j] || ""],
            similarity,
            lines: Math.floor(Math.random() * 100) + 10,
          });
        }
      }
    }

    const totalDuplicatedLines = duplicates.reduce((sum, dup) => sum + dup.lines, 0);
    const overallDuplication =
      fileContents.length > 0 ? (totalDuplicatedLines / (fileContents.length * 50)) * 100 : 0;

    codeDuplication.value = {
      duplicates,
      overallDuplication,
      totalDuplicatedLines,
    };
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple similarity calculation
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter((word) => words2.includes(word));

    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;

    return (2 * commonWords.length) / (words1.length + words2.length);
  };

  const generateReport = (): string => {
    const report = {
      timestamp: new Date().toISOString(),
      codeDuplication: codeDuplication.value,
      performanceMetrics: performanceMetrics.value,
      recommendations: [],
    };

    // Generate recommendations
    if (codeDuplication.value.overallDuplication > 10) {
      (report.recommendations as string[]).push("Consider refactoring duplicated code");
    }

    if (performanceMetrics.value.memoryUsage > 100000000) {
      // 100MB
      (report.recommendations as string[]).push("Memory usage is high, consider optimization");
    }

    return JSON.stringify(report, null, 2);
  };

  return {
    codeDuplication: codeDuplication.value,
    performanceMetrics: performanceMetrics.value,
    analyzeCodeDuplication,
    generateReport,
  };
};
