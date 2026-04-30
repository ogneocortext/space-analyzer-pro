/**
 * Adaptive Learning Rate System
 * Dynamically adjusts learning parameters based on user behavior patterns
 */

import { LearningPattern, UsageEvent, Recommendation } from './selfLearning'
import { indexedDBPersistence } from './indexedDBPersistence'

export interface LearningRateConfig {
  baseRate: number
  adaptiveFactor: number
  minRate: number
  maxRate: number
  adjustmentThreshold: number
  smoothingFactor: number
}

export interface BehaviorMetrics {
  activityLevel: number
  consistencyScore: number
  explorationRate: number
  feedbackQuality: number
  timeOfDayVariation: number
  sessionLength: number
  errorRate: number
  successRate: number
}

export interface AdaptiveParameters {
  patternDetectionThreshold: number
  recommendationWeight: number
  feedbackInfluence: number
  temporalDecay: number
  patternMemory: number
  explorationBonus: number
}

export interface LearningRateHistory {
  timestamp: Date
  rate: number
  metrics: BehaviorMetrics
  parameters: AdaptiveParameters
  adjustmentReason: string
}

export class AdaptiveLearningRate {
  private config: LearningRateConfig
  private currentRate: number
  private currentParameters: AdaptiveParameters
  private history: LearningRateHistory[] = []
  private behaviorBaseline: BehaviorMetrics
  private lastAdjustment: Date = new Date()

  constructor() {
    this.config = {
      baseRate: 1.0,
      adaptiveFactor: 0.1,
      minRate: 0.1,
      maxRate: 3.0,
      adjustmentThreshold: 0.15,
      smoothingFactor: 0.8
    }

    this.currentRate = this.config.baseRate
    this.currentParameters = this.getDefaultParameters()
    this.behaviorBaseline = this.getDefaultBehaviorMetrics()
  }

  async updateLearningRate(
    patterns: LearningPattern[], 
    events: UsageEvent[], 
    recommendations: Recommendation[]
  ): Promise<number> {
    // Calculate current behavior metrics
    const currentMetrics = await this.calculateBehaviorMetrics(patterns, events, recommendations)
    
    // Analyze behavior changes
    const behaviorChange = this.analyzeBehaviorChange(currentMetrics)
    
    // Determine if adjustment is needed
    if (this.shouldAdjustRate(behaviorChange)) {
      const adjustmentReason = this.determineAdjustmentReason(behaviorChange)
      
      // Calculate new learning rate
      const newRate = this.calculateNewRate(behaviorChange, adjustmentReason)
      
      // Apply smoothing
      this.currentRate = this.applySmoothing(this.currentRate, newRate)
      
      // Update adaptive parameters
      this.updateAdaptiveParameters(behaviorChange)
      
      // Record adjustment
      await this.recordAdjustment(currentMetrics, adjustmentReason)
      
      return this.currentRate
    }

    return this.currentRate
  }

  private async calculateBehaviorMetrics(
    patterns: LearningPattern[], 
    events: UsageEvent[], 
    recommendations: Recommendation[]
  ): Promise<BehaviorMetrics> {
    const recentEvents = events.filter(e => 
      Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
    )

    return {
      activityLevel: this.calculateActivityLevel(recentEvents),
      consistencyScore: this.calculateConsistencyScore(recentEvents),
      explorationRate: this.calculateExplorationRate(recentEvents),
      feedbackQuality: await this.calculateFeedbackQuality(recommendations),
      timeOfDayVariation: this.calculateTimeOfDayVariation(recentEvents),
      sessionLength: this.calculateSessionLength(recentEvents),
      errorRate: this.calculateErrorRate(recentEvents),
      successRate: this.calculateSuccessRate(recommendations)
    }
  }

  private calculateActivityLevel(events: UsageEvent[]): number {
    if (events.length === 0) return 0

    const hourlyActivity = new Array(24).fill(0)
    events.forEach(event => {
      const hour = event.timestamp.getHours()
      hourlyActivity[hour]++
    })

    const avgActivity = hourlyActivity.reduce((sum, count) => sum + count, 0) / 24
    const maxActivity = Math.max(...hourlyActivity)
    
    // Normalize to 0-1 range
    return avgActivity / Math.max(1, maxActivity)
  }

  private calculateConsistencyScore(events: UsageEvent[]): number {
    if (events.length < 10) return 0.5

    // Calculate time intervals between similar events
    const fileEvents = events.filter(e => e.type === 'file-access')
    const intervals: number[] = []

    for (let i = 1; i < fileEvents.length; i++) {
      const current = fileEvents[i]
      const previous = fileEvents[i - 1]
      
      if (current.data.extension === previous.data.extension) {
        intervals.push(current.timestamp.getTime() - previous.timestamp.getTime())
      }
    }

    if (intervals.length < 3) return 0.5

    // Calculate coefficient of variation
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    const cv = stdDev / mean

    // Lower coefficient of variation means higher consistency
    return Math.max(0, Math.min(1, 1 - cv))
  }

  private calculateExplorationRate(events: UsageEvent[]): number {
    if (events.length === 0) return 0

    const uniqueExtensions = new Set(
      events
        .filter(e => e.type === 'file-access' && e.data.extension)
        .map(e => e.data.extension)
    )

    const uniquePaths = new Set(
      events
        .filter(e => e.type === 'directory-navigation' && e.data.path)
        .map(e => e.data.path)
    )

    const totalEvents = events.length
    const explorationScore = (uniqueExtensions.size + uniquePaths.size) / (2 * totalEvents)

    return Math.min(1, explorationScore * 10) // Scale to 0-1 range
  }

  private async calculateFeedbackQuality(recommendations: Recommendation[]): Promise<number> {
    const feedbackRecords = await indexedDBPersistence.loadAnalyticsData('user-feedback', 1000)
    const recentFeedback = feedbackRecords
      .filter(r => Date.now() - new Date(r.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000)
      .slice(-50)

    if (recentFeedback.length === 0) return 0.5

    const averageRating = recentFeedback.reduce((sum, r) => sum + (r.feedback?.rating || 3), 0) / recentFeedback.length
    const feedbackCount = recentFeedback.length

    // Higher rating and more feedback indicates better quality
    return (averageRating / 5) * Math.min(1, feedbackCount / 10)
  }

  private calculateTimeOfDayVariation(events: UsageEvent[]): number {
    if (events.length < 20) return 0

    const hourlyDistribution = new Array(24).fill(0)
    events.forEach(event => {
      const hour = event.timestamp.getHours()
      hourlyDistribution[hour]++
    })

    const total = events.length
    const expectedPerHour = total / 24
    
    // Calculate deviation from uniform distribution
    const deviation = hourlyDistribution.reduce((sum, count) => {
      return sum + Math.pow(count - expectedPerHour, 2)
    }, 0)

    const normalizedDeviation = Math.sqrt(deviation / total) / expectedPerHour
    return Math.min(1, normalizedDeviation)
  }

  private calculateSessionLength(events: UsageEvent[]): number {
    if (events.length === 0) return 0

    // Group events into sessions (gap > 30 minutes = new session)
    const sessions: number[] = []
    let currentSessionLength = 1

    for (let i = 1; i < events.length; i++) {
      const timeDiff = events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()
      
      if (timeDiff > 30 * 60 * 1000) { // 30 minutes
        sessions.push(currentSessionLength)
        currentSessionLength = 1
      } else {
        currentSessionLength++
      }
    }
    sessions.push(currentSessionLength)

    const avgSessionLength = sessions.reduce((sum, length) => sum + length, 0) / sessions.length
    return Math.min(1, avgSessionLength / 50) // Normalize to 0-1 range
  }

  private calculateErrorRate(events: UsageEvent[]): number {
    const errorEvents = events.filter(e => e.type === 'error' || e.data.error)
    const totalEvents = events.length

    return totalEvents > 0 ? errorEvents.length / totalEvents : 0
  }

  private calculateSuccessRate(recommendations: Recommendation[]): number {
    const feedbackRecords = await indexedDBPersistence.loadAnalyticsData('user-feedback', 1000)
    
    const recommendationIds = recommendations.map(r => r.id)
    const relevantFeedback = feedbackRecords.filter(r => 
      recommendationIds.includes(r.recommendationId)
    )

    if (relevantFeedback.length === 0) return 0.5

    const successfulFeedback = relevantFeedback.filter(r => 
      r.feedback?.rating >= 4
    )

    return successfulFeedback.length / relevantFeedback.length
  }

  private analyzeBehaviorChange(current: BehaviorMetrics): number {
    const changes: number[] = []

    Object.keys(current).forEach(key => {
      const currentValue = current[key as keyof BehaviorMetrics]
      const baselineValue = this.behaviorBaseline[key as keyof BehaviorMetrics]
      const change = Math.abs(currentValue - baselineValue) / baselineValue
      changes.push(change)
    })

    // Return average change across all metrics
    return changes.reduce((sum, change) => sum + change, 0) / changes.length
  }

  private shouldAdjustRate(behaviorChange: number): boolean {
    const timeSinceLastAdjustment = Date.now() - this.lastAdjustment.getTime()
    const minAdjustmentInterval = 2 * 60 * 60 * 1000 // 2 hours

    return behaviorChange > this.config.adjustmentThreshold && 
           timeSinceLastAdjustment > minAdjustmentInterval
  }

  private determineAdjustmentReason(behaviorChange: number): string {
    const reasons: string[] = []

    if (behaviorChange > 0.3) {
      reasons.push('Significant behavior change detected')
    } else if (behaviorChange > 0.2) {
      reasons.push('Moderate behavior change detected')
    } else {
      reasons.push('Minor behavior adjustment needed')
    }

    return reasons.join(', ')
  }

  private calculateNewRate(behaviorChange: number, reason: string): number {
    let adjustment = 0

    // Adjust based on behavior change magnitude
    if (behaviorChange > 0.5) {
      adjustment = 0.3 // Large adjustment
    } else if (behaviorChange > 0.3) {
      adjustment = 0.2 // Medium adjustment
    } else {
      adjustment = 0.1 // Small adjustment
    }

    // Apply adaptive factor
    adjustment *= this.config.adaptiveFactor

    // Determine direction based on behavior patterns
    if (reason.includes('increase') || reason.includes('improvement')) {
      return Math.min(this.config.maxRate, this.currentRate + adjustment)
    } else {
      return Math.max(this.config.minRate, this.currentRate - adjustment)
    }
  }

  private applySmoothing(currentRate: number, newRate: number): number {
    return this.config.smoothingFactor * currentRate + (1 - this.config.smoothingFactor) * newRate
  }

  private updateAdaptiveParameters(metrics: BehaviorMetrics): void {
    // Adjust parameters based on current behavior metrics

    // Pattern detection threshold
    if (metrics.consistencyScore > 0.8) {
      this.currentParameters.patternDetectionThreshold = Math.max(0.3, 
        this.currentParameters.patternDetectionThreshold - 0.05)
    } else if (metrics.consistencyScore < 0.4) {
      this.currentParameters.patternDetectionThreshold = Math.min(0.8, 
        this.currentParameters.patternDetectionThreshold + 0.05)
    }

    // Recommendation weight
    if (metrics.successRate > 0.8) {
      this.currentParameters.recommendationWeight = Math.min(1.0, 
        this.currentParameters.recommendationWeight + 0.1)
    } else if (metrics.successRate < 0.5) {
      this.currentParameters.recommendationWeight = Math.max(0.1, 
        this.currentParameters.recommendationWeight - 0.1)
    }

    // Feedback influence
    if (metrics.feedbackQuality > 0.8) {
      this.currentParameters.feedbackInfluence = Math.min(1.0, 
        this.currentParameters.feedbackInfluence + 0.05)
    }

    // Exploration bonus
    if (metrics.explorationRate < 0.2) {
      this.currentParameters.explorationBonus = Math.min(0.5, 
        this.currentParameters.explorationBonus + 0.1)
    } else if (metrics.explorationRate > 0.8) {
      this.currentParameters.explorationBonus = Math.max(0, 
        this.currentParameters.explorationBonus - 0.05)
    }
  }

  private async recordAdjustment(metrics: BehaviorMetrics, reason: string): Promise<void> {
    const adjustment: LearningRateHistory = {
      timestamp: new Date(),
      rate: this.currentRate,
      metrics,
      parameters: { ...this.currentParameters },
      adjustmentReason: reason
    }

    this.history.push(adjustment)
    this.lastAdjustment = new Date()

    // Keep only recent history (last 100 adjustments)
    if (this.history.length > 100) {
      this.history = this.history.slice(-100)
    }

    // Save to storage
    await indexedDBPersistence.saveAnalyticsData({
      type: 'learning-rate-adjustment',
      adjustment
    })

    // Update baseline gradually
    this.updateBehaviorBaseline(metrics)
  }

  private updateBehaviorBaseline(metrics: BehaviorMetrics): void {
    const learningRate = 0.05 // Slow adaptation of baseline
    Object.keys(metrics).forEach(key => {
      const current = metrics[key as keyof BehaviorMetrics]
      const baseline = this.behaviorBaseline[key as keyof BehaviorMetrics]
      this.behaviorBaseline[key as keyof BehaviorMetrics] = 
        (1 - learningRate) * baseline + learningRate * current
    })
  }

  private getDefaultParameters(): AdaptiveParameters {
    return {
      patternDetectionThreshold: 0.5,
      recommendationWeight: 0.7,
      feedbackInfluence: 0.3,
      temporalDecay: 0.9,
      patternMemory: 0.8,
      explorationBonus: 0.1
    }
  }

  private getDefaultBehaviorMetrics(): BehaviorMetrics {
    return {
      activityLevel: 0.5,
      consistencyScore: 0.5,
      explorationRate: 0.5,
      feedbackQuality: 0.5,
      timeOfDayVariation: 0.5,
      sessionLength: 0.5,
      errorRate: 0.1,
      successRate: 0.7
    }
  }

  // Public API methods
  getCurrentRate(): number {
    return this.currentRate
  }

  getCurrentParameters(): AdaptiveParameters {
    return { ...this.currentParameters }
  }

  getHistory(): LearningRateHistory[] {
    return [...this.history]
  }

  async loadHistory(): Promise<void> {
    try {
      const records = await indexedDBPersistence.loadAnalyticsData('learning-rate-adjustment', 1000)
      this.history = records.map(r => r.adjustment).sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      )

      if (this.history.length > 0) {
        const latest = this.history[0]
        this.currentRate = latest.rate
        this.currentParameters = { ...latest.parameters }
        this.lastAdjustment = latest.timestamp
      }
    } catch (error) {
      console.error('Failed to load learning rate history:', error)
    }
  }

  reset(): void {
    this.currentRate = this.config.baseRate
    this.currentParameters = this.getDefaultParameters()
    this.history = []
    this.lastAdjustment = new Date()
  }

  updateConfig(newConfig: Partial<LearningRateConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// Singleton instance
export const adaptiveLearningRate = new AdaptiveLearningRate()
