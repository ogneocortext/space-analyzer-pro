import { jsPDF } from "jspdf";

interface AnalysisResult {
  totalFiles: number;
  totalSize: number;
  files: Array<{
    name: string;
    path: string;
    size: number;
    category: string;
    extension: string;
    modified: string;
  }>;
  categories: Record<string, { count: number; size: number }>;
  extensionStats: Record<string, { count: number; size: number }>;
  analysisTimeMs: number;
  directoryPath: string;
  duplicateCount?: number;
  duplicateSize?: number;
}

export function exportToPDF(data: AnalysisResult, filename?: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(33, 150, 243);
  doc.text("Space Analyzer Pro - Report", pageWidth / 2, y, { align: "center" });
  y += 15;

  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
  y += 20;

  // Directory info
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Scan Information", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Directory: ${data.directoryPath}`, margin, y);
  y += 6;
  doc.text(`Total Files: ${data.totalFiles.toLocaleString()}`, margin, y);
  y += 6;
  doc.text(`Total Size: ${formatBytes(data.totalSize)}`, margin, y);
  y += 6;
  doc.text(`Analysis Time: ${data.analysisTimeMs}ms`, margin, y);
  y += 15;

  // Duplicates section
  if (data.duplicateCount && data.duplicateCount > 0) {
    doc.setFontSize(14);
    doc.setTextColor(244, 67, 54);
    doc.text("Duplicate Files", margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Duplicate Files: ${data.duplicateCount.toLocaleString()}`, margin, y);
    y += 6;
    doc.text(`Wasted Space: ${formatBytes(data.duplicateSize || 0)}`, margin, y);
    y += 15;
  }

  // Categories section
  doc.setFontSize(14);
  doc.setTextColor(33, 150, 243);
  doc.text("Storage by Category", margin, y);
  y += 10;

  const sortedCategories = Object.entries(data.categories || {})
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  sortedCategories.forEach(([category, stats]) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.text(`${category}: ${stats.count.toLocaleString()} files (${formatBytes(stats.size)})`, margin, y);
    y += 6;
  });
  y += 10;

  // Extensions section
  if (y > 230) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(14);
  doc.setTextColor(33, 150, 243);
  doc.text("Top File Types", margin, y);
  y += 10;

  const sortedExtensions = Object.entries(data.extensionStats || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  sortedExtensions.forEach(([ext, stats]) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.text(`.${ext}: ${stats.count.toLocaleString()} files (${formatBytes(stats.size)})`, margin, y);
    y += 6;
  });
  y += 15;

  // Largest files section
  if (data.files && data.files.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(14);
    doc.setTextColor(244, 67, 54);
    doc.text("Largest Files (Top 20)", margin, y);
    y += 10;

    const sortedFiles = [...data.files]
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 20);

    doc.setFontSize(8);
    sortedFiles.forEach((file) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const name = file.name.length > 40 ? file.name.substring(0, 37) + "..." : file.name;
      doc.text(`${formatBytes(file.size).padStart(10)} | ${name}`, margin, y);
      y += 5;
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Space Analyzer Pro - Page ${i} of ${totalPages}`, pageWidth / 2, 285, { align: "center" });
  }

  // Save
  doc.save(filename || `space-analysis-report-${Date.now()}.pdf`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
