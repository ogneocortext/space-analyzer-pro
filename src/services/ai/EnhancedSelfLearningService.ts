/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Enhanced Self-Learning Service with Real-Time Incremental Learning
// Integrates with existing analysis services for continuous model improvement

import { EventEmitter } from "events";
import { SelfLearningMLService } from "./SelfLearningMLService";

interface AnalysisResult {
  id: string;
  timestamp: number;
  type: "complexity" | "refactoring" | "dependency" | "performance" | "code-smell";
  filePath: string;
  language: string;
  results: any;
  confidence: number;
  metadata: {
    analysisTime: number;
    modelUsed: string;
    version: string;
  };
}

interface LearningTrigger {
  type: "file-change" | "analysis-complete" | "user-feedback" | "schedule" | "threshold";
  condition: any;
  action: string;
  priority: "low" | "medium" | "high" | "critical";
}

interface IncrementalLearningConfig {
  autoTrain: boolean;
  triggerThreshold: number;
  minSamplesForRetraining: number;
  maxRetrainingFrequency: number; // minutes
  feedbackWeight: number;
  forgettingRate: number;
  knowledgeRetention: number;
  adaptiveLearning: boolean;
  threshold?: number;
}

interface ModelPerformance {
  modelName: string;
  accuracy: number;
  confidence: number;
  predictionTime: number;
  lastUpdated: number;
  improvementRate: number;
  userFeedback: {
    positive: number;
    negative: number;
    total: number;
  };
}

export class EnhancedSelfLearningService extends EventEmitter {
  private mlService: SelfLearningMLService;
  private analysisResults: Map<string, AnalysisResult[]> = new Map();
  private learningTriggers: LearningTrigger[] = [];
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private config: IncrementalLearningConfig;
  private isLearning: boolean = false;
  private lastRetrainingTime: number = 0;
  private feedbackBuffer: any[] = [];
  private performanceHistory: any[] = [];

  constructor(config: Partial<IncrementalLearningConfig> = {}) {
    super();

    this.config = {
      autoTrain: true,
      triggerThreshold: 10,
      minSamplesForRetraining: 50,
      maxRetrainingFrequency: 30, // 30 minutes
      feedbackWeight: 0.3,
      forgettingRate: 0.1,
      knowledgeRetention: 0.9,
      adaptiveLearning: true,
      ...config,
    };

    this.mlService = new SelfLearningMLService();
    this.initializeTriggers();
    this.setupEventListeners();

    console.warn("🧠 Enhanced Self-Learning Service initialized");
  }

  // Initialize learning triggers
  private initializeTriggers(): void {
    console.warn("🔧 Initializing learning triggers...");

    this.learningTriggers = [
      {
        type: "file-change",
        condition: { fileCount: 5 },
        action: "incremental-train",
        priority: "medium",
      },
      {
        type: "analysis-complete",
        condition: { accuracy: 0.7 },
        action: "evaluate-and-train",
        priority: "high",
      },
      {
        type: "user-feedback",
        condition: { feedbackCount: 3 },
        action: "feedback-driven-train",
        priority: "high",
      },
      {
        type: "schedule",
        condition: { interval: 3600000 }, // 1 hour
        action: "scheduled-train",
        priority: "low",
      },
      {
        type: "threshold",
        condition: { performanceDrop: 0.1 },
        action: "performance-driven-train",
        priority: "critical",
      },
    ];

    console.warn(`✅ Initialized ${this.learningTriggers.length} learning triggers`);
  }

  // Setup event listeners
  private setupEventListeners(): void {
    this.mlService.on("training-completed", (data) => {
      this.handleTrainingCompleted(data);
    });

    this.mlService.on("training-progress", (data) => {
      this.handleTrainingProgress(data);
    });

    // Set up periodic evaluation
    setInterval(() => {
      this.evaluateModelPerformance();
    }, 60000); // Every minute
  }

  // Process analysis result and trigger learning
  async processAnalysisResult(result: AnalysisResult): Promise<void> {
    console.warn(`📊 Processing analysis result: ${result.type} for ${result.filePath}`);

    // Store result
    if (!this.analysisResults.has(result.type)) {
      this.analysisResults.set(result.type, []);
    }
    this.analysisResults.get(result.type)!.push(result);

    // Convert to training data
    const trainingData = this.mlService.extractFeatures({
      ...result.results,
      filePath: result.filePath,
      language: result.language,
      confidence: result.confidence,
      analysisType: result.type,
      timestamp: result.timestamp,
    });

    // Add to ML service training database
    this.mlService.addTrainingData(trainingData);

    // Check triggers
    await this.checkTriggers(result);

    // Update model performance
    await this.updateModelPerformance(result);

    // Emit event
    this.emit("analysis-processed", result);
  }

  // Check if any triggers should fire
  private async checkTriggers(result: AnalysisResult): Promise<void> {
    if (!this.config.autoTrain || this.isLearning) {
      return;
    }

    for (const trigger of this.learningTriggers) {
      if (await this.evaluateTrigger(trigger, result)) {
        await this.executeTriggerAction(trigger);
        break; // Execute only one trigger at a time
      }
    }
  }

  // Evaluate trigger condition
  private async evaluateTrigger(
    trigger: LearningTrigger,
    result: AnalysisResult
  ): Promise<boolean> {
    switch (trigger.type) {
      case "file-change":
        return this.checkFileChangeTrigger(trigger);
      case "analysis-complete":
        return this.checkAnalysisCompleteTrigger(trigger, result);
      case "user-feedback":
        return this.checkUserFeedbackTrigger(trigger);
      case "schedule":
        return this.checkScheduleTrigger(trigger);
      case "threshold":
        return this.checkThresholdTrigger(trigger);
      default:
        return false;
    }
  }

  // Check file change trigger
  private checkFileChangeTrigger(trigger: LearningTrigger): boolean {
    const recentResults = this.getRecentResults(300000); // 5 minutes
    return recentResults.length >= trigger.condition.fileCount;
  }

  // Check analysis complete trigger
  private checkAnalysisCompleteTrigger(trigger: LearningTrigger, result: AnalysisResult): boolean {
    return result.confidence < trigger.condition.accuracy;
  }

  // Check user feedback trigger
  private checkUserFeedbackTrigger(trigger: LearningTrigger): boolean {
    return this.feedbackBuffer.length >= trigger.condition.feedbackCount;
  }

  // Check schedule trigger
  private checkScheduleTrigger(trigger: LearningTrigger): boolean {
    return Date.now() - this.lastRetrainingTime >= trigger.condition.interval;
  }

  // Check threshold trigger
  private checkThresholdTrigger(trigger: LearningTrigger): boolean {
    const performance = this.getAveragePerformance();
    return performance < 1 - trigger.condition.performanceDrop;
  }

  // Execute trigger action
  private async executeTriggerAction(trigger: LearningTrigger): Promise<void> {
    console.warn(`🚀 Executing trigger action: ${trigger.action} (priority: ${trigger.priority})`);

    this.isLearning = true;

    try {
      switch (trigger.action) {
        case "incremental-train":
          await this.performIncrementalTraining();
          break;
        case "evaluate-and-train":
          await this.evaluateAndTrain();
          break;
        case "feedback-driven-train":
          await this.performFeedbackDrivenTraining();
          break;
        case "scheduled-train":
          await this.performScheduledTraining();
          break;
        case "performance-driven-train":
          await this.performPerformanceDrivenTraining();
          break;
      }
    } catch (error) {
      console.error(`❌ Trigger action failed: ${error.message}`);
    } finally {
      this.isLearning = false;
    }
  }

  // Perform incremental training
  private async performIncrementalTraining(): Promise<void> {
    console.warn("🔄 Performing incremental training...");

    const dbStats = this.mlService.getTrainingDatabaseStats();

    if (dbStats.totalSamples < this.config.minSamplesForRetraining) {
      console.warn(
        `⏸️ Insufficient samples for retraining: ${dbStats.totalSamples} < ${this.config.minSamplesForRetraining}`
      );
      return;
    }

    // Train models that need improvement
    const modelsToTrain = ["code-analysis", "code-smell-detection", "refactoring-suggestion"];

    for (const modelName of modelsToTrain) {
      const performance = this.modelPerformance.get(modelName);
      if (!performance || performance.accuracy < 0.8) {
        try {
          await this.mlService.trainModel(modelName);
          console.warn(`✅ Incremental training completed for model: ${modelName}`);
        } catch (error) {
          console.error(`❌ Incremental training failed for model ${modelName}:`, error);
        }
      }
    }

    this.lastRetrainingTime = Date.now();
  }

  // Evaluate and train
  private async evaluateAndTrain(): Promise<void> {
    console.warn("🔍 Evaluating and training...");

    // Evaluate current model performance
    const evaluation = await this.evaluateCurrentModels();

    // Train models that need improvement
    for (const [modelName, metrics] of Object.entries(evaluation)) {
      if (metrics.accuracy < 0.75) {
        try {
          await this.mlService.trainModel(modelName);
          console.warn(`✅ Evaluation-driven training completed for model: ${modelName}`);
        } catch (error) {
          console.error(`❌ Evaluation-driven training failed for model ${modelName}:`, error);
        }
      }
    }
  }

  // Perform feedback-driven training
  private async performFeedbackDrivenTraining(): Promise<void> {
    console.warn("👥 Performing feedback-driven training...");

    if (this.feedbackBuffer.length === 0) {
      console.warn("⏸️ No feedback available for training");
      return;
    }

    // Process feedback and create weighted training data
    const weightedData = this.processFeedback();

    // Add weighted data to training database
    weightedData.forEach((data) => {
      this.mlService.addTrainingData(data);
    });

    // Train with feedback-weighted data
    try {
      await this.mlService.trainModel("code-analysis");
      console.warn("✅ Feedback-driven training completed");
    } catch (error) {
      console.error("❌ Feedback-driven training failed:", error);
    }

    // Clear feedback buffer
    this.feedbackBuffer = [];
  }

  // Perform scheduled training
  private async performScheduledTraining(): Promise<void> {
    console.warn("⏰ Performing scheduled training...");

    const dbStats = this.mlService.getTrainingDatabaseStats();
    console.warn(`📊 Training database stats: ${dbStats.totalSamples} total samples`);

    if (dbStats.totalSamples === 0) {
      console.warn("⏸️ No training data available");
      return;
    }

    // Train all models
    const models = [
      "code-analysis",
      "code-smell-detection",
      "refactoring-suggestion",
      "pattern-recognition",
    ];

    for (const modelName of models) {
      try {
        await this.mlService.trainModel(modelName);
        console.warn(`✅ Scheduled training completed for model: ${modelName}`);
      } catch (error) {
        console.error(`❌ Scheduled training failed for model ${modelName}:`, error);
      }
    }

    this.lastRetrainingTime = Date.now();
  }

  // Perform performance-driven training
  private async performPerformanceDrivenTraining(): Promise<void> {
    console.warn("📉 Performing performance-driven training...");

    // Identify models with performance degradation
    const degradedModels = this.identifyDegradedModels();

    if (degradedModels.length === 0) {
      console.warn("✅ No models show performance degradation");
      return;
    }

    // Retrain degraded models
    for (const modelName of degradedModels) {
      try {
        await this.mlService.trainModel(modelName);
        console.warn(`✅ Performance-driven training completed for model: ${modelName}`);
      } catch (error) {
        console.error(`❌ Performance-driven training failed for model ${modelName}:`, error);
      }
    }
  }

  // Process user feedback
  private processFeedback(): any[] {
    const weightedData: any[] = [];

    this.feedbackBuffer.forEach((feedback) => {
      const baseData = this.mlService.extractFeatures(feedback.analysis);

      // Apply feedback weight
      const weight = feedback.positive
        ? 1 + this.config.feedbackWeight
        : 1 - this.config.feedbackWeight;

      // Create weighted sample
      weightedData.push({
        ...baseData,
        metadata: {
          ...baseData.metadata,
          feedbackWeight: weight,
          userFeedback: feedback,
        },
      });
    });

    return weightedData;
  }

  // Add user feedback
  addFeedback(feedback: {
    analysisId: string;
    positive: boolean;
    comment?: string;
    rating?: number;
  }): void {
    console.warn(`👥 Adding user feedback: ${feedback.positive ? "positive" : "negative"}`);

    this.feedbackBuffer.push({
      ...feedback,
      timestamp: Date.now(),
    });

    // Limit buffer size
    if (this.feedbackBuffer.length > 100) {
      this.feedbackBuffer.splice(0, this.feedbackBuffer.length - 100);
    }

    this.emit("feedback-added", feedback);
  }

  // Evaluate current models
  private async evaluateCurrentModels(): Promise<{ [key: string]: any }> {
    const evaluation: { [key: string]: any } = {};

    const models = ["code-analysis", "code-smell-detection", "refactoring-suggestion"];

    for (const modelName of models) {
      const metrics = this.modelPerformance.get(modelName);

      evaluation[modelName] = {
        accuracy: metrics?.accuracy || 0,
        confidence: metrics?.confidence || 0,
        predictionTime: metrics?.predictionTime || 0,
        lastUpdated: metrics?.lastUpdated || Date.now(),
        needsRetraining: (metrics?.accuracy || 0) < 0.75,
      };
    }

    return evaluation;
  }

  // Identify degraded models
  private identifyDegradedModels(): string[] {
    const degraded: string[] = [];

    this.modelPerformance.forEach((performance, modelName) => {
      const improvementRate = performance.improvementRate;

      // Check if performance is degrading
      if (improvementRate < -this.config.threshold) {
        degraded.push(modelName);
      }
    });

    return degraded;
  }

  // Update model performance
  private async updateModelPerformance(result: AnalysisResult): Promise<void> {
    const modelName = this.getModelNameForAnalysis(result.type);
    if (!modelName) return;

    let performance = this.modelPerformance.get(modelName);

    if (!performance) {
      performance = {
        modelName,
        accuracy: 0,
        confidence: 0,
        predictionTime: 0,
        lastUpdated: Date.now(),
        improvementRate: 0,
        userFeedback: {
          positive: 0,
          negative: 0,
          total: 0,
        },
      };
    }

    // Update metrics
    const oldAccuracy = performance.accuracy;
    performance.accuracy = performance.accuracy * 0.9 + result.confidence * 0.1; // Weighted average
    performance.confidence = result.confidence;
    performance.predictionTime = result.metadata.analysisTime;
    performance.lastUpdated = Date.now();

    // Calculate improvement rate
    performance.improvementRate = performance.accuracy - oldAccuracy;

    this.modelPerformance.set(modelName, performance);

    // Store performance history
    this.performanceHistory.push({
      modelName,
      accuracy: performance.accuracy,
      confidence: performance.confidence,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.splice(0, this.performanceHistory.length - 1000);
    }
  }

  // Get model name for analysis type
  private getModelNameForAnalysis(analysisType: string): string | null {
    const mapping: { [key: string]: string } = {
      complexity: "code-analysis",
      refactoring: "refactoring-suggestion",
      dependency: "pattern-recognition",
      performance: "code-analysis",
      "code-smell": "code-smell-detection",
    };

    return mapping[analysisType] || null;
  }

  // Get recent results
  private getRecentResults(timeWindow: number): AnalysisResult[] {
    const cutoff = Date.now() - timeWindow;
    const recent: AnalysisResult[] = [];

    this.analysisResults.forEach((results) => {
      recent.push(...results.filter((r) => r.timestamp > cutoff));
    });

    return recent;
  }

  // Get average performance
  private getAveragePerformance(): number {
    if (this.modelPerformance.size === 0) return 1.0;

    let totalAccuracy = 0;
    this.modelPerformance.forEach((performance) => {
      totalAccuracy += performance.accuracy;
    });

    return totalAccuracy / this.modelPerformance.size;
  }

  // Evaluate model performance
  private async evaluateModelPerformance(): Promise<void> {
    const evaluation = await this.evaluateCurrentModels();

    this.emit("performance-evaluated", {
      evaluation,
      timestamp: Date.now(),
    });
  }

  // Handle training completed
  private handleTrainingCompleted(data: any): void {
    console.warn(`🎉 Training completed for model: ${data.modelName}`);

    // Update model performance
    const performance = this.modelPerformance.get(data.modelName);
    if (performance) {
      performance.accuracy = data.metrics.accuracy;
      performance.lastUpdated = Date.now();
    }

    this.emit("model-updated", {
      modelName: data.modelName,
      metrics: data.metrics,
    });
  }

  // Handle training progress
  private handleTrainingProgress(data: any): void {
    this.emit("training-progress", data);
  }

  // Get real-time predictions with learning
  async predictWithLearning(
    analysisType: string,
    code: string,
    language: string
  ): Promise<{
    prediction: any;
    confidence: number;
    modelInfo: {
      name: string;
      version: number;
      lastTrained: number;
      accuracy: number;
    };
    learning: {
      isLearning: boolean;
      lastImprovement: number;
      feedbackCount: number;
    };
  }> {
    const modelName = this.getModelNameForAnalysis(analysisType);
    if (!modelName) {
      throw new Error(`No model available for analysis type: ${analysisType}`);
    }

    // Get prediction
    const prediction = await this.mlService.predict(modelName, code, language);

    // Get model info
    const metrics = this.mlService.getModelMetrics(modelName);
    const performance = this.modelPerformance.get(modelName);

    // Get learning info
    const feedback = this.feedbackBuffer.filter(
      (f) => this.getModelNameForAnalysis(f.analysisType) === modelName
    );

    return {
      prediction: prediction.predictions,
      confidence: prediction.confidence,
      modelInfo: {
        name: modelName,
        version: metrics?.version || 1,
        lastTrained: metrics?.lastUpdated || 0,
        accuracy: performance?.accuracy || 0,
      },
      learning: {
        isLearning: this.isLearning,
        lastImprovement: performance?.improvementRate || 0,
        feedbackCount: feedback.length,
      },
    };
  }

  // Get learning statistics
  getLearningStatistics(): {
    trainingDatabase: any;
    modelPerformance: { [key: string]: ModelPerformance };
    feedbackBuffer: any[];
    performanceHistory: any[];
    isLearning: boolean;
    lastRetrainingTime: number;
    triggers: LearningTrigger[];
  } {
    return {
      trainingDatabase: this.mlService.getTrainingDatabaseStats(),
      modelPerformance: Object.fromEntries(this.modelPerformance),
      feedbackBuffer: this.feedbackBuffer,
      performanceHistory: this.performanceHistory,
      isLearning: this.isLearning,
      lastRetrainingTime: this.lastRetrainingTime,
      triggers: this.learningTriggers,
    };
  }

  // Get knowledge base insights
  getKnowledgeInsights(): {
    patterns: any;
    codeSmells: any;
    bestPractices: any;
    recommendations: string[];
  } {
    const knowledgeBase = this.mlService.getKnowledgeBase();

    const recommendations: string[] = [];

    // Generate recommendations based on knowledge base
    if (knowledgeBase.patterns) {
      const topPatterns = Object.entries(knowledgeBase.patterns)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3);

      recommendations.push(`Most common patterns: ${topPatterns.map(([name]) => name).join(", ")}`);
    }

    if (knowledgeBase["code-smells"]) {
      const topSmells = Object.entries(knowledgeBase["code-smells"])
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3);

      recommendations.push(
        `Most common code smells: ${topSmells.map(([name]) => name).join(", ")}`
      );
    }

    return {
      patterns: knowledgeBase.patterns || {},
      codeSmells: knowledgeBase["code-smells"] || {},
      bestPractices: knowledgeBase["best-practices"] || {},
      recommendations,
    };
  }

  // Export learning data
  exportLearningData(): {
    trainingDatabase: any;
    modelPerformance: { [key: string]: ModelPerformance };
    feedbackBuffer: any[];
    performanceHistory: any[];
    knowledgeBase: any;
    config: IncrementalLearningConfig;
  } {
    return {
      trainingDatabase: this.mlService.getTrainingDatabaseStats(),
      modelPerformance: Object.fromEntries(this.modelPerformance),
      feedbackBuffer: this.feedbackBuffer,
      performanceHistory: this.performanceHistory,
      knowledgeBase: this.mlService.getKnowledgeBase(),
      config: this.config,
    };
  }

  // Import learning data
  async importLearningData(data: {
    trainingDatabase: any;
    modelPerformance: { [key: string]: ModelPerformance };
    feedbackBuffer: any[];
    performanceHistory: any[];
    knowledgeBase: any;
    config?: IncrementalLearningConfig;
  }): Promise<void> {
    // Import training data
    // Note: This would require actual data import in the ML service

    // Import model performance
    Object.entries(data.modelPerformance).forEach(([modelName, performance]) => {
      this.modelPerformance.set(modelName, performance);
    });

    // Import feedback buffer
    this.feedbackBuffer = data.feedbackBuffer;

    // Import performance history
    this.performanceHistory = data.performanceHistory;

    // Update config if provided
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    console.warn("✅ Learning data imported successfully");
  }
}

export default EnhancedSelfLearningService;
