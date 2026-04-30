/**
 * Machine Learning Recommendation Engine
 * Provides intelligent recommendations based on user behavior patterns
 */

import { LearningPattern, UsageEvent, Recommendation } from './selfLearning'

export interface MLModel {
  predictRecommendations(patterns: LearningPattern[], events: UsageEvent[]): Recommendation[]
  updateModel(feedback: UserFeedback): void
  getModelAccuracy(): number
}

export interface UserFeedback {
  recommendationId: string
  action: 'accepted' | 'dismissed' | 'modified'
  timestamp: Date
  context: any
}

export class SimpleMLRecommendationEngine implements MLModel {
  private weights: Map<string, number> = new Map()
  private feedbackHistory: UserFeedback[] = []
  private modelAccuracy: number = 0.5

  constructor() {
    this.initializeWeights()
  }

  private initializeWeights() {
    // Initialize feature weights
    this.weights.set('frequency', 0.3)
    this.weights.set('recency', 0.25)
    this.weights.set('consistency', 0.2)
    this.weights.set('context', 0.15)
    this.weights.set('diversity', 0.1)
  }

  predictRecommendations(patterns: LearningPattern[], events: UsageEvent[]): Recommendation[] {
    const recommendations: Recommendation[] = []
    
    // Analyze user context
    const context = this.analyzeUserContext(events)
    
    // Generate recommendations based on different ML approaches
    const collaborativeRecs = this.generateCollaborativeRecommendations(patterns, context)
    const contentBasedRecs = this.generateContentBasedRecommendations(patterns, context)
    const contextualRecs = this.generateContextualRecommendations(patterns, context)
    
    // Combine and rank recommendations
    const allRecs = [...collaborativeRecs, ...contentBasedRecs, ...contextualRecs]
    
    // Apply ML scoring and ranking
    const scoredRecs = allRecs.map(rec => ({
      ...rec,
      score: this.calculateRecommendationScore(rec, patterns, context)
    }))
    
    // Remove duplicates and sort by score
    const uniqueRecs = this.removeDuplicates(scoredRecs)
    const sortedRecs = uniqueRecs.sort((a, b) => b.score - a.score)
    
    // Return top recommendations
    return sortedRecs.slice(0, 10)
  }

  private analyzeUserContext(events: UsageEvent[]): any {
    const recentEvents = events.filter(e => 
      Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    )
    
    const currentHour = new Date().getHours()
    const dayOfWeek = new Date().getDay()
    
    // Analyze current session patterns
    const sessionEvents = events.filter(e => 
      Date.now() - e.timestamp.getTime() < 2 * 60 * 60 * 1000 // Last 2 hours
    )
    
    return {
      timeOfDay: this.getTimeOfDayCategory(currentHour),
      dayOfWeek,
      sessionLength: sessionEvents.length,
      recentActivity: recentEvents.length,
      dominantFileType: this.getDominantFileType(recentEvents),
      workingDepth: this.getAverageWorkingDepth(recentEvents),
      isActive: sessionEvents.length > 5
    }
  }

  private getTimeOfDayCategory(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 21) return 'evening'
    return 'night'
  }

  private getDominantFileType(events: UsageEvent[]): string {
    const fileTypes = events
      .filter(e => e.type === 'file-access')
      .reduce((types, e) => {
        const ext = e.data.extension || 'unknown'
        types[ext] = (types[ext] || 0) + 1
        return types
      }, {} as Record<string, number>)
    
    return Object.entries(fileTypes)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
  }

  private getAverageWorkingDepth(events: UsageEvent[]): number {
    const navEvents = events.filter(e => e.type === 'directory-navigation')
    if (navEvents.length === 0) return 0
    
    const depths = navEvents.map(e => (e.data.path || '').split('/').length)
    return depths.reduce((sum, depth) => sum + depth, 0) / depths.length
  }

  private generateCollaborativeRecommendations(patterns: LearningPattern[], context: any): Recommendation[] {
    const recommendations: Recommendation[] = []
    
    // Find similar users based on patterns (simplified collaborative filtering)
    const similarPatterns = patterns.filter(p => p.confidence > 0.7)
    
    // Generate recommendations based on similar user behavior
    similarPatterns.forEach(pattern => {
      if (pattern.type === 'directory-preference') {
        const path = pattern.data.path
        const depth = pattern.data.depth || 0
        
        // Recommend related directories
        if (depth <= 3 && context.workingDepth <= 4) {
          recommendations.push({
            id: this.generateId(),
            type: 'organization',
            title: `Create workspace shortcut for ${path}`,
            description: `You frequently access this directory. A workspace shortcut would improve productivity.`,
            score: 0,
            priority: pattern.confidence > 0.8 ? 'high' : 'medium',
            actions: [
              { type: 'create-workspace', path },
              { type: 'create-shortcut', path }
            ]
          })
        }
      }
      
      if (pattern.type === 'file-access' && pattern.data.extension) {
        const ext = pattern.data.extension
        
        // Recommend file type optimizations
        if (pattern.frequency > 10) {
          recommendations.push({
            id: this.generateId(),
            type: 'access-shortcut',
            title: `${ext.toUpperCase()} files quick filter`,
            description: `Create a quick filter for ${ext} files you access frequently (${pattern.frequency} times).`,
            score: 0,
            priority: 'medium',
            actions: [
              { type: 'create-filter', extension: ext },
              { type: 'add-to-favorites', fileType: ext }
            ]
          })
        }
      }
    })
    
    return recommendations
  }

  private generateContentBasedRecommendations(patterns: LearningPattern[], context: any): Recommendation[] {
    const recommendations: Recommendation[] = []
    
    // Analyze content patterns and recommend optimizations
    const filePatterns = patterns.filter(p => p.type === 'file-access')
    const cleanupPatterns = patterns.filter(p => p.type === 'cleanup-habit')
    
    // Recommend cleanup based on file patterns
    if (filePatterns.length > 5) {
      const largeFilePatterns = filePatterns.filter(p => 
        p.data.sizeCategory === 'large' && p.frequency > 3
      )
      
      if (largeFilePatterns.length > 0) {
        recommendations.push({
          id: this.generateId(),
          type: 'cleanup',
          title: 'Optimize large file storage',
          description: `You frequently work with large files. Consider organizing them in a dedicated directory.`,
          score: 0,
          priority: 'medium',
          actions: [
            { type: 'organize-large-files' },
            { type: 'create-large-files-dir' }
          ]
        })
      }
    }
    
    // Recommend time-based optimizations
    if (context.timeOfDay === 'morning' && context.sessionLength > 10) {
      recommendations.push({
        id: this.generateId(),
        type: 'schedule',
        title: 'Schedule morning cleanup routine',
        description: 'You\'re most active in the morning. Schedule automatic cleanup during this time.',
        score: 0,
        priority: 'low',
        actions: [
          { type: 'schedule-cleanup', time: '09:00' },
          { type: 'create-morning-routine' }
        ]
      })
    }
    
    return recommendations
  }

  private generateContextualRecommendations(patterns: LearningPattern[], context: any): Recommendation[] {
    const recommendations: Recommendation[] = []
    
    // Context-aware recommendations based on current activity
    if (context.isActive && context.sessionLength > 15) {
      recommendations.push({
        id: this.generateId(),
        type: 'organization',
        title: 'Take a break - organize your workspace',
        description: `You've been active for a while. A quick organization session might improve productivity.`,
        score: 0,
        priority: 'low',
        actions: [
          { type: 'suggest-break' },
          { type: 'quick-organization' }
        ]
      })
    }
    
    // Recommend based on working depth
    if (context.workingDepth > 5) {
      recommendations.push({
        id: this.generateId(),
        type: 'organization',
        title: 'Simplify directory structure',
        description: 'You\'re working in deep directories. Consider flattening your structure for better navigation.',
        score: 0,
        priority: 'medium',
        actions: [
          { type: 'flatten-structure' },
          { type: 'create-shortcuts' }
        ]
      })
    }
    
    return recommendations
  }

  private calculateRecommendationScore(rec: Recommendation, patterns: LearningPattern[], context: any): number {
    let score = 0.5 // Base score
    
    // Frequency factor
    const relatedPatterns = patterns.filter(p => 
      p.type === rec.type || p.data.extension === rec.actions[0]?.extension
    )
    const frequency = relatedPatterns.reduce((sum, p) => sum + p.frequency, 0)
    score += Math.min(0.3, frequency / 50) * this.weights.get('frequency')!
    
    // Recency factor
    const recentPatterns = patterns.filter(p => 
      Date.now() - p.lastUsed.getTime() < 7 * 24 * 60 * 60 * 1000
    )
    score += (recentPatterns.length / patterns.length) * this.weights.get('recency')!
    
    // Context factor
    if (context.timeOfDay === 'morning' && rec.type === 'schedule') score += 0.2
    if (context.workingDepth > 4 && rec.type === 'organization') score += 0.15
    if (context.isActive && rec.type === 'cleanup') score += 0.1
    
    // Diversity factor - penalize similar recommendations
    score += this.calculateDiversityBonus(rec, patterns) * this.weights.get('diversity')!
    
    return Math.min(1, Math.max(0, score))
  }

  private calculateDiversityBonus(rec: Recommendation, patterns: LearningPattern[]): number {
    // Reward diverse recommendation types
    const typeCount = patterns.reduce((types, p) => {
      types[p.type] = (types[p.type] || 0) + 1
      return types
    }, {} as Record<string, number>)
    
    const currentTypeCount = typeCount[rec.type] || 0
    const maxTypeCount = Math.max(...Object.values(typeCount))
    
    if (maxTypeCount === 0) return 0.1
    
    // Bonus for underrepresented recommendation types
    return Math.max(0, (maxTypeCount - currentTypeCount) / maxTypeCount) * 0.1
  }

  private removeDuplicates(recommendations: Recommendation[]): Recommendation[] {
    const seen = new Set<string>()
    return recommendations.filter(rec => {
      const key = `${rec.type}-${rec.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  updateModel(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback)
    
    // Update weights based on feedback
    this.updateWeights(feedback)
    
    // Recalculate model accuracy
    this.calculateModelAccuracy()
    
    // Keep only recent feedback (last 1000 entries)
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-1000)
    }
  }

  private updateWeights(feedback: UserFeedback): void {
    // Simple weight adjustment based on feedback
    const adjustment = feedback.action === 'accepted' ? 0.01 : -0.005
    
    // Adjust weights based on recommendation type performance
    const recentFeedback = this.feedbackHistory.slice(-100)
    const typeFeedback = recentFeedback.filter(f => 
      // This would need to be extended to track recommendation types
      true // Simplified for now
    )
    
    if (typeFeedback.length > 10) {
      const acceptanceRate = typeFeedback.filter(f => f.action === 'accepted').length / typeFeedback.length
      
      // Adjust weights based on performance
      if (acceptanceRate > 0.7) {
        // Increase weight for successful recommendation types
        this.weights.forEach((weight, key) => {
          this.weights.set(key, Math.min(1, weight + adjustment))
        })
      } else if (acceptanceRate < 0.3) {
        // Decrease weight for poor performing recommendation types
        this.weights.forEach((weight, key) => {
          this.weights.set(key, Math.max(0.1, weight + adjustment))
        })
      }
    }
  }

  private calculateModelAccuracy(): void {
    if (this.feedbackHistory.length < 10) {
      this.modelAccuracy = 0.5 // Default accuracy
      return
    }
    
    const recentFeedback = this.feedbackHistory.slice(-100)
    const acceptedCount = recentFeedback.filter(f => f.action === 'accepted').length
    const totalCount = recentFeedback.length
    
    this.modelAccuracy = acceptedCount / totalCount
  }

  getModelAccuracy(): number {
    return this.modelAccuracy
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

// Singleton instance
export const mlRecommendationEngine = new SimpleMLRecommendationEngine()
