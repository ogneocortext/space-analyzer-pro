/**
 * Reports Routes Module
 * Handles PDF report generation, viewing, and download
 */

const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const PDFGenerator = require("../modules/pdf-generator");

class ReportsRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.pdfGenerator = new PDFGenerator();
    this.setupRoutes();
  }

  setupRoutes() {
    // Generate analysis PDF report
    this.router.post("/reports/analysis", async (req, res) => {
      try {
        const { analysisId, title, subtitle, includeFiles = true, fileLimit = 100 } = req.body;

        if (!analysisId) {
          return res.status(400).json({ error: "analysisId is required" });
        }

        // Get analysis data
        const analysisData = this.server.analysisResults.get(analysisId);
        if (!analysisData) {
          return res.status(404).json({ error: "Analysis not found" });
        }

        // Generate PDF
        const result = await this.pdfGenerator.generateAnalysisReport(analysisData, {
          title: title || "Space Analysis Report",
          subtitle: subtitle || `Analysis of ${analysisData.directory || "Unknown Directory"}`,
          includeFiles,
          fileLimit,
        });

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        res.json({
          success: true,
          report: {
            reportId: result.reportId,
            filename: result.filename,
            size: result.size,
            createdAt: result.createdAt,
            downloadUrl: result.downloadUrl,
            viewUrl: result.viewUrl,
          },
        });
      } catch (error) {
        console.error("Generate analysis report error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Generate complexity PDF report
    this.router.post("/reports/complexity", async (req, res) => {
      try {
        const { directory, title, fileLimit = 50 } = req.body;

        if (!directory) {
          return res.status(400).json({ error: "directory is required" });
        }

        // Get complexity data from database
        const metrics = await this.server.knowledgeDB.getDirectoryComplexity(directory);
        const summary = await this.server.knowledgeDB.getComplexitySummary(directory);

        if (!metrics || metrics.length === 0) {
          return res.status(404).json({ error: "No complexity data found for this directory" });
        }

        // Generate PDF
        const result = await this.pdfGenerator.generateComplexityReport(
          {
            directory,
            files: metrics,
            summary,
          },
          {
            title: title || "Code Complexity Analysis Report",
            fileLimit,
          }
        );

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        res.json({
          success: true,
          report: {
            reportId: result.reportId,
            filename: result.filename,
            size: result.size,
            createdAt: result.createdAt,
            downloadUrl: result.downloadUrl,
            viewUrl: result.viewUrl,
          },
        });
      } catch (error) {
        console.error("Generate complexity report error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Download PDF report
    this.router.get("/reports/download/:filename", async (req, res) => {
      try {
        const { filename } = req.params;
        const reportPath = path.join(this.pdfGenerator.reportsDir, filename);

        // Validate filename to prevent directory traversal
        if (!filename.endsWith(".pdf") || filename.includes("..") || filename.includes("/")) {
          return res.status(400).json({ error: "Invalid filename" });
        }

        // Check if file exists
        try {
          await fs.access(reportPath);
        } catch {
          return res.status(404).json({ error: "Report not found" });
        }

        // Set headers for download
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        // Stream the file
        const fileStream = require("fs").createReadStream(reportPath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Download report error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // View PDF report in browser
    this.router.get("/reports/view/:filename", async (req, res) => {
      try {
        const { filename } = req.params;
        const reportPath = path.join(this.pdfGenerator.reportsDir, filename);

        // Validate filename
        if (!filename.endsWith(".pdf") || filename.includes("..") || filename.includes("/")) {
          return res.status(400).json({ error: "Invalid filename" });
        }

        // Check if file exists
        try {
          await fs.access(reportPath);
        } catch {
          return res.status(404).json({ error: "Report not found" });
        }

        // Set headers for inline viewing
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

        // Stream the file
        const fileStream = require("fs").createReadStream(reportPath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("View report error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // List all generated reports with pagination
    this.router.get("/reports", async (req, res) => {
      try {
        const { page = 1, limit = 50 } = req.query;
        const result = await this.pdfGenerator.getReportsList({
          page: parseInt(page),
          limit: parseInt(limit),
        });

        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error("List reports error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Delete a specific report
    this.router.delete("/reports/:filename", async (req, res) => {
      try {
        const { filename } = req.params;
        const reportPath = path.join(this.pdfGenerator.reportsDir, filename);

        // Validate filename
        if (!filename.endsWith(".pdf") || filename.includes("..") || filename.includes("/")) {
          return res.status(400).json({ error: "Invalid filename" });
        }

        // Check if file exists
        try {
          await fs.access(reportPath);
        } catch {
          return res.status(404).json({ error: "Report not found" });
        }

        // Delete the file
        await fs.unlink(reportPath);

        res.json({
          success: true,
          message: `Report ${filename} deleted successfully`,
        });
      } catch (error) {
        console.error("Delete report error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Cleanup old reports
    this.router.post("/reports/cleanup", async (req, res) => {
      try {
        const { maxAgeDays = 7 } = req.body;

        const result = await this.pdfGenerator.cleanupOldReports(maxAgeDays);

        res.json({
          success: true,
          deleted: result.deleted,
          maxAgeDays,
        });
      } catch (error) {
        console.error("Cleanup reports error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get report preview/thumbnail (first page as PNG)
    this.router.get("/reports/preview/:filename", async (req, res) => {
      try {
        const { filename } = req.params;
        const reportPath = path.join(this.pdfGenerator.reportsDir, filename);

        // Validate filename
        if (!filename.endsWith(".pdf") || filename.includes("..") || filename.includes("/")) {
          return res.status(400).json({ error: "Invalid filename" });
        }

        // For now, return a placeholder response
        // In production, you could use pdf-poppler or similar to generate preview
        res.json({
          success: true,
          message: "PDF preview generation not yet implemented",
          viewUrl: `/api/reports/view/${filename}`,
        });
      } catch (error) {
        console.error("Preview report error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // ============================================================
    // Template Management Routes
    // ============================================================

    // Get all templates
    this.router.get("/reports/templates", async (req, res) => {
      try {
        const { type, active = "true" } = req.query;
        const templates = await this.server.knowledgeDB.getTemplates(
          type || null,
          active === "true"
        );

        res.json({
          success: true,
          templates,
          count: templates.length,
        });
      } catch (error) {
        console.error("Get templates error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get single template
    this.router.get("/reports/templates/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const template = await this.server.knowledgeDB.getTemplateById(parseInt(id));

        if (!template) {
          return res.status(404).json({ error: "Template not found" });
        }

        res.json({
          success: true,
          template,
        });
      } catch (error) {
        console.error("Get template error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Create template
    this.router.post("/reports/templates", async (req, res) => {
      try {
        const template = req.body;

        // Validation
        if (!template.templateName || !template.templateType) {
          return res.status(400).json({
            error: "templateName and templateType are required",
          });
        }

        const result = await this.server.knowledgeDB.createTemplate(template);

        res.json({
          success: true,
          template: result,
        });
      } catch (error) {
        console.error("Create template error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Update template
    this.router.put("/reports/templates/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        const result = await this.server.knowledgeDB.updateTemplate(parseInt(id), updates);

        if (!result.updated) {
          return res.status(404).json({ error: "Template not found" });
        }

        res.json({
          success: true,
          updated: result.updated,
        });
      } catch (error) {
        console.error("Update template error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Delete template
    this.router.delete("/reports/templates/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await this.server.knowledgeDB.deleteTemplate(parseInt(id));

        if (!result.deleted) {
          return res.status(404).json({ error: "Template not found" });
        }

        res.json({
          success: true,
          deleted: result.deleted,
        });
      } catch (error) {
        console.error("Delete template error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Set default template
    this.router.post("/reports/templates/:id/default", async (req, res) => {
      try {
        const { id } = req.params;
        const { templateType } = req.body;

        if (!templateType) {
          return res.status(400).json({ error: "templateType is required" });
        }

        const result = await this.server.knowledgeDB.setDefaultTemplate(parseInt(id), templateType);

        res.json({
          success: true,
          updated: result.updated,
        });
      } catch (error) {
        console.error("Set default template error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Duplicate template
    this.router.post("/reports/templates/:id/duplicate", async (req, res) => {
      try {
        const { id } = req.params;
        const { newName } = req.body;

        const result = await this.server.knowledgeDB.duplicateTemplate(parseInt(id), newName);

        res.json({
          success: true,
          template: result,
        });
      } catch (error) {
        console.error("Duplicate template error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // ============================================================
    // Batch Export Routes
    // ============================================================

    // Create batch export job
    this.router.post("/reports/batch", async (req, res) => {
      try {
        const { jobName, jobType, analysisIds, exportOptions } = req.body;

        if (!jobType || !analysisIds || !Array.isArray(analysisIds)) {
          return res.status(400).json({
            error: "jobType and analysisIds array are required",
          });
        }

        // Insert job into database
        const sql = `
          INSERT INTO batch_export_jobs
          (job_name, job_type, status, analysis_ids, export_options, total_items, created_at)
          VALUES (?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const jobId = await new Promise((resolve, reject) => {
          this.server.knowledgeDB.db.run(
            sql,
            [
              jobName || `Batch Export ${new Date().toISOString()}`,
              jobType,
              JSON.stringify(analysisIds),
              JSON.stringify(exportOptions || {}),
              analysisIds.length,
            ],
            function (err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

        res.json({
          success: true,
          job: {
            id: jobId,
            status: "pending",
            totalItems: analysisIds.length,
          },
        });

        // Start processing (async)
        this.processBatchJob(jobId, analysisIds, jobType, exportOptions);
      } catch (error) {
        console.error("Create batch job error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get batch jobs
    this.router.get("/reports/batch", async (req, res) => {
      try {
        const { status, limit = 50 } = req.query;

        let sql = `SELECT * FROM batch_export_jobs`;
        const params = [];

        if (status) {
          sql += ` WHERE status = ?`;
          params.push(status);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(parseInt(limit));

        const jobs = await new Promise((resolve, reject) => {
          this.server.knowledgeDB.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else {
              // Parse JSON fields
              rows.forEach((row) => {
                try {
                  if (row.analysis_ids) row.analysis_ids = JSON.parse(row.analysis_ids);
                  if (row.export_options) row.export_options = JSON.parse(row.export_options);
                  if (row.output_files) row.output_files = JSON.parse(row.output_files);
                } catch (e) {
                  // Keep as strings if parsing fails
                }
              });
              resolve(rows);
            }
          });
        });

        res.json({
          success: true,
          jobs,
          count: jobs.length,
        });
      } catch (error) {
        console.error("Get batch jobs error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get single batch job
    this.router.get("/reports/batch/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const job = await new Promise((resolve, reject) => {
          this.server.knowledgeDB.db.get(
            `SELECT * FROM batch_export_jobs WHERE id = ?`,
            [parseInt(id)],
            (err, row) => {
              if (err) reject(err);
              else {
                if (row) {
                  try {
                    if (row.analysis_ids) row.analysis_ids = JSON.parse(row.analysis_ids);
                    if (row.export_options) row.export_options = JSON.parse(row.export_options);
                    if (row.output_files) row.output_files = JSON.parse(row.output_files);
                  } catch (e) {
                    // Keep as strings if parsing fails
                  }
                }
                resolve(row);
              }
            }
          );
        });

        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }

        res.json({
          success: true,
          job,
        });
      } catch (error) {
        console.error("Get batch job error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Cancel batch job
    this.router.delete("/reports/batch/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // Only allow cancelling pending or processing jobs
        const result = await new Promise((resolve, reject) => {
          this.server.knowledgeDB.db.run(
            `UPDATE batch_export_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status IN ('pending', 'processing')`,
            [parseInt(id)],
            function (err) {
              if (err) reject(err);
              else resolve({ updated: this.changes > 0 });
            }
          );
        });

        if (!result.updated) {
          return res.status(400).json({
            error: "Job not found or cannot be cancelled (already completed/failed)",
          });
        }

        res.json({
          success: true,
          message: "Job cancelled",
        });
      } catch (error) {
        console.error("Cancel batch job error:", error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  // Process batch job asynchronously
  async processBatchJob(jobId, analysisIds, jobType, exportOptions) {
    try {
      // Update status to processing
      await new Promise((resolve, reject) => {
        this.server.knowledgeDB.db.run(
          `UPDATE batch_export_jobs SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [jobId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const outputFiles = [];
      let processed = 0;

      for (const analysisId of analysisIds) {
        const analysisData = this.server.analysisResults.get(analysisId);
        if (!analysisData) continue;

        try {
          let result;
          if (jobType === "pdf") {
            result = await this.pdfGenerator.generateAnalysisReport(analysisData, exportOptions);
          }
          // Add more job types (csv, json) here

          if (result && result.success) {
            outputFiles.push(result.pdfPath);
          }

          processed++;

          // Update progress
          await new Promise((resolve, reject) => {
            this.server.knowledgeDB.db.run(
              `UPDATE batch_export_jobs SET processed_items = ? WHERE id = ?`,
              [processed, jobId],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        } catch (err) {
          console.error(`Error processing analysis ${analysisId}:`, err);
        }
      }

      // Mark as completed
      await new Promise((resolve, reject) => {
        this.server.knowledgeDB.db.run(
          `UPDATE batch_export_jobs
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, output_files = ?
           WHERE id = ?`,
          [JSON.stringify(outputFiles), jobId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log(`✅ Batch job ${jobId} completed: ${outputFiles.length} files generated`);
    } catch (error) {
      console.error(`❌ Batch job ${jobId} failed:`, error);

      // Mark as failed
      await new Promise((resolve) => {
        this.server.knowledgeDB.db.run(
          `UPDATE batch_export_jobs
           SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_message = ?
           WHERE id = ?`,
          [error.message, jobId],
          () => resolve()
        );
      });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = ReportsRoutes;
