// Statistics Calculator
// Calculates comprehensive statistics for optimization suggestions

import { OptimizationSuggestion, OptimizationStatistics } from './interfaces';

export class StatisticsCalculator {
  getOptimizationStatistics(suggestions: OptimizationSuggestion[]): OptimizationStatistics {
    const stats = {
      total: suggestions.length,
      byType: {} as { [key: string]: number },
      byEffort: {} as { [key: string]: number },
      byRisk: {} as { [key: string]: number },
      automated: 0,
      manual: 0,
      totalImpact: {
        complexityReduction: 0,
        maintainabilityImprovement: 0,
        sizeReduction: 0,
        couplingReduction: 0
      }
    };
    
    suggestions.forEach(suggestion => {
      // Count by type
      stats.byType[suggestion.type] = (stats.byType[suggestion.type] || 0) + 1;
      
      // Count by effort
      stats.byEffort[suggestion.effort] = (stats.byEffort[suggestion.effort] || 0) + 1;
      
      // Count by risk
      stats.byRisk[suggestion.risk] = (stats.byRisk[suggestion.risk] || 0) + 1;
      
      // Count automated vs manual
      if (suggestion.automated) {
        stats.automated++;
      } else {
        stats.manual++;
      }
      
      // Sum impact
      stats.totalImpact.complexityReduction += suggestion.impact.complexityReduction;
      stats.totalImpact.maintainabilityImprovement += suggestion.impact.maintainabilityImprovement;
      stats.totalImpact.sizeReduction += suggestion.impact.sizeReduction;
      stats.totalImpact.couplingReduction += suggestion.impact.couplingReduction;
    });
    
    return stats;
  }

  getHighImpactSuggestions(suggestions: OptimizationSuggestion[], threshold: number = 0.3): OptimizationSuggestion[] {
    return suggestions.filter(suggestion => {
      const totalImpact = suggestion.impact.complexityReduction + 
                           suggestion.impact.maintainabilityImprovement + 
                           suggestion.impact.sizeReduction;
      return totalImpact >= threshold;
    });
  }

  getLowEffortSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions.filter(suggestion => suggestion.effort === 'low');
  }

  getAutomatedSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions.filter(suggestion => suggestion.automated);
  }

  getCriticalSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions.filter(suggestion => 
      suggestion.risk === 'high' || 
      suggestion.impact.complexityReduction > 0.4 ||
      suggestion.impact.maintainabilityImprovement > 0.4
    );
  }

  getQuickWins(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions.filter(suggestion => 
      suggestion.effort === 'low' && 
      suggestion.automated && 
      (suggestion.impact.complexityReduction > 0.1 || 
       suggestion.impact.maintainabilityImprovement > 0.1)
    );
  }

  getPriorityScore(suggestion: OptimizationSuggestion): number {
    // Calculate priority score based on impact, effort, and risk
    const impactScore = (suggestion.impact.complexityReduction + 
                        suggestion.impact.maintainabilityImprovement + 
                        suggestion.impact.sizeReduction) * 10;
    
    const effortPenalty = suggestion.effort === 'high' ? 5 : 
                         suggestion.effort === 'medium' ? 2 : 0;
    
    const riskPenalty = suggestion.risk === 'high' ? 3 : 
                       suggestion.risk === 'medium' ? 1 : 0;
    
    const automationBonus = suggestion.automated ? 2 : 0;
    
    return impactScore - effortPenalty - riskPenalty + automationBonus;
  }

  getSortedSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions.sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));
  }

  getImplementationPlan(suggestions: OptimizationSuggestion[]): {
    quickWins: OptimizationSuggestion[];
    mediumEffort: OptimizationSuggestion[];
    highEffort: OptimizationSuggestion[];
    automated: OptimizationSuggestion[];
    manual: OptimizationSuggestion[];
  } {
    const sorted = this.getSortedSuggestions(suggestions);
    
    return {
      quickWins: this.getQuickWins(sorted),
      mediumEffort: sorted.filter(s => s.effort === 'medium'),
      highEffort: sorted.filter(s => s.effort === 'high'),
      automated: this.getAutomatedSuggestions(sorted),
      manual: sorted.filter(s => !s.automated)
    };
  }

  getEstimatedTime(suggestions: OptimizationSuggestion[]): {
    total: number;
    automated: number;
    manual: number;
    breakdown: { [key: string]: number };
  } {
    const timeEstimates = {
      low: 1,    // 1 hour
      medium: 4, // 4 hours
      high: 8    // 8 hours
    };
    
    const breakdown: { [key: string]: number } = {};
    let totalTime = 0;
    let automatedTime = 0;
    let manualTime = 0;
    
    suggestions.forEach(suggestion => {
      const time = timeEstimates[suggestion.effort];
      breakdown[suggestion.effort] = (breakdown[suggestion.effort] || 0) + time;
      totalTime += time;
      
      if (suggestion.automated) {
        automatedTime += time * 0.3; // Automated takes 30% of manual time
      } else {
        manualTime += time;
      }
    });
    
    return {
      total: totalTime,
      automated: Math.round(automatedTime),
      manual: manualTime,
      breakdown
    };
  }
}