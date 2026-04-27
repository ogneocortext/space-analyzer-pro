import React from 'react';
import type { FC } from 'react';
import './PredictionExplainer.css';

export interface PredictiveInsight {
  type: 'growth' | 'cleanup' | 'organization' | 'security';
  prediction: string;
  confidence: number;
  timeframe: string;
  actionItems: string[];
  reasoning: {
    primaryFactor: string;
    contributingFactors: string[];
    historicalEvidence: string[];
    dataPoints: {
      label: string;
      value: string;
      impact: 'high' | 'medium' | 'low';
    }[];
    trendAnalysis: {
      direction: 'increasing' | 'decreasing' | 'stable';
      rate: string;
      duration: string;
    };
  };
}

interface PredictionExplainerProps {
  insight: PredictiveInsight;
  onClose: () => void;
}

export const PredictionExplainer: FC<PredictionExplainerProps> = ({ insight, onClose }) => {
  return (
    <div className="prediction-explainer">
      <div className="prediction-explainer-header">
        <h3>{insight.type.charAt(0).toUpperCase() + insight.type.slice(1)} Prediction</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="prediction-content">
        <div className="prediction-text">
          <p>{insight.prediction}</p>
        </div>
        
        <div className="prediction-details">
          <div className="confidence">
            <span>Confidence: </span>
            <span className={`confidence-${insight.confidence > 70 ? 'high' : insight.confidence > 40 ? 'medium' : 'low'}`}>
              {insight.confidence}%
            </span>
          </div>
          
          <div className="timeframe">
            <span>Timeframe: </span>
            <span>{insight.timeframe}</span>
          </div>
        </div>
        
        <div className="reasoning">
          <h4>Reasoning</h4>
          <p><strong>Primary Factor:</strong> {insight.reasoning.primaryFactor}</p>
          
          {insight.reasoning.contributingFactors.length > 0 && (
            <div>
              <strong>Contributing Factors:</strong>
              <ul>
                {insight.reasoning.contributingFactors.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
          
          {insight.reasoning.dataPoints.length > 0 && (
            <div>
              <strong>Data Points:</strong>
              <ul>
                {insight.reasoning.dataPoints.map((point, index) => (
                  <li key={index} className={`impact-${point.impact}`}>
                    {point.label}: {point.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {insight.actionItems.length > 0 && (
          <div className="action-items">
            <h4>Recommended Actions</h4>
            <ul>
              {insight.actionItems.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictionExplainer;