// Risk Assessment Service for Space Analyzer
// Implements predictive risk analysis for code changes

interface RiskFactor {
  type: 'complexity' | 'dependencies' | 'test-coverage' | 'technical-debt' | 'security' | 'performance';
  weight: number;
  score: number;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

interface ChangeRisk {
  overallRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  mitigation: string[];
  confidence: number;
  timestamp: number;
}

interface ChangeImpact {
  files: string[];
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  complexityChange: number;
  dependencyChange: number;
  testCoverageChange: number;
  securityImpact: number;
  performanceImpact: number;
}

interface RiskModel {
  name: string;
  version: string;
  trainedAt: number;
  accuracy: number;
  factors: string[];
  weights: { [key: string]: number };
}

interface RiskThreshold {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export class RiskAssessmentService {
  private riskModels: Map<string, RiskModel> = new Map();
  private riskThresholds: RiskThreshold = {
    low: 25,
    medium: 50,
    high: 75,
    critical: 90
  };
  private historicalData: Map<string, any[]> = new Map();
  private riskHistory: ChangeRisk[] = [];

  constructor() {
    this.initializeRiskModels();
    this.loadHistoricalData();
  }

  // Initialize risk assessment models
  private initializeRiskModels(): void {
    console.log('🔮 Initializing risk assessment models...');
    
    // Complexity risk model
    this.riskModels.set('complexity', {
      name: 'Complexity Risk Model',
      version: '1.0.0',
      trainedAt: Date.now(),
      accuracy: 0.87,
      factors: ['cyclomatic-complexity', 'cognitive-complexity', 'nesting-depth', 'method-length'],
      weights: {
        'cyclomatic-complexity': 0.4,
        'cognitive-complexity': 0.3,
        'nesting-depth': 0.2,
        'method-length': 0.1
      }
    });

    // Dependency risk model
    this.riskModels.set('dependencies', {
      name: 'Dependency Risk Model',
      version: '1.0.0',
      trainedAt: Date.now(),
      accuracy: 0.82,
      factors: ['coupling', 'cohesion', 'dependency-graph-complexity', 'external-dependencies'],
      weights: {
        'coupling': 0.3,
        'cohesion': 0.2,
        'dependency-graph-complexity': 0.3,
        'external-dependencies': 0.2
      }
    });

    // Test coverage risk model
    this.riskModels.set('test-coverage', {
      name: 'Test Coverage Risk Model',
      version: '1.0.0',
      trainedAt: Date.now(),
      accuracy: 0.79,
      factors: ['code-coverage', 'branch-coverage', 'test-complexity', 'test-age'],
      weights: {
        'code-coverage': 0.4,
        'branch-coverage': 0.3,
        'test-complexity': 0.2,
        'test-age': 0.1
      }
    });

    // Technical debt risk model
    this.riskModels.set('technical-debt', {
      name: 'Technical Debt Risk Model',
      version: '1.0.0',
      trainedAt: Date.now(),
      accuracy: 0.85,
      factors: ['code-smells', 'duplicated-code', 'maintainability-index', 'code-churn'],
      weights: {
        'code-smells': 0.3,
        'duplicated-code': 0.2,
        'maintainability-index': 0.3,
        'code-churn': 0.2
      }
    });

    // Security risk model
    this.riskModels.set('security', {
      name: 'Security Risk Model',
      version: '1.0.0',
      trainedAt: Date.now(),
      accuracy: 0.91,
      factors: ['vulnerabilities', 'sensitive-data', 'input-validation', 'authentication'],
      weights: {
        'vulnerabilities': 0.4,
        'sensitive-data': 0.3,
        'input-validation': 0.2,
        'authentication': 0.1
      }
    });

    // Performance risk model
    this.riskModels.set('performance', {
      name: 'Performance Risk Model',
      version: '1.0.0',
      trainedAt: Date.now(),
      accuracy: 0.83,
      factors: ['algorithm-complexity', 'memory-usage', 'io-operations', 'database-queries'],
      weights: {
        'algorithm-complexity': 0.3,
        'memory-usage': 0.2,
        'io-operations': 0.3,
        'database-queries': 0.2
      }
    });

    console.log(`✅ Initialized ${this.riskModels.size} risk assessment models`);
  }

  // Load historical data
  private loadHistoricalData(): void {
    console.log('📊 Loading historical risk data...');
    
    // In a real implementation, this would load from database
    // For now, we'll simulate historical data
    this.historicalData.set('complexity', this.generateHistoricalData('complexity', 100));
    this.historicalData.set('dependencies', this.generateHistoricalData('dependencies', 80));
    this.historicalData.set('test-coverage', this.generateHistoricalData('test-coverage', 60));
    this.historicalData.set('technical-debt', this.generateHistoricalData('technical-debt', 90));
    this.historicalData.set('security', this.generateHistoricalData('security', 70));
    this.historicalData.set('performance', this.generateHistoricalData('performance', 85));
    
    console.log('✅ Historical data loaded');
  }

  // Generate historical data (simulation)
  private generateHistoricalData(type: string, count: number): any[] {
    const data = [];
    
    for (let i = 0; i < count; i++) {
      data.push({
        timestamp: Date.now() - (i * 24 * 60 * 60 * 1000), // Daily data
        score: Math.random() * 100,
        factors: this.generateRandomFactors(type),
        outcome: Math.random() > 0.7 ? 'issue' : 'success'
      });
    }
    
    return data;
  }

  // Generate random factors for simulation
  private generateRandomFactors(type: string): any {
    const model = this.riskModels.get(type);
    if (!model) return {};
    
    const factors: any = {};
    model.factors.forEach(factor => {
      factors[factor] = Math.random() * 100;
    });
    
    return factors;
  }

  // Assess risk for code changes
  async assessChangeRisk(changeImpact: ChangeImpact, context: any = {}): Promise<ChangeRisk> {
    console.log('🔮 Assessing risk for code changes...');
    
    const startTime = Date.now();
    
    // Calculate risk factors
    const riskFactors: RiskFactor[] = [];
    
    // Complexity risk
    const complexityRisk = await this.assessComplexityRisk(changeImpact, context);
    riskFactors.push(complexityRisk);
    
    // Dependency risk
    const dependencyRisk = await this.assessDependencyRisk(changeImpact, context);
    riskFactors.push(dependencyRisk);
    
    // Test coverage risk
    const testCoverageRisk = await this.assessTestCoverageRisk(changeImpact, context);
    riskFactors.push(testCoverageRisk);
    
    // Technical debt risk
    const technicalDebtRisk = await this.assessTechnicalDebtRisk(changeImpact, context);
    riskFactors.push(technicalDebtRisk);
    
    // Security risk
    const securityRisk = await this.assessSecurityRisk(changeImpact, context);
    riskFactors.push(securityRisk);
    
    // Performance risk
    const performanceRisk = await this.assessPerformanceRisk(changeImpact, context);
    riskFactors.push(performanceRisk);
    
    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(riskFactors);
    
    // Determine risk level
    const riskLevel = this.getRiskLevel(overallRisk);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(riskFactors);
    
    // Generate mitigation strategies
    const mitigation = this.generateMitigationStrategies(riskFactors);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(riskFactors);
    
    const risk: ChangeRisk = {
      overallRisk,
      riskLevel,
      factors: riskFactors,
      recommendations,
      mitigation,
      confidence,
      timestamp: Date.now()
    };
    
    // Store risk assessment
    this.riskHistory.push(risk);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Risk assessment completed in ${duration}ms`);
    console.log(`📊 Overall risk: ${overallRisk.toFixed(1)}% (${riskLevel})`);
    
    return risk;
  }

  // Assess complexity risk
  private async assessComplexityRisk(changeImpact: ChangeImpact, context: any): Promise<RiskFactor> {
    const model = this.riskModels.get('complexity');
    if (!model) throw new Error('Complexity risk model not found');
    
    // Calculate complexity metrics
    const metrics = {
      'cyclomatic-complexity': this.calculateCyclomaticComplexity(changeImpact),
      'cognitive-complexity': this.calculateCognitiveComplexity(changeImpact),
      'nesting-depth': this.calculateNestingDepth(changeImpact),
      'method-length': this.calculateMethodLength(changeImpact)
    };
    
    // Calculate weighted score
    let score = 0;
    Object.entries(model.weights).forEach(([factor, weight]) => {
      score += (metrics[factor] || 0) * weight;
    });
    
    // Normalize to 0-100 scale
    score = Math.min(100, score);
    
    // Determine impact
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score > 75) impact = 'critical';
    else if (score > 50) impact = 'high';
    else if (score > 25) impact = 'medium';
    
    return {
      type: 'complexity',
      weight: model.weights['cyclomatic-complexity'],
      score,
      description: `Complexity risk: ${score.toFixed(1)}% - ${metrics['cyclomatic-complexity']} cyclomatic complexity`,
      impact
    };
  }

  // Assess dependency risk
  private async assessDependencyRisk(changeImpact: ChangeImpact, context: any): Promise<RiskFactor> {
    const model = this.riskModels.get('dependencies');
    if (!model) throw new Error('Dependency risk model not found');
    
    // Calculate dependency metrics
    const metrics = {
      'coupling': this.calculateCoupling(changeImpact),
      'cohesion': this.calculateCohesion(changeImpact),
      'dependency-graph-complexity': this.calculateDependencyGraphComplexity(changeImpact),
      'external-dependencies': this.calculateExternalDependencies(changeImpact)
    };
    
    // Calculate weighted score
    let score = 0;
    Object.entries(model.weights).forEach(([factor, weight]) => {
      score += (metrics[factor] || 0) * weight;
    });
    
    // Normalize to 0-100 scale
    score = Math.min(100, score);
    
    // Determine impact
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score > 80) impact = 'critical';
    else if (score > 60) impact = 'high';
    else if (score > 40) impact = 'medium';
    
    return {
      type: 'dependencies',
      weight: model.weights['coupling'],
      score,
      description: `Dependency risk: ${score.toFixed(1)}% - ${metrics['coupling']} coupling score`,
      impact
    };
  }

  // Assess test coverage risk
  private async assessTestCoverageRisk(changeImpact: ChangeImpact, context: any): Promise<RiskFactor> {
    const model = this.riskModels.get('test-coverage');
    if (!model) throw new Error('Test coverage risk model not found');
    
    // Calculate test coverage metrics
    const metrics = {
      'code-coverage': this.calculateCodeCoverage(changeImpact),
      'branch-coverage': this.calculateBranchCoverage(changeImpact),
      'test-complexity': this.calculateTestComplexity(changeImpact),
      'test-age': this.calculateTestAge(changeImpact)
    };
    
    // Calculate weighted score (inverted for coverage - higher coverage = lower risk)
    let score = 0;
    Object.entries(model.weights).forEach(([factor, weight]) => {
      const invertedScore = factor === 'test-age' ? metrics[factor] : 100 - (metrics[factor] || 0);
      score += invertedScore * weight;
    });
    
    // Normalize to 0-100 scale
    score = Math.min(100, score);
    
    // Determine impact
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score > 85) impact = 'critical';
    else if (score > 70) impact = 'high';
    else if (score > 50) impact = 'medium';
    
    return {
      type: 'test-coverage',
      weight: model.weights['code-coverage'],
      score,
      description: `Test coverage risk: ${score.toFixed(1)}% - ${metrics['code-coverage']}% code coverage`,
      impact
    };
  }

  // Assess technical debt risk
  private async assessTechnicalDebtRisk(changeImpact: ChangeImpact, context: any): Promise<RiskFactor> {
    const model = this.riskModels.get('technical-debt');
    if (!model) throw new Error('Technical debt risk model not found');
    
    // Calculate technical debt metrics
    const metrics = {
      'code-smells': this.calculateCodeSmells(changeImpact),
      'duplicated-code': this.calculateDuplicatedCode(changeImpact),
      'maintainability-index': this.calculateMaintainabilityIndex(changeImpact),
      'code-churn': this.calculateCodeChurn(changeImpact)
    };
    
    // Calculate weighted score
    let score = 0;
    Object.entries(model.weights).forEach(([factor, weight]) => {
      score += (metrics[factor] || 0) * weight;
    });
    
    // Normalize to 0-100 scale
    score = Math.min(100, score);
    
    // Determine impact
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score > 80) impact = 'critical';
    else if (score > 60) impact = 'high';
    else if (score > 40) impact = 'medium';
    
    return {
      type: 'technical-debt',
      weight: model.weights['code-smells'],
      score,
      description: `Technical debt risk: ${score.toFixed(1)}% - ${metrics['code-smells']} code smells`,
      impact
    };
  }

  // Assess security risk
  private async assessSecurityRisk(changeImpact: ChangeImpact, context: any): Promise<RiskFactor> {
    const model = this.riskModels.get('security');
    if (!model) throw new Error('Security risk model not found');
    
    // Calculate security metrics
    const metrics = {
      'vulnerabilities': this.calculateVulnerabilities(changeImpact),
      'sensitive-data': this.calculateSensitiveData(changeImpact),
      'input-validation': this.calculateInputValidation(changeImpact),
      'authentication': this.calculateAuthentication(changeImpact)
    };
    
    // Calculate weighted score
    let score = 0;
    Object.entries(model.weights).forEach(([factor, weight]) => {
      score += (metrics[factor] || 0) * weight;
    });
    
    // Normalize to 0-100 scale
    score = Math.min(100, score);
    
    // Determine impact
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score > 70) impact = 'critical';
    else if (score > 50) impact = 'high';
    else if (score > 30) impact = 'medium';
    
    return {
      type: 'security',
      weight: model.weights['vulnerabilities'],
      score,
      description: `Security risk: ${score.toFixed(1)}% - ${metrics['vulnerabilities']} vulnerabilities`,
      impact
    };
  }

  // Assess performance risk
  private async assessPerformanceRisk(changeImpact: ChangeImpact, context: any): Promise<RiskFactor> {
    const model = this.riskModels.get('performance');
    if (!model) throw new Error('Performance risk model not found');
    
    // Calculate performance metrics
    const metrics = {
      'algorithm-complexity': this.calculateAlgorithmComplexity(changeImpact),
      'memory-usage': this.calculateMemoryUsage(changeImpact),
      'io-operations': this.calculateIOOperations(changeImpact),
      'database-queries': this.calculateDatabaseQueries(changeImpact)
    };
    
    // Calculate weighted score
    let score = 0;
    Object.entries(model.weights).forEach(([factor, weight]) => {
      score += (metrics[factor] || 0) * weight;
    });
    
    // Normalize to 0-100 scale
    score = Math.min(100, score);
    
    // Determine impact
    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score > 75) impact = 'critical';
    else if (score > 55) impact = 'high';
    else if (score > 35) impact = 'medium';
    
    return {
      type: 'performance',
      weight: model.weights['algorithm-complexity'],
      score,
      description: `Performance risk: ${score.toFixed(1)}% - ${metrics['algorithm-complexity']} algorithm complexity`,
      impact
    };
  }

  // Calculate overall risk
  private calculateOverallRisk(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    factors.forEach(factor => {
      totalWeightedScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    });
    
    return totalWeight / totalWeight;
  }

  // Get risk level
  private getRiskLevel(risk: number): 'low' | 'medium' | 'high' | 'critical' {
    if (risk >= this.riskThresholds.critical) return 'critical';
    if (risk >= this.riskThresholds.high) return 'high';
    if (risk >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  // Generate recommendations
  private generateRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    
    factors.forEach(factor => {
      switch (factor.type) {
        case 'complexity':
          if (factor.score > 60) {
            recommendations.push('Consider breaking down complex methods');
            recommendations.push('Reduce nesting depth and method length');
          }
          break;
        case 'dependencies':
          if (factor.score > 50) {
            recommendations.push('Review and reduce coupling');
            recommendations.push('Improve cohesion in modules');
          }
          break;
        case 'test-coverage':
          if (factor.score > 70) {
            recommendations.push('Add comprehensive unit tests');
            recommendations.push('Increase branch coverage');
          }
          break;
        case 'technical-debt':
          if (factor.score > 60) {
            recommendations.push('Address code smells and duplicated code');
            recommendations.push('Improve maintainability index');
          }
          break;
        case 'security':
          if (factor.score > 40) {
            recommendations.push('Fix security vulnerabilities');
            recommendations.push('Add input validation and authentication');
          }
          break;
        case 'performance':
          if (factor.score > 50) {
            recommendations.push('Optimize algorithms and data structures');
            recommendations.push('Reduce memory usage and I/O operations');
          }
          break;
      }
    });
    
    return recommendations;
  }

  // Generate mitigation strategies
  private generateMitigationStrategies(factors: RiskFactor[]): string[] {
    const mitigation: string[] = [];
    
    factors.forEach(factor => {
      switch (factor.type) {
        case 'complexity':
          mitigation.push('Implement code review for complex changes');
          mitigation.push('Use automated refactoring tools');
          break;
        case 'dependencies':
          mitigation.push('Create dependency graph visualization');
          mitigation.push('Implement dependency injection');
          break;
        case 'test-coverage':
          mitigation.push('Set up automated testing pipeline');
          mitigation.push('Require minimum coverage for new code');
          break;
        case 'technical-debt':
          mitigation.push('Schedule regular refactoring sessions');
          mitigation.push('Use static analysis tools');
          break;
        case 'security':
          mitigation.push('Implement security scanning in CI/CD');
          mitigation.push('Conduct regular security audits');
          break;
        case 'performance':
          mitigation.push('Add performance monitoring');
          mitigation.push('Implement performance testing');
          break;
      }
    });
    
    return [...new Set(mitigation)]; // Remove duplicates
  }

  // Calculate confidence
  private calculateConfidence(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;
    
    let totalConfidence = 0;
    factors.forEach(factor => {
      const model = this.riskModels.get(factor.type);
      if (model) {
        totalConfidence += model.accuracy;
      }
    });
    
    return totalConfidence / factors.length;
  }

  // Metric calculation methods
  private calculateCyclomaticComplexity(changeImpact: ChangeImpact): number {
    // Simplified calculation - in real implementation would use AST analysis
    return Math.min(100, (changeImpact.linesAdded + changeImpact.linesModified) * 0.5);
  }

  private calculateCognitiveComplexity(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, (changeImpact.linesAdded + changeImpact.linesModified) * 0.3);
  }

  private calculateNestingDepth(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.1);
  }

  private calculateMethodLength(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.05);
  }

  private calculateCoupling(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.dependencyChange * 10);
  }

  private calculateCohesion(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, Math.max(0, 50 - changeImpact.dependencyChange * 5));
  }

  private calculateDependencyGraphComplexity(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.dependencyChange * 8);
  }

  private calculateExternalDependencies(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.dependencyChange * 15);
  }

  private calculateCodeCoverage(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.max(0, 80 - changeImpact.linesAdded * 0.5);
  }

  private calculateBranchCoverage(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.max(0, 70 - changeImpact.linesAdded * 0.3);
  }

  private calculateTestComplexity(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesModified * 0.2);
  }

  private calculateTestAge(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, Date.now() % 365); // Days since last test
  }

  private calculateCodeSmells(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.1);
  }

  private calculateDuplicatedCode(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.05);
  }

  private calculateMaintainabilityIndex(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.max(0, 100 - (changeImpact.linesAdded + changeImpact.linesModified) * 0.1);
  }

  private calculateCodeChurn(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, (changeImpact.linesAdded + changeImpact.linesRemoved + changeImpact.linesModified) * 0.2);
  }

  private calculateVulnerabilities(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.05);
  }

  private calculateSensitiveData(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.03);
  }

  private calculateInputValidation(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, Math.max(0, 50 - changeImpact.linesAdded * 0.2));
  }

  private calculateAuthentication(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, Math.max(0, 40 - changeImpact.linesAdded * 0.1));
  }

  private calculateAlgorithmComplexity(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.4);
  }

  private calculateMemoryUsage(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.3);
  }

  private calculateIOOperations(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.2);
  }

  private calculateDatabaseQueries(changeImpact: ChangeImpact): number {
    // Simplified calculation
    return Math.min(100, changeImpact.linesAdded * 0.25);
  }

  // Get risk history
  public getRiskHistory(): ChangeRisk[] {
    return [...this.riskHistory];
  }

  // Get risk trends
  public getRiskTrends(days: number = 30): any {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentRisks = this.riskHistory.filter(risk => risk.timestamp > cutoff);
    
    if (recentRisks.length === 0) {
      return {
        trend: 'stable',
        averageRisk: 0,
        riskLevel: 'low',
        recommendations: []
      };
    }
    
    const averageRisk = recentRisks.reduce((sum, risk) => sum + risk.overallRisk, 0) / recentRisks.length;
    const riskLevel = this.getRiskLevel(averageRisk);
    
    // Calculate trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentRisks.length >= 2) {
      const recent = recentRisks.slice(-7);
      const older = recentRisks.slice(-14, -7);
      
      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((sum, risk) => sum + risk.overallRisk, 0) / recent.length;
        const olderAvg = older.reduce((sum, risk) => sum + risk.overallRisk, 0) / older.length;
        
        if (recentAvg < olderAvg - 5) trend = 'improving';
        else if (recentAvg > olderAvg + 5) trend = 'degrading';
      }
    }
    
    return {
      trend,
      averageRisk,
      riskLevel,
      recommendations: this.generateTrendRecommendations(trend, averageRisk)
    };
  }

  // Generate trend recommendations
  private generateTrendRecommendations(trend: string, averageRisk: number): string[] {
    const recommendations: string[] = [];
    
    if (trend === 'degrading') {
      recommendations.push('Risk is increasing - investigate recent changes');
      recommendations.push('Consider adding more rigorous code review');
      recommendations.push('Increase automated testing coverage');
    } else if (trend === 'improving') {
      recommendations.push('Risk is decreasing - continue current practices');
      recommendations.push('Maintain current quality standards');
    } else {
      if (averageRisk > 60) {
        recommendations.push('Risk level is high - implement mitigation strategies');
      } else {
        recommendations.push('Risk level is acceptable - maintain vigilance');
      }
    }
    
    return recommendations;
  }

  // Update risk thresholds
  public updateRiskThresholds(thresholds: Partial<RiskThreshold>): void {
    this.riskThresholds = { ...this.riskThresholds, ...thresholds };
  }

  // Get risk thresholds
  public getRiskThresholds(): RiskThreshold {
    return { ...this.riskThresholds };
  }
}

export default RiskAssessmentService;