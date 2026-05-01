/**
 * A/B Testing Framework for Recommendation Effectiveness
 * Provides comprehensive A/B testing capabilities for the Self-Learning system
 */

import { Recommendation } from "./selfLearning";
import { indexedDBPersistence } from "./indexedDBPersistence";

export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed" | "failed";
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  variants: ABVariant[];
  trafficSplit: number;
  targetAudience: TestAudience;
  successMetrics: TestMetric[];
  minSampleSize: number;
  confidenceLevel: number;
  duration: number; // in hours
  results?: ABTestResults;
}

export interface ABVariant {
  id: string;
  name: string;
  description: string;
  type: "control" | "treatment";
  config: VariantConfig;
  trafficAllocation: number; // percentage (0-100)
}

export interface VariantConfig {
  // Recommendation algorithm configurations
  algorithm?: "traditional" | "ml-enhanced" | "hybrid";
  weights?: Record<string, number>;
  filters?: string[];
  personalization?: {
    enabled: boolean;
    strength: number;
  };
  ui?: {
    layout: "default" | "compact" | "detailed";
    colors: string[];
    animations: boolean;
  };
  timing?: {
    delay: number;
    frequency: number;
  };
}

export interface TestAudience {
  segments: string[];
  filters: Record<string, any>;
  sampleSize: number;
  criteria: {
    minActivity: number;
    timeWindow: number; // in days
  };
}

export interface TestMetric {
  name: string;
  type: "conversion" | "engagement" | "satisfaction" | "performance";
  weight: number;
  target: number;
  measurement: string;
}

export interface ABTestResults {
  totalParticipants: number;
  variantResults: VariantResult[];
  statisticalSignificance: number;
  winner?: string;
  confidence: number;
  insights: string[];
  recommendations: string[];
}

export interface VariantResult {
  variantId: string;
  participants: number;
  conversions: number;
  conversionRate: number;
  engagement: EngagementMetrics;
  satisfaction: SatisfactionMetrics;
  performance: PerformanceMetrics;
  statisticalData: StatisticalData;
}

export interface EngagementMetrics {
  clickRate: number;
  timeToAction: number;
  interactionDepth: number;
  bounceRate: number;
}

export interface SatisfactionMetrics {
  averageRating: number;
  feedbackCount: number;
  positiveSentiment: number;
  responseRate: number;
}

export interface PerformanceMetrics {
  loadTime: number;
  responseTime: number;
  errorRate: number;
  resourceUsage: number;
}

export interface StatisticalData {
  standardError: number;
  confidenceInterval: [number, number];
  pValue: number;
  zScore: number;
  power: number;
}

export class ABTestingFramework {
  private activeTests: Map<string, ABTest> = new Map();
  private userAssignments: Map<string, string> = new Map(); // userId -> testId
  private variantAssignments: Map<string, string> = new Map(); // userId -> variantId

  async createTest(config: Partial<ABTest>): Promise<ABTest> {
    const test: ABTest = {
      id: this.generateId(),
      name: config.name || "New A/B Test",
      description: config.description || "",
      status: "draft",
      createdAt: new Date(),
      variants: config.variants || this.createDefaultVariants(),
      trafficSplit: config.trafficSplit || 100,
      targetAudience: config.targetAudience || this.createDefaultAudience(),
      successMetrics: config.successMetrics || this.createDefaultMetrics(),
      minSampleSize: config.minSampleSize || 1000,
      confidenceLevel: config.confidenceLevel || 0.95,
      duration: config.duration || 168, // 1 week
    };

    // Validate test configuration
    this.validateTest(test);

    // Save test to storage
    await this.saveTest(test);

    this.activeTests.set(test.id, test);
    return test;
  }

  async startTest(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    if (test.status !== "draft") {
      throw new Error(`Test ${testId} is not in draft status`);
    }

    test.status = "running";
    test.startedAt = new Date();

    await this.saveTest(test);
    await this.logTestEvent(testId, "started", { timestamp: new Date() });
  }

  async pauseTest(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    if (test.status !== "running") {
      throw new Error(`Test ${testId} is not running`);
    }

    test.status = "paused";
    await this.saveTest(test);
    await this.logTestEvent(testId, "paused", { timestamp: new Date() });
  }

  async stopTest(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    test.status = "completed";
    test.completedAt = new Date();

    // Calculate final results
    test.results = await this.calculateTestResults(test);

    await this.saveTest(test);
    await this.logTestEvent(testId, "completed", {
      timestamp: new Date(),
      results: test.results,
    });
  }

  async assignUserToTest(userId: string, testId: string): Promise<string> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    if (test.status !== "running") {
      throw new Error(`Test ${testId} is not running`);
    }

    // Check if user is already assigned
    if (this.userAssignments.has(userId)) {
      const existingTestId = this.userAssignments.get(userId)!;
      if (existingTestId !== testId) {
        throw new Error(`User ${userId} is already assigned to test ${existingTestId}`);
      }
      return this.variantAssignments.get(userId)!;
    }

    // Check if user meets target audience criteria
    if (!(await this.isUserEligible(userId, test.targetAudience))) {
      throw new Error(`User ${userId} is not eligible for test ${testId}`);
    }

    // Assign to variant based on traffic allocation
    const variantId = this.assignVariant(test.variants);

    this.userAssignments.set(userId, testId);
    this.variantAssignments.set(userId, variantId);

    await this.logTestEvent(testId, "user_assigned", {
      userId,
      variantId,
      timestamp: new Date(),
    });

    return variantId;
  }

  async recordConversion(userId: string, testId: string, conversionData: any): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    const variantId = this.variantAssignments.get(userId);
    if (!variantId) throw new Error(`User ${userId} not assigned to test ${testId}`);

    await this.logTestEvent(testId, "conversion", {
      userId,
      variantId,
      data: conversionData,
      timestamp: new Date(),
    });
  }

  async recordEngagement(userId: string, testId: string, engagementData: any): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    const variantId = this.variantAssignments.get(userId);
    if (!variantId) throw new Error(`User ${userId} not assigned to test ${testId}`);

    await this.logTestEvent(testId, "engagement", {
      userId,
      variantId,
      data: engagementData,
      timestamp: new Date(),
    });
  }

  async recordFeedback(userId: string, testId: string, feedbackData: any): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    const variantId = this.variantAssignments.get(userId);
    if (!variantId) throw new Error(`User ${userId} not assigned to test ${testId}`);

    await this.logTestEvent(testId, "feedback", {
      userId,
      variantId,
      data: feedbackData,
      timestamp: new Date(),
    });
  }

  async getTestResults(testId: string): Promise<ABTestResults | null> {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    if (test.results) {
      return test.results;
    }

    // Calculate interim results for running tests
    return await this.calculateTestResults(test);
  }

  async getActiveTests(): Promise<ABTest[]> {
    return Array.from(this.activeTests.values()).filter(
      (test) => test.status === "running" || test.status === "paused"
    );
  }

  async getTestHistory(): Promise<ABTest[]> {
    const allTests = await this.loadAllTests();
    return allTests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteTest(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    // Remove from active tests
    this.activeTests.delete(testId);

    // Clean up user assignments for this test
    for (const [userId, assignedTestId] of this.userAssignments.entries()) {
      if (assignedTestId === testId) {
        this.userAssignments.delete(userId);
        this.variantAssignments.delete(userId);
      }
    }

    // Remove from IndexedDB
    await indexedDBPersistence.deleteAnalyticsData("ab-test", testId);

    await this.logTestEvent(testId, "deleted", { timestamp: new Date() });
  }

  private async calculateTestResults(test: ABTest): Promise<ABTestResults> {
    const events = await this.getTestEvents(test.id);
    const variantResults: VariantResult[] = [];

    // Calculate results for each variant
    for (const variant of test.variants) {
      const variantEvents = events.filter((e) => e.variantId === variant.id);
      const result = await this.calculateVariantResults(
        variant,
        variantEvents,
        test.successMetrics
      );
      variantResults.push(result);
    }

    // Calculate statistical significance
    const statisticalSignificance = this.calculateStatisticalSignificance(variantResults);

    // Determine winner
    const winner = this.determineWinner(variantResults, statisticalSignificance);

    // Generate insights and recommendations
    const insights = this.generateInsights(variantResults, test);
    const recommendations = this.generateRecommendations(variantResults, test, winner);

    return {
      totalParticipants: variantResults.reduce((sum, r) => sum + r.participants, 0),
      variantResults,
      statisticalSignificance,
      winner,
      confidence: statisticalSignificance,
      insights,
      recommendations,
    };
  }

  private async calculateVariantResults(
    variant: ABVariant,
    events: any[],
    metrics: TestMetric[]
  ): Promise<VariantResult> {
    const participants = new Set(events.map((e) => e.userId)).size;
    const conversions = events.filter((e) => e.type === "conversion").length;
    const conversionRate = participants > 0 ? conversions / participants : 0;

    const engagement = this.calculateEngagementMetrics(events);
    const satisfaction = this.calculateSatisfactionMetrics(events);
    const performance = this.calculatePerformanceMetrics(events);
    const statisticalData = this.calculateStatisticalData(conversions, participants);

    return {
      variantId: variant.id,
      participants,
      conversions,
      conversionRate,
      engagement,
      satisfaction,
      performance,
      statisticalData,
    };
  }

  private calculateEngagementMetrics(events: any[]): EngagementMetrics {
    const engagementEvents = events.filter((e) => e.type === "engagement");

    return {
      clickRate: this.calculateMetric(engagementEvents, "clicks"),
      timeToAction: this.calculateMetric(engagementEvents, "timeToAction"),
      interactionDepth: this.calculateMetric(engagementEvents, "depth"),
      bounceRate: this.calculateMetric(engagementEvents, "bounce"),
    };
  }

  private calculateSatisfactionMetrics(events: any[]): SatisfactionMetrics {
    const feedbackEvents = events.filter((e) => e.type === "feedback");

    return {
      averageRating: this.calculateMetric(feedbackEvents, "rating"),
      feedbackCount: feedbackEvents.length,
      positiveSentiment: this.calculateMetric(feedbackEvents, "sentiment"),
      responseRate: this.calculateMetric(feedbackEvents, "response"),
    };
  }

  private calculatePerformanceMetrics(events: any[]): PerformanceMetrics {
    const performanceEvents = events.filter((e) => e.type === "performance");

    return {
      loadTime: this.calculateMetric(performanceEvents, "loadTime"),
      responseTime: this.calculateMetric(performanceEvents, "responseTime"),
      errorRate: this.calculateMetric(performanceEvents, "errors"),
      resourceUsage: this.calculateMetric(performanceEvents, "resources"),
    };
  }

  private calculateStatisticalData(conversions: number, participants: number): StatisticalData {
    const conversionRate = participants > 0 ? conversions / participants : 0;
    const standardError = Math.sqrt((conversionRate * (1 - conversionRate)) / participants);
    const zScore = conversionRate / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    const confidenceInterval: [number, number] = [
      conversionRate - 1.96 * standardError,
      conversionRate + 1.96 * standardError,
    ];
    const power = this.calculatePower(conversionRate, participants);

    return {
      standardError,
      confidenceInterval,
      pValue,
      zScore,
      power,
    };
  }

  private calculateStatisticalSignificance(variantResults: VariantResult[]): number {
    if (variantResults.length < 2) return 0;

    const control = variantResults.find((r) => r.variantId.includes("control"));
    const treatment = variantResults.find((r) => r.variantId.includes("treatment"));

    if (!control || !treatment) return 0;

    // Simple significance calculation based on p-value
    return Math.max(0, 1 - treatment.statisticalData.pValue);
  }

  private determineWinner(
    variantResults: VariantResult[],
    significance: number
  ): string | undefined {
    if (significance < 0.95) return undefined; // Not statistically significant

    const sorted = variantResults.sort((a, b) => b.conversionRate - a.conversionRate);
    return sorted[0].variantId;
  }

  private generateInsights(variantResults: VariantResult[], test: ABTest): string[] {
    const insights: string[] = [];

    // Compare conversion rates
    const sorted = variantResults.sort((a, b) => b.conversionRate - a.conversionRate);
    if (sorted.length >= 2) {
      const improvement =
        ((sorted[0].conversionRate - sorted[1].conversionRate) / sorted[1].conversionRate) * 100;
      insights.push(
        `${sorted[0].variantId} shows ${improvement.toFixed(1)}% better conversion rate`
      );
    }

    // Engagement insights
    const bestEngagement = variantResults.reduce((best, current) =>
      current.engagement.clickRate > best.engagement.clickRate ? current : best
    );
    insights.push(`${bestEngagement.variantId} has highest engagement rate`);

    // Performance insights
    const fastest = variantResults.reduce((fastest, current) =>
      current.performance.responseTime < fastest.performance.responseTime ? current : fastest
    );
    insights.push(`${fastest.variantId} has fastest response time`);

    return insights;
  }

  private generateRecommendations(
    variantResults: VariantResult[],
    test: ABTest,
    winner?: string
  ): string[] {
    const recommendations: string[] = [];

    if (winner) {
      const winnerVariant = variantResults.find((r) => r.variantId === winner);
      if (winnerVariant) {
        recommendations.push(`Implement ${winner} as the default configuration`);
        recommendations.push(`Monitor performance after implementation`);
      }
    } else {
      recommendations.push(`Run test longer to achieve statistical significance`);
      recommendations.push(`Consider increasing sample size`);
    }

    // Performance recommendations
    const slowVariant = variantResults.reduce((slowest, current) =>
      current.performance.responseTime > slowest.performance.responseTime ? current : slowest
    );
    recommendations.push(`Optimize ${slowVariant.variantId} for better performance`);

    return recommendations;
  }

  private assignVariant(variants: ABVariant[]): string {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.trafficAllocation;
      if (random <= cumulative) {
        return variant.id;
      }
    }

    return variants[variants.length - 1].id; // Fallback
  }

  private async isUserEligible(userId: string, audience: TestAudience): Promise<boolean> {
    // Check user activity criteria
    // This would integrate with user activity tracking system
    return true; // Simplified for now
  }

  private validateTest(test: ABTest): void {
    if (!test.name || test.name.trim() === "") {
      throw new Error("Test name is required");
    }

    if (test.variants.length < 2) {
      throw new Error("At least 2 variants are required");
    }

    const totalAllocation = test.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.1) {
      throw new Error("Variant traffic allocations must sum to 100%");
    }

    if (test.minSampleSize < 100) {
      throw new Error("Minimum sample size must be at least 100");
    }
  }

  private createDefaultVariants(): ABVariant[] {
    return [
      {
        id: "control",
        name: "Control",
        description: "Current recommendation system",
        type: "control",
        config: {
          algorithm: "traditional",
          weights: { frequency: 0.5, recency: 0.3, consistency: 0.2 },
          personalization: { enabled: false, strength: 0 },
        },
        trafficAllocation: 50,
      },
      {
        id: "treatment",
        name: "ML Enhanced",
        description: "Machine learning enhanced recommendations",
        type: "treatment",
        config: {
          algorithm: "ml-enhanced",
          weights: { frequency: 0.3, recency: 0.4, consistency: 0.3 },
          personalization: { enabled: true, strength: 0.8 },
        },
        trafficAllocation: 50,
      },
    ];
  }

  private createDefaultAudience(): TestAudience {
    return {
      segments: ["all"],
      filters: {},
      sampleSize: 1000,
      criteria: {
        minActivity: 10,
        timeWindow: 7,
      },
    };
  }

  private createDefaultMetrics(): TestMetric[] {
    return [
      {
        name: "conversion",
        type: "conversion",
        weight: 0.6,
        target: 0.3,
        measurement: "recommendation_accepted",
      },
      {
        name: "engagement",
        type: "engagement",
        weight: 0.3,
        target: 0.5,
        measurement: "click_rate",
      },
      {
        name: "satisfaction",
        type: "satisfaction",
        weight: 0.1,
        target: 4.0,
        measurement: "average_rating",
      },
    ];
  }

  private async saveTest(test: ABTest): Promise<void> {
    await indexedDBPersistence.saveAnalyticsData({
      type: "ab-test",
      testId: test.id,
      test,
    });
  }

  private async loadTest(testId: string): Promise<ABTest | null> {
    const records = await indexedDBPersistence.loadAnalyticsData("ab-test", 1000);
    const testRecord = records.find((r) => r.testId === testId);
    return testRecord?.test || null;
  }

  private async loadAllTests(): Promise<ABTest[]> {
    const records = await indexedDBPersistence.loadAnalyticsData("ab-test", 1000);
    return records.map((r) => r.test);
  }

  private async logTestEvent(testId: string, eventType: string, data: any): Promise<void> {
    await indexedDBPersistence.saveAnalyticsData({
      type: "ab-test-event",
      testId,
      eventType,
      data,
      timestamp: new Date(),
    });
  }

  private async getTestEvents(testId: string): Promise<any[]> {
    const records = await indexedDBPersistence.loadAnalyticsData("ab-test-event", 10000);
    return records.filter((r) => r.testId === testId);
  }

  private calculateMetric(events: any[], metric: string): number {
    if (events.length === 0) return 0;

    const values = events.map((e) => e.data?.[metric]).filter((v) => v !== undefined);
    if (values.length === 0) return 0;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private calculatePower(conversionRate: number, sampleSize: number): number {
    // Simplified power calculation
    return Math.min(1, (sampleSize / 1000) * conversionRate);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Singleton instance
export const abTestingFramework = new ABTestingFramework();
