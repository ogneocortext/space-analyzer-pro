import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { mlRecommendationEngine } from "./mlRecommendations";
import { indexedDBPersistence } from "./indexedDBPersistence";
import { adaptiveLearningRate } from "./adaptiveLearningRate";
import { abTestingFramework } from "./abTestingFramework";

export interface LearningPattern {
  id: string;
  type: "file-access" | "directory-preference" | "time-pattern" | "cleanup-habit";
  description: string;
  confidence: number;
  frequency: number;
  data: any;
  createdAt: Date;
  lastUsed: Date;
}

export interface Recommendation {
  id: string;
  type: "cleanup" | "organization" | "access-shortcut" | "schedule";
  title: string;
  description: string;
  score: number;
  priority: "high" | "medium" | "low";
  actions: any[];
}

export interface UsageEvent {
  id: string;
  type: "file-access" | "directory-navigation" | "search-query" | "cleanup-action";
  timestamp: Date;
  data: any;
  context: any;
}

export const useSelfLearningStore = defineStore("selfLearning", () => {
  const patterns = ref<LearningPattern[]>([]);
  const recommendations = ref<Recommendation[]>([]);
  const usageEvents = ref<UsageEvent[]>([]);
  const isLearning = ref(false);
  const lastAnalysis = ref<Date | null>(null);

  // Learning configuration
  const learningConfig = ref({
    minConfidence: 0.7,
    minFrequency: 3,
    analysisInterval: 60000, // 1 minute
    maxPatterns: 100,
    maxRecommendations: 10,
  });

  const getPatterns = computed(() => patterns.value);
  const getRecommendations = computed(() => recommendations.value);
  const getIsLearning = computed(() => isLearning.value);

  const startLearning = () => {
    isLearning.value = true;
    loadStoredPatterns();
    startEventTracking();
    startPatternAnalysis();
  };

  const stopLearning = () => {
    isLearning.value = false;
    stopEventTracking();
    stopPatternAnalysis();
  };

  const loadStoredPatterns = async () => {
    try {
      // Try IndexedDB first
      await indexedDBPersistence.init();
      const storedPatterns = await indexedDBPersistence.loadPatterns();

      if (storedPatterns.length > 0) {
        patterns.value = storedPatterns.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastUsed: new Date(p.lastUsed),
        }));
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem("self-learning-patterns");
        if (stored) {
          patterns.value = JSON.parse(stored).map((p: any) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            lastUsed: new Date(p.lastUsed),
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load stored patterns:", error);
    }
  };

  const savePatterns = async () => {
    try {
      // Save to IndexedDB
      await indexedDBPersistence.savePatterns(patterns.value);

      // Also save to localStorage as backup
      localStorage.setItem("self-learning-patterns", JSON.stringify(patterns.value));
    } catch (error) {
      console.error("Failed to save patterns:", error);
      // Fallback to localStorage only
      try {
        localStorage.setItem("self-learning-patterns", JSON.stringify(patterns.value));
      } catch (lsError) {
        console.error("Failed to save patterns to localStorage:", lsError);
      }
    }
  };

  const recordUsageEvent = (event: Omit<UsageEvent, "id">) => {
    if (!isLearning.value) return;

    const usageEvent: UsageEvent = {
      id: generateId(),
      ...event,
    };

    usageEvents.value.push(usageEvent);

    // Keep only recent events (last 1000)
    if (usageEvents.value.length > 1000) {
      usageEvents.value = usageEvents.value.slice(-1000);
    }

    // Trigger pattern analysis if enough events
    if (usageEvents.value.length % 10 === 0) {
      analyzePatterns();
    }
  };

  const analyzePatterns = async () => {
    if (!isLearning.value) return;

    const newPatterns = await detectPatterns();
    const existingPatterns = patterns.value;

    // Merge new patterns with existing ones
    for (const newPattern of newPatterns) {
      const existing = existingPatterns.find(
        (p) =>
          p.type === newPattern.type && JSON.stringify(p.data) === JSON.stringify(newPattern.data)
      );

      if (existing) {
        // Update existing pattern
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        existing.frequency++;
        existing.lastUsed = new Date();
      } else if (newPattern.confidence >= learningConfig.value.minConfidence) {
        // Add new pattern if it meets confidence threshold
        patterns.value.push(newPattern);
      }
    }

    // Remove patterns that don't meet frequency threshold
    patterns.value = patterns.value.filter((p) => p.frequency >= learningConfig.value.minFrequency);

    // Keep only the most confident patterns
    patterns.value.sort((a, b) => b.confidence - a.confidence);
    patterns.value = patterns.value.slice(0, learningConfig.value.maxPatterns);

    await savePatterns();
    await generateRecommendations();
    lastAnalysis.value = new Date();
  };

  const generateRecommendations = async (): Promise<Recommendation[]> => {
    const recs: Recommendation[] = [];

    // Generate cleanup recommendations
    const cleanupRecs = generateCleanupRecommendations();
    recs.push(...cleanupRecs);

    // Generate organization recommendations
    const orgRecs = generateOrganizationRecommendations();
    recs.push(...orgRecs);

    // Generate access shortcut recommendations
    const shortcutRecs = generateShortcutRecommendations();
    recs.push(...shortcutRecs);

    // Generate schedule recommendations
    const scheduleRecs = generateScheduleRecommendations();
    recs.push(...scheduleRecs);

    // Sort by score and limit
    recs.sort((a, b) => b.score - a.score);
    recommendations.value = recs.slice(0, learningConfig.value.maxRecommendations);

    return recommendations.value;
  };

  const detectPatterns = async (): Promise<LearningPattern[]> => {
    const detected: LearningPattern[] = [];

    // Detect file access patterns
    const fileAccessPatterns = detectFileAccessPatterns();
    detected.push(...fileAccessPatterns);

    // Detect directory preference patterns
    const directoryPatterns = detectDirectoryPatterns();
    detected.push(...directoryPatterns);

    // Detect time-based patterns
    const timePatterns = detectTimePatterns();
    detected.push(...timePatterns);

    // Detect cleanup habit patterns
    const cleanupPatterns = detectCleanupPatterns();
    detected.push(...cleanupPatterns);

    return detected;
  };

  const detectFileAccessPatterns = (): LearningPattern[] => {
    const patterns: LearningPattern[] = [];
    const fileEvents = usageEvents.value.filter((e) => e.type === "file-access");

    // Group by file extensions with temporal analysis
    const extensionGroups = fileEvents.reduce(
      (groups, event) => {
        const ext = event.data.extension || "unknown";
        if (!groups[ext]) groups[ext] = [];
        groups[ext].push(event);
        return groups;
      },
      {} as Record<string, UsageEvent[]>
    );

    // Detect high-frequency file types with temporal clustering
    Object.entries(extensionGroups).forEach(([extension, events]) => {
      if (events.length >= 5) {
        // Calculate temporal consistency
        const timeSpans = events
          .slice(1)
          .map((event, i) => event.timestamp.getTime() - events[i].timestamp.getTime());
        const avgTimeSpan = timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length;
        const timeVariance =
          timeSpans.reduce((sum, span) => sum + Math.pow(span - avgTimeSpan, 2), 0) /
          timeSpans.length;

        // Enhanced confidence calculation
        const frequencyScore = Math.min(1, events.length / 20);
        const consistencyScore = Math.max(0, 1 - timeVariance / (avgTimeSpan * avgTimeSpan));
        const recencyScore = Math.max(
          0,
          1 -
            (Date.now() - events[events.length - 1].timestamp.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );

        const confidence = frequencyScore * 0.4 + consistencyScore * 0.4 + recencyScore * 0.2;

        patterns.push({
          id: generateId(),
          type: "file-access",
          description: `Frequently access ${extension} files (${events.length} times, ${Math.round(confidence * 100)}% confidence)`,
          confidence,
          frequency: events.length,
          data: {
            extension,
            count: events.length,
            avgTimeSpan,
            consistencyScore,
            lastAccess: events[events.length - 1].timestamp,
          },
          createdAt: new Date(),
          lastUsed: new Date(),
        });
      }
    });

    // Detect file size preferences
    const sizeGroups = fileEvents.reduce(
      (groups, event) => {
        const size = event.data.size || 0;
        const sizeCategory =
          size < 1024 * 1024 ? "small" : size < 1024 * 1024 * 100 ? "medium" : "large";
        if (!groups[sizeCategory]) groups[sizeCategory] = [];
        groups[sizeCategory].push(event);
        return groups;
      },
      {} as Record<string, UsageEvent[]>
    );

    Object.entries(sizeGroups).forEach(([sizeCategory, events]) => {
      if (events.length >= 3) {
        const confidence = Math.min(1, events.length / 15);
        patterns.push({
          id: generateId(),
          type: "file-access",
          description: `Prefer ${sizeCategory} files (${events.length} times)`,
          confidence: confidence * 0.8, // Lower weight for size patterns
          frequency: events.length,
          data: { sizeCategory, count: events.length },
          createdAt: new Date(),
          lastUsed: new Date(),
        });
      }
    });

    return patterns;
  };

  const detectDirectoryPatterns = (): LearningPattern[] => {
    const patterns: LearningPattern[] = [];
    const navEvents = usageEvents.value.filter((e) => e.type === "directory-navigation");

    // Group by directory paths with depth analysis
    const directoryGroups = navEvents.reduce(
      (groups, event) => {
        const path = event.data.path || "unknown";
        if (!groups[path]) groups[path] = [];
        groups[path].push(event);
        return groups;
      },
      {} as Record<string, UsageEvent[]>
    );

    // Detect frequently accessed directories with depth and temporal analysis
    Object.entries(directoryGroups).forEach(([path, events]) => {
      if (events.length >= 3) {
        // Calculate directory depth
        const depth = path.split("/").length;
        const timeSpans = events
          .slice(1)
          .map((event, i) => event.timestamp.getTime() - events[i].timestamp.getTime());
        const avgTimeSpan = timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length;

        // Enhanced confidence with depth and temporal factors
        const frequencyScore = Math.min(1, events.length / 15);
        const depthScore = depth <= 3 ? 1 : Math.max(0, 1 - (depth - 3) * 0.2); // Prefer shallow directories
        const recencyScore = Math.max(
          0,
          1 -
            (Date.now() - events[events.length - 1].timestamp.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );

        const confidence = frequencyScore * 0.5 + depthScore * 0.3 + recencyScore * 0.2;

        patterns.push({
          id: generateId(),
          type: "directory-preference",
          description: `Frequently access ${path} (${events.length} times, depth ${depth})`,
          confidence,
          frequency: events.length,
          data: {
            path,
            count: events.length,
            depth,
            avgTimeSpan,
            lastAccess: events[events.length - 1].timestamp,
          },
          createdAt: new Date(),
          lastUsed: new Date(),
        });
      }
    });

    // Detect directory traversal patterns
    const traversalPatterns = detectDirectoryTraversalPatterns(navEvents);
    patterns.push(...traversalPatterns);

    // Detect project workspace patterns
    const workspacePatterns = detectWorkspacePatterns(navEvents);
    patterns.push(...workspacePatterns);

    return patterns;
  };

  const detectDirectoryTraversalPatterns = (navEvents: UsageEvent[]): LearningPattern[] => {
    const patterns: LearningPattern[] = [];

    // Analyze sequential directory navigation
    for (let i = 1; i < navEvents.length; i++) {
      const current = navEvents[i];
      const previous = navEvents[i - 1];

      const currentPath = current.data.path || "";
      const previousPath = previous.data.path || "";

      // Check if it's a parent-child relationship
      if (currentPath.startsWith(previousPath) && currentPath !== previousPath) {
        const depthDiff = currentPath.split("/").length - previousPath.split("/").length;

        if (depthDiff === 1) {
          // Going deeper
          patterns.push({
            id: generateId(),
            type: "directory-preference",
            description: `Navigate deeper into ${previousPath} → ${currentPath}`,
            confidence: 0.6,
            frequency: 1,
            data: {
              from: previousPath,
              to: currentPath,
              type: "deeper",
            },
            createdAt: new Date(),
            lastUsed: new Date(),
          });
        }
      }
    }

    return patterns;
  };

  const detectWorkspacePatterns = (navEvents: UsageEvent[]): LearningPattern[] => {
    const patterns: LearningPattern[] = [];

    // Group by parent directories to identify workspaces
    const parentGroups = navEvents.reduce(
      (groups, event) => {
        const path = event.data.path || "";
        const parts = path.split("/");
        if (parts.length >= 2) {
          const parent = parts.slice(0, 2).join("/");
          if (!groups[parent]) groups[parent] = [];
          groups[parent].push(event);
        }
        return groups;
      },
      {} as Record<string, UsageEvent[]>
    );

    Object.entries(parentGroups).forEach(([parentPath, events]) => {
      if (events.length >= 5) {
        const uniqueSubdirs = new Set(
          events.map((e) => {
            const path = e.data.path || "";
            const parts = path.split("/");
            return parts.length > 2 ? parts.slice(0, 3).join("/") : path;
          })
        );

        if (uniqueSubdirs.size >= 3) {
          patterns.push({
            id: generateId(),
            type: "directory-preference",
            description: `Active workspace: ${parentPath} (${uniqueSubdirs.size} subdirectories)`,
            confidence: 0.7,
            frequency: events.length,
            data: {
              workspace: parentPath,
              subdirectoryCount: uniqueSubdirs.size,
              totalEvents: events.length,
            },
            createdAt: new Date(),
            lastUsed: new Date(),
          });
        }
      }
    });

    return patterns;
  };

  const detectTimePatterns = (): LearningPattern[] => {
    const patterns: LearningPattern[] = [];
    const allEvents = usageEvents.value;

    // Group by hour of day
    const hourGroups = allEvents.reduce(
      (groups, event) => {
        const hour = event.timestamp.getHours();
        if (!groups[hour]) groups[hour] = [];
        groups[hour].push(event);
        return groups;
      },
      {} as Record<number, UsageEvent[]>
    );

    // Detect peak usage hours
    Object.entries(hourGroups).forEach(([hour, events]) => {
      if (events.length >= 10) {
        const confidence = Math.min(1, events.length / 50);
        patterns.push({
          id: generateId(),
          type: "time-pattern",
          description: `Most active at ${hour}:00 (${events.length} activities)`,
          confidence,
          frequency: events.length,
          data: { hour: parseInt(hour), count: events.length },
          createdAt: new Date(),
          lastUsed: new Date(),
        });
      }
    });

    return patterns;
  };

  const detectCleanupPatterns = (): LearningPattern[] => {
    const patterns: LearningPattern[] = [];
    const cleanupEvents = usageEvents.value.filter((e) => e.type === "cleanup-action");

    // Group by cleanup type
    const cleanupGroups = cleanupEvents.reduce(
      (groups, event) => {
        const type = event.data.action || "unknown";
        if (!groups[type]) groups[type] = [];
        groups[type].push(event);
        return groups;
      },
      {} as Record<string, UsageEvent[]>
    );

    // Detect cleanup habits
    Object.entries(cleanupGroups).forEach(([type, events]) => {
      if (events.length >= 2) {
        const confidence = Math.min(1, events.length / 8);
        patterns.push({
          id: generateId(),
          type: "cleanup-habit",
          description: `Regularly perform ${type} cleanup (${events.length} times)`,
          confidence,
          frequency: events.length,
          data: { action: type, count: events.length },
          createdAt: new Date(),
          lastUsed: new Date(),
        });
      }
    });
    // Generate access shortcut recommendations
    const shortcutRecs = generateShortcutRecommendations();
    recs.push(...shortcutRecs);

    // Generate schedule recommendations
    const scheduleRecs = generateScheduleRecommendations();
    recs.push(...scheduleRecs);

    // Sort by score and limit
    recs.sort((a, b) => b.score - a.score);
    recommendations.value = recs.slice(0, learningConfig.value.maxRecommendations);

    return recommendations.value;
  };

  const generateCleanupRecommendations = (): Recommendation[] => {
    const recs: Recommendation[] = [];

    // Find directories with high file counts that haven't been cleaned
    const directoryPatterns = patterns.value.filter((p) => p.type === "directory-preference");
    directoryPatterns.forEach((pattern) => {
      if (pattern.frequency > 10 && pattern.confidence > 0.8) {
        recs.push({
          id: generateId(),
          type: "cleanup",
          title: `Clean up ${pattern.data.path}`,
          description: `You access this directory frequently. Consider organizing or cleaning up old files.`,
          score: pattern.confidence * 0.9,
          priority: pattern.confidence > 0.9 ? "high" : "medium",
          actions: [
            { type: "scan-directory", path: pattern.data.path },
            { type: "suggest-cleanup", path: pattern.data.path },
          ],
        });
      }
    });

    return recs;
  };

  const generateOrganizationRecommendations = (): Recommendation[] => {
    const recs: Recommendation[] = [];

    // Suggest creating shortcuts for frequently accessed directories
    const directoryPatterns = patterns.value.filter(
      (p) => p.type === "directory-preference" && p.confidence > 0.8
    );

    directoryPatterns.slice(0, 3).forEach((pattern) => {
      recs.push({
        id: generateId(),
        type: "organization",
        title: `Create shortcut for ${pattern.data.path}`,
        description: `You access this directory ${pattern.frequency} times. Create a shortcut for faster access.`,
        score: pattern.confidence * 0.8,
        priority: "medium",
        actions: [{ type: "create-shortcut", path: pattern.data.path }],
      });
    });

    return recs;
  };

  const generateShortcutRecommendations = (): Recommendation[] => {
    const recs: Recommendation[] = [];

    // Suggest file type shortcuts
    const filePatterns = patterns.value.filter((p) => p.type === "file-access");
    filePatterns.forEach((pattern) => {
      if (pattern.frequency > 15) {
        recs.push({
          id: generateId(),
          type: "access-shortcut",
          title: `${pattern.data.extension} files quick access`,
          description: `Create a quick filter for ${pattern.data.extension} files you access frequently.`,
          score: pattern.confidence * 0.7,
          priority: "low",
          actions: [{ type: "create-filter", extension: pattern.data.extension }],
        });
      }
    });

    return recs;
  };

  const generateScheduleRecommendations = (): Recommendation[] => {
    const recs: Recommendation[] = [];

    // Suggest automated cleanup schedules
    const timePatterns = patterns.value.filter((p) => p.type === "time-pattern");
    timePatterns.forEach((pattern) => {
      if (pattern.frequency > 20) {
        recs.push({
          id: generateId(),
          type: "schedule",
          title: `Schedule cleanup at ${pattern.data.hour}:00`,
          description: `You're most active at ${pattern.data.hour}:00. Schedule automatic cleanup during this time.`,
          score: pattern.confidence * 0.6,
          priority: "low",
          actions: [{ type: "schedule-cleanup", hour: pattern.data.hour }],
        });
      }
    });

    return recs;
  };

  const applyPattern = async (patternId: string) => {
    const pattern = patterns.value.find((p) => p.id === patternId);
    if (pattern) {
      pattern.frequency++;
      pattern.lastUsed = new Date();
      await savePatterns();
    }
  };

  const acceptRecommendation = async (recommendationId: string) => {
    const recommendation = recommendations.value.find((r) => r.id === recommendationId);
    if (recommendation) {
      // Execute recommendation actions
      for (const action of recommendation.actions) {
        await executeRecommendationAction(action);
      }

      // Update ML model with feedback
      mlRecommendationEngine.updateModel({
        recommendationId,
        action: "accepted",
        timestamp: new Date(),
        context: { recommendation },
      });

      // Save feedback to IndexedDB for analytics
      await indexedDBPersistence.saveAnalyticsData({
        type: "model-feedback",
        feedback: {
          recommendationId,
          action: "accepted",
          timestamp: new Date(),
          context: { recommendation },
        },
        timestamp: new Date(),
        context: { recommendation },
      });
    }
  };

  const dismissRecommendation = async (recommendationId: string) => {
    recommendations.value = recommendations.value.filter((r) => r.id !== recommendationId);

    // Record feedback for ML model
    mlRecommendationEngine.updateModel({
      recommendationId,
      action: "dismissed",
      timestamp: new Date(),
      context: { recommendation: recommendations.value.find((r) => r.id === recommendationId) },
    });

    // Record the dismissal as a usage event
    recordUsageEvent({
      type: "cleanup-action",
      timestamp: new Date(),
      data: { action: "recommendation-dismissed", recommendationId },
      context: {},
    });
  };

  const executeRecommendationAction = async (action: any) => {
    // Implementation would depend on the specific action type
    console.log("Executing recommendation action:", action);
  };

  const resetPatterns = async () => {
    patterns.value = [];
    recommendations.value = [];
    usageEvents.value = [];
    localStorage.removeItem("self-learning-patterns");
  };

  const exportPatterns = async () => {
    return {
      patterns: patterns.value,
      recommendations: recommendations.value,
      config: learningConfig.value,
      exportedAt: new Date(),
    };
  };

  const startEventTracking = () => {
    // Set up global event listeners
    // This would be implemented based on the application's event system
  };

  const stopEventTracking = () => {
    // Remove global event listeners
  };

  let analysisInterval: NodeJS.Timeout | null = null;

  const startPatternAnalysis = () => {
    analysisInterval = setInterval(() => {
      analyzePatterns();
    }, learningConfig.value.analysisInterval);
  };

  const stopPatternAnalysis = () => {
    if (analysisInterval) {
      clearInterval(analysisInterval);
      analysisInterval = null;
    }
  };

  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const updateModel = async (feedback: any) => {
    // Update ML model with user feedback
    mlRecommendationEngine.updateModel(feedback);
    await savePatterns();
  };

  const updateAdaptiveLearningRate = async (performance: number) => {
    // Adjust learning rate based on performance metrics
    adaptiveLearningRate.adjust(performance);
  };

  const evaluateABTestingOpportunity = (context: any) => {
    // Evaluate if A/B testing would be beneficial
    return abTestingFramework.evaluateOpportunity(context);
  };

  return {
    // State
    patterns: getPatterns,
    recommendations: getRecommendations,
    isLearning: getIsLearning,

    // Actions
    startLearning,
    stopLearning,
    recordUsageEvent,
    generateRecommendations,
    applyPattern,
    acceptRecommendation,
    dismissRecommendation,
    resetPatterns,
    exportPatterns,

    // ML Features
    getModelAccuracy: () => mlRecommendationEngine.getModelAccuracy(),
    updateModel,

    // Advanced Features
    updateAdaptiveLearningRate,
    evaluateABTestingOpportunity,
    getCurrentLearningRate: () => adaptiveLearningRate.getCurrentRate(),
    getActiveABTests: () => abTestingFramework.getActiveTests(),
    createABTest: (config: any) => abTestingFramework.createTest(config),
  };
});
