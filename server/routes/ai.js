/**
 * AI Routes Module
 * Handles AI insights, summarization, natural language queries, and cleanup assistant
 */

const express = require("express");
const crypto = require("crypto");

class AIRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // AI Insights endpoint
    this.router.post("/ai/insights", async (req, res) => {
      const startTime = Date.now();
      try {
        const { analysisData, query } = req.body;

        if (!analysisData) {
          return res.status(400).json({ error: "Analysis data is required" });
        }

        // Use EnhancedOllamaService for insights
        const response = await this.server.ollamaService.generate(
          this.buildInsightsPrompt(await this.buildAnalysisContext(analysisData), query),
          null, // auto-select model
          { temperature: 0.3 }
        );

        res.json({
          success: true,
          insights: response.response,
          query,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("AI insights error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // AI File Summarization
    this.router.post("/ai/summarize", async (req, res) => {
      const startTime = Date.now();
      try {
        const { filePath, maxChars = 5000, model = "phi4-mini:latest" } = req.body;

        if (!filePath) {
          return res.status(400).json({ error: "filePath is required" });
        }

        // Validate file path
        if (!this.server.isValidPath(filePath)) {
          return res.status(400).json({ error: "Invalid file path" });
        }

        // Check if file exists
        const fs = require("fs");
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "File not found" });
        }

        // Get file stats for hash
        const stats = fs.statSync(filePath);
        const fileHash = crypto
          .createHash("md5")
          .update(`${filePath}:${stats.size}:${stats.mtime.getTime()}`)
          .digest("hex");

        // Check cache
        let cached = null;
        if (this.server.knowledgeDB) {
          cached = await this.server.knowledgeDB.getFileSummary(filePath, fileHash);
        }
        if (cached) {
          return res.json({
            success: true,
            summary: cached.summary_text,
            filePath,
            fileType: cached.file_type,
            modelUsed: cached.model_used,
            tokensUsed: cached.tokens_used,
            cached: true,
            responseTime: Date.now() - startTime,
          });
        }

        // Extract text based on file type
        const TextExtractor = require("../modules/text-extractor");
        const extractor = new TextExtractor();
        const extracted = await extractor.extractText(filePath, maxChars);

        if (!extracted.text || extracted.text.length < 50) {
          return res.status(400).json({
            error: "Could not extract sufficient text from file",
            fileType: extracted.type,
          });
        }

        // Build prompt based on file type
        const prompt = this.buildSummaryPrompt(extracted.text, extracted.type);

        // Query Ollama using EnhancedOllamaService
        const result = await this.server.ollamaService.generate(prompt, model, {
          temperature: 0.3,
          num_predict: 500,
        });

        const summary = result.response || "";

        // Cache the summary
        if (this.server.knowledgeDB) {
          await this.server.knowledgeDB.storeFileSummary(
            filePath,
            fileHash,
            stats.size,
            extracted.type,
            summary,
            extracted.text.substring(0, 500),
            model,
            result.eval_count || 0
          );
        }

        res.json({
          success: true,
          summary,
          filePath,
          fileType: extracted.type,
          modelUsed: model,
          tokensUsed: result.eval_count || 0,
          cached: false,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("Summarization error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Natural Language File Search
    this.router.post("/ai/nl-query", async (req, res) => {
      const startTime = Date.now();
      try {
        const { query, analysisId } = req.body;

        if (!query) {
          return res.status(400).json({ error: "Query is required" });
        }

        // Get analysis data
        const analysisData = analysisId
          ? this.server.analysisResults.get(analysisId)
          : Array.from(this.server.analysisResults.values())[0];

        if (!analysisData || !analysisData.files) {
          return res.status(400).json({
            error: "No analysis data available. Please scan a directory first.",
          });
        }

        // Parse natural language query with Ollama
        const parsedQuery = await this.parseNaturalLanguageQuery(query);

        // Execute query against file data
        const results = this.executeFileQuery(analysisData.files, parsedQuery);

        res.json({
          success: true,
          query,
          parsedQuery,
          results: results.slice(0, 100),
          resultCount: results.length,
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("Natural language query error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Cleanup Assistant - Generate recommendations
    this.router.post("/ai/cleanup/analyze", async (req, res) => {
      const startTime = Date.now();
      try {
        const { directory, analysisId, targetSavings } = req.body;

        if (!directory && !analysisId) {
          return res.status(400).json({ error: "Directory or analysisId is required" });
        }

        // Get analysis data
        const analysisData = analysisId
          ? this.server.analysisResults.get(analysisId)
          : Array.from(this.server.analysisResults.values()).find((a) => a.directory === directory);

        if (!analysisData || !analysisData.files) {
          return res.status(400).json({ error: "No analysis data found" });
        }

        // Analyze files with Ollama for cleanup recommendations
        const recommendations = await this.generateCleanupRecommendations(
          analysisData,
          targetSavings
        );

        // Store recommendations in database
        if (this.server.knowledgeDB) {
          for (const rec of recommendations) {
            await this.server.knowledgeDB.storeCleanupRecommendation(
              directory || analysisData.directory,
              rec.filePath,
              rec.fileSize,
              rec.type,
              rec.confidence,
              rec.reasoning,
              rec.potentialSavings,
              rec.safeToDelete
            );
          }
        }

        // Get potential savings summary
        const savings = this.server.knowledgeDB
          ? await this.server.knowledgeDB.getPotentialSavings(directory || analysisData.directory)
          : { totalPotentialSavings: 0, fileCount: 0 };

        res.json({
          success: true,
          directory: directory || analysisData.directory,
          recommendationsGenerated: recommendations.length,
          potentialSavings: savings,
          topRecommendations: recommendations.slice(0, 10),
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("Cleanup analysis error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });

    // Get cleanup recommendations
    this.router.get("/ai/cleanup/recommendations", async (req, res) => {
      try {
        const { directory, type, limit = 50 } = req.query;

        if (!directory) {
          return res.status(400).json({ error: "Directory is required" });
        }

        // Validate directory path
        if (!this.server.isValidPath(directory)) {
          return res.status(400).json({ error: "Invalid directory path" });
        }

        const parsedLimit = parseInt(limit);
        const safeLimit = Number.isNaN(parsedLimit) ? 50 : Math.max(1, Math.min(1000, parsedLimit));

        const recommendations = this.server.knowledgeDB
          ? await this.server.knowledgeDB.getCleanupRecommendations(
              directory,
              safeLimit,
              type || null
            )
          : [];

        const savings = this.server.knowledgeDB
          ? await this.server.knowledgeDB.getPotentialSavings(directory)
          : { totalPotentialSavings: 0, fileCount: 0 };

        res.json({
          success: true,
          directory,
          recommendations,
          potentialSavings: savings,
          count: recommendations.length,
        });
      } catch (error) {
        console.error("Get recommendations error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Update recommendation action (approve/reject)
    this.router.post("/ai/cleanup/action", async (req, res) => {
      try {
        const { filePath, action } = req.body;

        if (!filePath || !action) {
          return res.status(400).json({ error: "filePath and action are required" });
        }

        if (!["approved", "rejected", "completed"].includes(action)) {
          return res
            .status(400)
            .json({ error: "Invalid action. Use: approved, rejected, completed" });
        }

        const changes = this.server.knowledgeDB
          ? await this.server.knowledgeDB.updateCleanupAction(filePath, action)
          : 0;

        res.json({
          success: true,
          filePath,
          action,
          updated: changes > 0,
        });
      } catch (error) {
        console.error("Update action error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // AI QA Endpoint
    this.router.post("/ai-models/qa", async (req, res) => {
      const startTime = Date.now();
      try {
        const { question, directory, analysisId } = req.body;

        // Check cache
        let cached = null;
        let contextHash = crypto
          .createHash("md5")
          .update(analysisId || directory || "general")
          .digest("hex");

        if (this.server.knowledgeDB) {
          contextHash = this.server.knowledgeDB.generateHash(analysisId || directory || "general");
          cached = await this.server.knowledgeDB.findSimilarResponse(question, contextHash);
        }

        if (cached) {
          return res.json({
            success: true,
            answer: cached.answer,
            model: cached.model_used,
            cached: true,
            cacheHits: cached.hit_count,
            intent: "qa_response",
            confidence: 0.95,
            sources: ["cache"],
          });
        }

        // Build context and query Ollama
        const context = await this.buildQAContext(directory, analysisId);
        const prompt = this.buildQAPrompt(context, question);
        const response = await this.queryOllama(prompt);

        // Cache response
        if (this.server.knowledgeDB) {
          await this.server.knowledgeDB.storeResponse(question, response, contextHash, "qa");
        }

        res.json({
          success: true,
          answer: response,
          model: this.server.currentModel,
          cached: false,
          intent: "qa_response",
          confidence: 0.85,
          sources: ["ollama"],
          responseTime: Date.now() - startTime,
        });
      } catch (error) {
        console.error("QA error:", error);
        res.status(500).json({
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      }
    });
  }

  // Helper methods
  async buildAnalysisContext(analysisData) {
    return {
      totalFiles: analysisData.files?.length || 0,
      totalSize: analysisData.totalSize || 0,
      categories: analysisData.categories || {},
      topExtensions: analysisData.extensions
        ? Object.entries(analysisData.extensions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        : [],
    };
  }

  buildInsightsPrompt(context, query) {
    return `Analyze this directory data and provide insights:

Directory Stats:
- Total Files: ${context.totalFiles}
- Total Size: ${context.totalSize} bytes
- Categories: ${JSON.stringify(context.categories)}
- Top Extensions: ${JSON.stringify(context.topExtensions)}

${query ? `User Question: ${query}` : "Provide general insights and recommendations."}

Respond with a JSON object containing:
{
  "summary": "brief overview",
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["action 1", "action 2"],
  "spaceOptimization": "specific advice"
}`;
  }

  buildSummaryPrompt(text, fileType) {
    const prompts = {
      document: `Summarize this document in 2-3 sentences. Focus on the main topic and key points:

${text.substring(0, 4000)}

Summary:`,
      code: `Explain what this code does in 2-3 sentences. Focus on the main functionality:

${text.substring(0, 4000)}

Explanation:`,
      data: `Describe this data structure and its purpose in 2-3 sentences:

${text.substring(0, 4000)}

Description:`,
      web: `Summarize the content of this HTML page in 2-3 sentences:

${text.substring(0, 4000)}

Summary:`,
    };

    return prompts[fileType] || prompts.document;
  }

  async queryOllama(prompt, model) {
    const result = await this.server.ollamaService.generate(prompt, model);
    return result.response || "";
  }

  async parseNaturalLanguageQuery(userQuery) {
    const prompt = `Parse this natural language file query into structured filters.
Available file properties: name, path, size, extension, category, modified date

Examples:
"Find videos from 2023 larger than 500MB"
→ {"extensions": ["mp4", "avi", "mov"], "dateFrom": "2023-01-01", "dateTo": "2023-12-31", "minSize": 524288000}

"Show old documents not opened in 2 years"
→ {"categories": ["Documents"], "lastAccessedBefore": "2 years ago"}

"Big code files over 10MB"
→ {"categories": ["Code"], "minSize": 10485760}

Now parse this query: "${userQuery}"

Respond ONLY with JSON object containing these optional fields:
- extensions: array of file extensions
- categories: array of categories
- minSize: size in bytes
- maxSize: size in bytes
- dateFrom: YYYY-MM-DD
- dateTo: YYYY-MM-DD
- lastAccessedBefore: relative time like "6 months ago"
- nameContains: substring to search in filename

JSON response:`;

    try {
      const result = await this.server.ollamaService.generate(prompt, "phi4-mini:latest", {
        temperature: 0.1,
        num_predict: 200,
      });

      const text = result.response || "";

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { nameContains: userQuery };
    } catch (err) {
      return { nameContains: userQuery };
    }
  }

  executeFileQuery(files, query) {
    return files
      .filter((file) => {
        // Extension filter
        if (query.extensions && query.extensions.length > 0) {
          const ext = file.name?.split(".").pop()?.toLowerCase();
          if (!query.extensions.includes(ext)) return false;
        }

        // Category filter
        if (query.categories && query.categories.length > 0) {
          if (!query.categories.includes(file.category)) return false;
        }

        // Size filters
        if (query.minSize && file.size < query.minSize) return false;
        if (query.maxSize && file.size > query.maxSize) return false;

        // Name contains
        if (query.nameContains) {
          const search = query.nameContains.toLowerCase();
          if (
            !file.name?.toLowerCase().includes(search) &&
            !file.path?.toLowerCase().includes(search)
          )
            return false;
        }

        return true;
      })
      .sort((a, b) => b.size - a.size);
  }

  async generateCleanupRecommendations(analysisData, targetSavings) {
    const recommendations = [];
    const files = analysisData.files || [];

    // Heuristic-based pre-filtering
    const candidateFiles = this.identifyCleanupCandidates(files, targetSavings);
    const topCandidates = candidateFiles.slice(0, 20);

    for (const file of topCandidates) {
      try {
        const prompt = `Evaluate this file for safe deletion. Consider:
1. Is it a temporary/cache file?
2. Is it a duplicate or old version?
3. Is it safe to delete without breaking anything?

File: ${file.name}
Path: ${file.path}
Size: ${file.size} bytes
Category: ${file.category}

Respond with JSON:
{
  "safeToDelete": true/false,
  "confidence": 0.0-1.0,
  "type": "safe_to_delete|review|archive|duplicate",
  "reasoning": "brief explanation",
  "potentialSavings": ${file.size}
}`;

        const result = await this.server.ollamaService.generate(prompt, "phi4-mini:latest", {
          temperature: 0.1,
          num_predict: 200,
        });

        const text = result.response || "";

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          recommendations.push({
            filePath: file.path,
            fileSize: file.size,
            type: result.type || "review",
            confidence: result.confidence || 0.5,
            reasoning: result.reasoning || "No specific reasoning provided",
            potentialSavings: result.potentialSavings || file.size,
            safeToDelete: result.safeToDelete || false,
          });
        }
      } catch (err) {
        continue;
      }
    }

    return recommendations.sort((a, b) => {
      const scoreA = a.confidence * a.potentialSavings;
      const scoreB = b.confidence * b.potentialSavings;
      return scoreB - scoreA;
    });
  }

  identifyCleanupCandidates(files, targetSavings) {
    const candidates = [];
    const commonTempPatterns = [".tmp", ".temp", ".cache", ".log", ".bak", "~", ".old"];
    const largeThreshold = 100 * 1024 * 1024;

    for (const file of files) {
      let score = 0;

      if (file.size > largeThreshold) score += 3;
      else if (file.size > 10 * 1024 * 1024) score += 2;
      else if (file.size > 1024 * 1024) score += 1;

      const name = file.name?.toLowerCase() || "";
      if (commonTempPatterns.some((p) => name.includes(p))) score += 2;

      const path = file.path?.toLowerCase() || "";
      if (path.includes("temp") || path.includes("cache") || path.includes("tmp")) score += 2;

      if (name.match(/\(\d+\)/) || name.match(/copy/)) score += 1;

      if (score > 0) {
        candidates.push({ ...file, cleanupScore: score });
      }
    }

    return candidates.sort((a, b) => {
      if (b.cleanupScore !== a.cleanupScore) return b.cleanupScore - a.cleanupScore;
      return b.size - a.size;
    });
  }

  async buildQAContext(directory, analysisId) {
    const analysis = analysisId
      ? this.server.analysisResults.get(analysisId)
      : Array.from(this.server.analysisResults.values()).find((a) => a.directory === directory);

    return analysis || {};
  }

  buildQAPrompt(context, question) {
    return `Context: ${JSON.stringify(context)}

Question: ${question}

Provide a helpful, concise answer based on the context. If the context is insufficient, say so.`;
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AIRoutes;
