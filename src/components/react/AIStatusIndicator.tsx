/**
 * AI Status Indicator Component
 * Shows current AI capabilities and status
 */

import React from "react";
import { Brain, Activity, Wifi, WifiOff } from "lucide-react";

interface AIStatusIndicatorProps {
  aiStatus: {
    model?: string;
    stage?: string;
    streaming?: boolean;
    confidence?: number;
    error?: string;
  };
  capabilities: {
    vision: boolean;
    codeAnalysis: boolean;
    selfLearning: boolean;
    ollamaAvailable: boolean;
    enhancedWorkflow: boolean;
    streaming: boolean;
    toolCalling: boolean;
  };
}

export const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({ aiStatus, capabilities }) => {
  const getStatusText = () => {
    if (aiStatus?.error) return `Error: ${aiStatus.error}`;
    if (aiStatus?.streaming) return `Streaming with ${aiStatus.model || "AI"}`;
    if (aiStatus?.stage) return `${aiStatus.stage} (${aiStatus.model})`;
    return `Ready (${aiStatus.model || "AI"})`;
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-4 w-4 text-blue-500" />
          <div>
            <h3 className="font-semibold text-white text-sm">AI Assistant</h3>
            <p className="text-xs text-gray-400">Enhanced workflow active</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              capabilities.vision ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300"
            }`}
          >
            {capabilities.vision ? (
              <>
                <Activity className="h-3 w-3" />
                <span>Vision</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Text Only</span>
              </>
            )}
          </div>

          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              capabilities.selfLearning ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"
            }`}
          >
            {capabilities.selfLearning ? (
              <>
                <Brain className="h-3 w-3" />
                <span>Learning</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Static</span>
              </>
            )}
          </div>

          <div
            className={`px-2 py-1 rounded text-xs ${
              capabilities.enhancedWorkflow
                ? "bg-purple-600 text-white"
                : "bg-gray-600 text-gray-300"
            }`}
          >
            {capabilities.enhancedWorkflow ? "Enhanced" : "Basic"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              aiStatus?.error
                ? "bg-red-600 text-white"
                : aiStatus?.streaming
                  ? "bg-blue-600 text-white"
                  : "bg-gray-600 text-gray-300"
            }`}
          >
            {aiStatus?.streaming && <Activity className="h-3 w-3 animate-pulse" />}
            <span>{getStatusText()}</span>
          </div>

          {aiStatus?.confidence && (
            <span className="text-xs text-gray-400 ml-2">
              {Math.round(aiStatus.confidence * 100)}% confidence
            </span>
          )}
        </div>

        <button
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600"
          onClick={() => window.open("/api/health", "_blank")}
        >
          Settings
        </button>
      </div>
    </div>
  );
};
