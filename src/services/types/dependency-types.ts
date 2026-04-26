export interface FileDependency {
  file: string;
  path: string;
  type: 'import' | 'require' | 'include' | 'reference' | 'link' | 'config';
  strength: 'strong' | 'medium' | 'weak';
  direction: 'incoming' | 'outgoing';
  category: string;
}

export interface DependencyImpact {
  file: string;
  impact: 'critical' | 'high' | 'medium' | 'low' | 'none';
  reason: string;
  affectedFiles: string[];
  consequences: string[];
  benefits: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface PredictiveDependencyAnalysis {
  action: string;
  targetFiles: string[];
  directImpacts: DependencyImpact[];
  cascadingImpacts: DependencyImpact[];
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
  alternativeActions: {
    action: string;
    risk: 'critical' | 'high' | 'medium' | 'low';
    benefits: string[];
    description: string;
  }[];
}
