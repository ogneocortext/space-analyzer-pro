/* eslint-disable @typescript-eslint/no-unused-vars */

import { AnalysisResult } from "./AnalysisBridge";

export class ExportService {
  /**
   * Export analysis results to CSV format
   */
  static exportToCSV(data: AnalysisResult, filename?: string): void {
    if (!data.files || data.files.length === 0) {
      console.warn("No files to export");
      return;
    }

    // Build CSV content
    const headers = [
      "Name",
      "Size (bytes)",
      "Size (KB)",
      "Size (MB)",
      "Extension",
      "Category",
      "Path",
    ];
    const rows = data.files.map((file) => [
      file.name,
      file.size.toString(),
      (file.size / 1024).toFixed(2),
      (file.size / 1024 / 1024).toFixed(4),
      file.extension,
      file.category,
      file.path,
    ]);

    // Add summary section
    const summary = [
      "",
      "--- SUMMARY ---",
      "",
      "Total Files",
      data.totalFiles.toString(),
      "Total Size (bytes)",
      data.totalSize.toString(),
      "Total Size (GB)",
      (data.totalSize / 1024 / 1024 / 1024).toFixed(4),
      "Analysis Type",
      data.analysisType || "Unknown",
    ];

    // Add category breakdown
    if (data.categories) {
      summary.push("", "--- CATEGORIES ---");
      Object.entries(data.categories).forEach(([cat, info]) => {
        summary.push(cat, info.count.toString(), (info.size / 1024 / 1024).toFixed(2) + " MB");
      });
    }

    // Add extension breakdown
    if (data.extensionStats) {
      summary.push("", "--- EXTENSIONS ---");
      Object.entries(data.extensionStats).forEach(([ext, info]) => {
        summary.push(ext, info.count.toString(), (info.size / 1024 / 1024).toFixed(2) + " MB");
      });
    }

    // Add AI insights if available
    if (data.ai_insights) {
      summary.push("", "--- AI INSIGHTS ---");

      if (data.ai_insights.large_files?.length > 0) {
        summary.push("Large Files:", ...data.ai_insights.large_files.slice(0, 10));
      }

      if (data.ai_insights.optimization_suggestions?.length > 0) {
        summary.push("Optimization Suggestions:", ...data.ai_insights.optimization_suggestions);
      }
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ...summary,
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename || `space-analysis-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export analysis results to JSON format
   */
  static exportToJSON(data: AnalysisResult, filename?: string): void {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename || `space-analysis-${Date.now()}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export analysis results to PDF format
   */
  static exportToPDF(data: AnalysisResult, filename?: string): void {
    if (!data.files || data.files.length === 0) {
      console.warn("No files to export");
      return;
    }

    // Create PDF content using browser print functionality
    const printContent = this.generatePrintContent(data);
    const printWindow = window.open("", "", "width=800,height=600");

    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  }

  /**
   * Export analysis results to Excel format
   */
  static exportToExcel(data: AnalysisResult, filename?: string): void {
    if (!data.files || data.files.length === 0) {
      console.warn("No files to export");
      return;
    }

    // Create Excel-compatible CSV with enhanced formatting
    const headers = [
      "File Name",
      "Size (Bytes)",
      "Size (KB)",
      "Size (MB)",
      "Extension",
      "Category",
      "Path",
      "Created Date",
      "Modified Date",
    ];

    const rows = data.files.map((file) => [
      file.name,
      file.size.toString(),
      (file.size / 1024).toFixed(2),
      (file.size / 1024 / 1024).toFixed(4),
      file.extension,
      file.category,
      file.path,
      new Date(file.created || Date.now()).toLocaleDateString(),
      new Date(file.modified || Date.now()).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ...this.generateExcelSummary(data),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename || `space-analysis-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate print-friendly content for PDF export
   */
  private static generatePrintContent(data: AnalysisResult): string {
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f; font-weight: bold; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      </style>
    `;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Space Analysis Report</title>
        ${styles}
      </head>
      <body>
        <h1>Space Analyzer Pro - Analysis Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>

        <div class="summary">
          <h2>Summary</h2>
          <p><strong>Total Files:</strong> ${data.totalFiles.toLocaleString()}</p>
          <p><strong>Total Size:</strong> ${(data.totalSize / 1024 / 1024 / 1024).toFixed(4)} GB</p>
          <p><strong>Analysis Type:</strong> ${data.analysisType || "Unknown"}</p>
        </div>

        <h2>File Details</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Extension</th>
              <th>Category</th>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            ${data.files
              .slice(0, 50)
              .map(
                (file) => `
              <tr>
                <td>${file.name}</td>
                <td>${(file.size / 1024 / 1024).toFixed(2)} MB</td>
                <td>${file.extension}</td>
                <td>${file.category}</td>
                <td>${file.path}</td>
              </tr>
            `
              )
              .join("")}
            ${data.files.length > 50 ? `<tr><td colspan="5">... and ${data.files.length - 50} more files</td></tr>` : ""}
          </tbody>
        </table>

        ${this.generateCategoriesSection(data)}
        ${this.generateExtensionsSection(data)}

        ${data.ai_insights ? this.generateAIInsightsSection(data.ai_insights) : ""}
      </body>
      </html>
    `;

    return content;
  }

  /**
   * Generate Excel-specific summary section
   */
  private static generateExcelSummary(data: AnalysisResult): string[] {
    const summary = [
      "",
      "--- EXCEL SUMMARY ---",
      "",
      "Total Files",
      data.totalFiles.toString(),
      "Total Size (Bytes)",
      data.totalSize.toString(),
      "Total Size (KB)",
      (data.totalSize / 1024).toFixed(2),
      "Total Size (MB)",
      (data.totalSize / 1024 / 1024).toFixed(4),
      "Analysis Type",
      data.analysisType || "Unknown",
      "Generated Date",
      new Date().toLocaleDateString(),
    ];

    if (data.categories) {
      summary.push("", "--- CATEGORIES ---");
      Object.entries(data.categories).forEach(([cat, info]) => {
        summary.push(cat, info.count.toString(), (info.size / 1024 / 1024).toFixed(2) + " MB");
      });
    }

    return summary;
  }

  /**
   * Export analysis results to formatted text report
   */
  static exportToTextReport(data: AnalysisResult, filename?: string): void {
    const lines: string[] = [];

    lines.push("═".repeat(60));
    lines.push("           SPACE ANALYZER PRO - ANALYSIS REPORT");
    lines.push("═".repeat(60));
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Analysis Type: ${data.analysisType || "Unknown"}`);
    if (data.analysisTime) {
      lines.push(`Analysis Time: ${data.analysisTime}ms`);
    }
    lines.push("");
    lines.push("─".repeat(60));
    lines.push("                        SUMMARY");
    lines.push("─".repeat(60));
    lines.push(`Total Files:     ${data.totalFiles.toLocaleString()}`);
    lines.push(`Total Size:      ${(data.totalSize / 1024 / 1024 / 1024).toFixed(4)} GB`);
    lines.push("");

    // Categories
    if (data.categories) {
      lines.push("─".repeat(60));
      lines.push("                     CATEGORIES");
      lines.push("─".repeat(60));

      const sortedCategories = Object.entries(data.categories).sort(
        (a, b) => b[1].size - a[1].size
      );

      for (const [category, info] of sortedCategories) {
        const sizeMB = (info.size / 1024 / 1024).toFixed(2);
        lines.push(
          `${category.padEnd(20)} ${info.count.toString().padStart(8)} files  ${sizeMB.padStart(12)} MB`
        );
      }
      lines.push("");
    }

    // Extensions
    if (data.extensionStats) {
      lines.push("─".repeat(60));
      lines.push("                     EXTENSIONS");
      lines.push("─".repeat(60));

      const sortedExtensions = Object.entries(data.extensionStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20);

      for (const [ext, info] of sortedExtensions) {
        const sizeMB = (info.size / 1024 / 1024).toFixed(2);
        lines.push(
          `.${ext.padEnd(10)} ${info.count.toString().padStart(8)} files  ${sizeMB.padStart(12)} MB`
        );
      }
      lines.push("");
    }

    // AI Insights
    if (data.ai_insights) {
      lines.push("─".repeat(60));
      lines.push("                    AI INSIGHTS");
      lines.push("─".repeat(60));

      if (data.ai_insights.large_files?.length > 0) {
        lines.push("");
        lines.push("⚠️  LARGE FILES (>10MB):");
        for (const file of data.ai_insights.large_files.slice(0, 5)) {
          lines.push(`   • ${file}`);
        }
      }

      if (data.ai_insights.optimization_suggestions?.length > 0) {
        lines.push("");
        lines.push("💡 OPTIMIZATION SUGGESTIONS:");
        for (const suggestion of data.ai_insights.optimization_suggestions) {
          lines.push(`   • ${suggestion}`);
        }
      }

      if (data.ai_insights.potential_duplicates?.length > 0) {
        lines.push("");
        lines.push("📋 POTENTIAL DUPLICATES:");
        for (const file of data.ai_insights.potential_duplicates.slice(0, 5)) {
          lines.push(`   • ${file}`);
        }
      }

      lines.push("");
    }

    // File listing (limited)
    if (data.files && data.files.length > 0) {
      lines.push("─".repeat(60));
      lines.push("                   TOP FILES (by size)");
      lines.push("─".repeat(60));

      const sortedFiles = [...data.files].sort((a, b) => b.size - a.size).slice(0, 50);

      for (const file of sortedFiles) {
        const sizeKB = (file.size / 1024).toFixed(1);
        const name = file.name.length > 40 ? file.name.substring(0, 37) + "..." : file.name;
        lines.push(`${sizeKB.padStart(10)} KB  ${name}`);
      }
    }

    lines.push("");
    lines.push("═".repeat(60));
    lines.push("              Report generated by Space Analyzer Pro");
    lines.push("═".repeat(60));

    const textContent = lines.join("\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename || `space-analysis-report-${Date.now()}.txt`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export selected files to a ZIP-like structure (creates a manifest)
   * Note: Actual file compression would require a library like JSZip
   */
  static exportFileManifest(
    files: Array<{ name: string; path: string; size: number }>,
    filename?: string
  ): void {
    const manifest = {
      exportedAt: new Date().toISOString(),
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      files: files.map((f) => ({
        name: f.name,
        path: f.path,
        size: f.size,
        sizeFormatted:
          f.size < 1024
            ? `${f.size} B`
            : f.size < 1024 * 1024
              ? `${(f.size / 1024).toFixed(1)} KB`
              : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      })),
    };

    const jsonContent = JSON.stringify(manifest, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename || `file-manifest-${Date.now()}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Export format options
export type ExportFormat = "csv" | "json" | "txt" | "manifest" | "pdf" | "excel";

// Main export function
export function exportAnalysis(
  data: AnalysisResult,
  format: ExportFormat,
  selectedFiles?: Array<{ name: string; path: string; size: number }>
): void {
  const timestamp = Date.now();

  switch (format) {
    case "csv":
      ExportService.exportToCSV(data, `space-analysis-${timestamp}.csv`);
      break;
    case "json":
      ExportService.exportToJSON(data, `space-analysis-${timestamp}.json`);
      break;
    case "txt":
      ExportService.exportToTextReport(data, `space-analysis-report-${timestamp}.txt`);
      break;
    case "manifest":
      if (selectedFiles) {
        ExportService.exportFileManifest(selectedFiles, `file-manifest-${timestamp}.json`);
      }
      break;
    case "pdf":
      ExportService.exportToPDF(data, `space-analysis-report-${timestamp}.pdf`);
      break;
    case "excel":
      ExportService.exportToExcel(data, `space-analysis-${timestamp}.csv`);
      break;
    default:
      console.warn(`Unknown export format: ${format}`);
  }
}

export const exportService = ExportService;
