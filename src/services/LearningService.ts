/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

interface UserAction {
  action: string;
  view: string;
  timestamp: Date;
  context?: any;
}

interface LearningPattern {
  feature: string;
  usageCount: number;
  lastUsed: Date;
  proficiency: "beginner" | "intermediate" | "advanced";
}

interface FeatureDiscovery {
  feature: string;
  hint: string;
  trigger: "time" | "action" | "view";
  condition?: (context: any) => boolean;
  shown: boolean;
}

export class LearningService {
  private static instance: LearningService;
  private actions: UserAction[] = [];
  private patterns: Map<string, LearningPattern> = new Map();
  private discoveries: FeatureDiscovery[] = [
    {
      feature: "ai-chat",
      hint: "💡 Try asking the AI assistant questions about your file system!",
      trigger: "view",
      condition: (context) => context.view === "dashboard" && context.timeSpent > 30000, // 30 seconds
      shown: false,
    },
    {
      feature: "file-operations",
      hint: "💡 You can select multiple files and perform bulk operations!",
      trigger: "action",
      condition: (context) => context.action === "view-browser" && context.timeSpent > 20000,
      shown: false,
    },
    {
      feature: "visualizations",
      hint: "💡 Explore different visualization modes to understand your data better!",
      trigger: "time",
      condition: (context) => context.totalTime > 120000, // 2 minutes total usage
      shown: false,
    },
    {
      feature: "export",
      hint: "💡 Don't forget to export your analysis results for sharing!",
      trigger: "action",
      condition: (context) => context.completedAnalyses > 2,
      shown: false,
    },
  ];

  static getInstance(): LearningService {
    if (!LearningService.instance) {
      LearningService.instance = new LearningService();
    }
    return LearningService.instance;
  }

  trackAction(action: string, view: string, context?: any): void {
    const userAction: UserAction = {
      action,
      view,
      timestamp: new Date(),
      context,
    };

    this.actions.push(userAction);

    // Maintain action history (keep last 100 actions)
    if (this.actions.length > 100) {
      this.actions = this.actions.slice(-100);
    }

    // Update learning patterns
    this.updatePattern(action, view);

    // Auto-save to localStorage
    this.persistData();
  }

  trackAnalysis(directoryPath: string, analysisResult: any): void {
    // Track analysis completion as a special action
    const userAction: UserAction = {
      action: "analysis-complete",
      view: "dashboard",
      timestamp: new Date(),
      context: {
        directoryPath,
        totalFiles: analysisResult.totalFiles,
        totalSize: analysisResult.totalSize,
        analysisType: analysisResult.analysisType,
        analysisTime: analysisResult.analysisTime,
      },
    };

    this.actions.push(userAction);

    // Update learning patterns for analysis
    this.updatePattern("analysis-complete", "dashboard");

    // Store analysis data in localStorage for future reference
    try {
      const analysisHistory = JSON.parse(
        localStorage.getItem("spaceAnalyzer_analysisHistory") || "[]"
      );
      analysisHistory.push({
        directoryPath,
        timestamp: new Date().toISOString(),
        totalFiles: analysisResult.totalFiles,
        totalSize: analysisResult.totalSize,
        analysisType: analysisResult.analysisType,
      });

      // Keep only last 10 analyses
      if (analysisHistory.length > 10) {
        analysisHistory.shift();
      }

      localStorage.setItem("spaceAnalyzer_analysisHistory", JSON.stringify(analysisHistory));
    } catch (error) {
      console.warn("Failed to store analysis history:", error);
    }

    // Auto-save to localStorage
    this.persistData();
  }

  private updatePattern(action: string, view: string): void {
    const key = `${action}-${view}`;
    const existing = this.patterns.get(key);

    if (existing) {
      existing.usageCount++;
      existing.lastUsed = new Date();
      existing.proficiency = this.calculateProficiency(existing.usageCount);
    } else {
      this.patterns.set(key, {
        feature: key,
        usageCount: 1,
        lastUsed: new Date(),
        proficiency: "beginner",
      });
    }
  }

  private calculateProficiency(usageCount: number): "beginner" | "intermediate" | "advanced" {
    if (usageCount >= 10) return "advanced";
    if (usageCount >= 3) return "intermediate";
    return "beginner";
  }

  getFeatureDiscovery(view: string, context: any): FeatureDiscovery | null {
    const sessionStart = new Date();
    sessionStart.setHours(0, 0, 0, 0);

    const todayActions = this.actions.filter((a) => a.timestamp >= sessionStart);
    const totalTime = context.totalTime || 0;

    for (const discovery of this.discoveries) {
      if (discovery.shown) continue;

      const discoveryContext = {
        ...context,
        view,
        timeSpent: context.viewTime || 0,
        totalTime,
        completedAnalyses: context.completedAnalyses || 0,
      };

      if (discovery.condition && discovery.condition(discoveryContext)) {
        discovery.shown = true;
        this.persistData();
        return discovery;
      }
    }

    return null;
  }

  getPersonalizedSuggestions(): string[] {
    const suggestions: string[] = [];
    const patterns = Array.from(this.patterns.values());

    // Suggest underused features
    const underusedFeatures = patterns.filter((p) => p.usageCount < 3);
    if (underusedFeatures.length > 0) {
      suggestions.push("💡 Try exploring some features you haven't used much yet!");
    }

    // Suggest based on time of day
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      suggestions.push("💼 Great time for detailed analysis work!");
    }

    // Suggest based on recent activity
    const recentActions = this.actions.slice(-5);
    const uniqueViews = new Set(recentActions.map((a) => a.view));
    if (uniqueViews.size >= 3) {
      suggestions.push("🔄 You're exploring many features - that's great!");
    }

    return suggestions;
  }

  getUsageStats(): {
    totalActions: number;
    favoriteView: string;
    sessionCount: number;
    averageSessionTime: number;
  } {
    const viewCounts: { [key: string]: number } = {};
    this.actions.forEach((action) => {
      viewCounts[action.view] = (viewCounts[action.view] || 0) + 1;
    });

    const favoriteView =
      Object.entries(viewCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "dashboard";

    // Estimate sessions (group actions within 30 minutes)
    let sessions = 0;
    let lastActionTime = 0;
    this.actions.forEach((action) => {
      const actionTime = action.timestamp.getTime();
      if (actionTime - lastActionTime > 30 * 60 * 1000) {
        // 30 minutes
        sessions++;
      }
      lastActionTime = actionTime;
    });

    const totalTime =
      this.actions.length > 1
        ? this.actions[this.actions.length - 1].timestamp.getTime() -
          this.actions[0].timestamp.getTime()
        : 0;
    const averageSessionTime = sessions > 0 ? totalTime / sessions : 0;

    return {
      totalActions: this.actions.length,
      favoriteView,
      sessionCount: Math.max(1, sessions),
      averageSessionTime,
    };
  }

  private persistData(): void {
    try {
      const data = {
        actions: this.actions,
        patterns: Array.from(this.patterns.entries()),
        discoveries: this.discoveries,
      };
      localStorage.setItem("spaceAnalyzer_learning", JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to persist learning data:", error);
    }
  }

  private loadData(): void {
    try {
      const data = localStorage.getItem("spaceAnalyzer_learning");
      if (data) {
        const parsed = JSON.parse(data);
        this.actions = parsed.actions.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }));
        this.patterns = new Map(parsed.patterns);
        this.discoveries = parsed.discoveries;
      }
    } catch (error) {
      console.warn("Failed to load learning data:", error);
    }
  }

  constructor() {
    this.loadData();
  }
}

export const learningService = LearningService.getInstance();
