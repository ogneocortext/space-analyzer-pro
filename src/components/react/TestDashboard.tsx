import React, { useState } from "react";
// @ts-ignore
import DevelopmentAnalytics from "./DevelopmentAnalytics";
// @ts-ignore
import GPUMemoryVisualization from "./GPUMemoryVisualization";
// @ts-ignore
import EnhancedModelBrowser from "./EnhancedModelBrowser";
import "./TestDashboard.css";

const TestDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<"analytics" | "gpu" | "models">("analytics");

  // Mock data for testing
  const mockModels = [
    {
      name: "GPT-4 Vision Model",
      path: "/models/gpt4-vision",
      size: 15000000000,
      type: "pytorch" as const,
      framework: "PyTorch",
      accuracy: 94.5,
      parameters: 175000000000,
      lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      downloadDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      tags: ["vision", "multimodal", "large"],
      gpuMemory: 8192,
      inferenceTime: 120,
      status: "loaded" as const,
      description: "Advanced vision model with multimodal capabilities",
      version: "1.0.0",
      license: "MIT",
    },
    {
      name: "BERT Base Uncased",
      path: "/models/bert-base",
      size: 420000000,
      type: "tensorflow" as const,
      framework: "TensorFlow",
      accuracy: 88.2,
      parameters: 110000000,
      lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      downloadDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      tags: ["nlp", "text", "medium"],
      gpuMemory: 1024,
      inferenceTime: 45,
      status: "loaded" as const,
      description: "Base BERT model for text classification",
      version: "1.0.1",
      license: "Apache-2.0",
    },
    {
      name: "Stable Diffusion XL",
      path: "/models/sdxl",
      size: 6900000000,
      type: "pytorch" as const,
      framework: "PyTorch",
      accuracy: 91.8,
      parameters: 2600000000,
      lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      downloadDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      tags: ["image", "generation", "large"],
      gpuMemory: 4096,
      inferenceTime: 280,
      status: "unloaded" as const,
      description: "High-quality image generation model",
      version: "2.1.0",
      license: "CreativeML",
    },
    {
      name: "Whisper Large V3",
      path: "/models/whisper-large",
      size: 1550000000,
      type: "custom" as const,
      framework: "Custom",
      accuracy: 92.3,
      parameters: 1550000000,
      lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      downloadDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      tags: ["audio", "speech", "medium"],
      gpuMemory: 2048,
      inferenceTime: 85,
      status: "loading" as const,
      description: "Advanced speech recognition model",
      version: "3.0.0",
      license: "MIT",
    },
    {
      name: "YOLOv8 Object Detection",
      path: "/models/yolov8",
      size: 62000000,
      type: "onnx" as const,
      framework: "ONNX",
      accuracy: 89.7,
      parameters: 68000000,
      lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      downloadDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      tags: ["vision", "detection", "small"],
      gpuMemory: 512,
      inferenceTime: 25,
      status: "loaded" as const,
      description: "Real-time object detection model",
      version: "8.0.0",
      license: "GPL-3.0",
    },
  ];

  const handleModelAction = (action: string, model: any) => {
    console.log(`Model action: ${action}`, model);
    alert(`${action} action triggered for ${model.name}`);
  };

  return (
    <div className="test-dashboard">
      <div className="dashboard-header">
        <h1>🚀 Enhanced Space Analyzer Test Dashboard</h1>
        <p>Testing the new development analytics, GPU visualization, and model browser features</p>
      </div>

      <div className="view-selector">
        <button
          onClick={() => setActiveView("analytics")}
          className={`view-button ${activeView === "analytics" ? "active" : ""}`}
        >
          📊 Development Analytics
        </button>
        <button
          onClick={() => setActiveView("gpu")}
          className={`view-button ${activeView === "gpu" ? "active" : ""}`}
        >
          🧠 GPU Memory Visualization
        </button>
        <button
          onClick={() => setActiveView("models")}
          className={`view-button ${activeView === "models" ? "active" : ""}`}
        >
          🤖 Enhanced Model Browser
        </button>
      </div>

      <div className="view-container">
        {activeView === "analytics" && (
          <div className="view-panel">
            <DevelopmentAnalytics projectPath="D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio" />
          </div>
        )}

        {activeView === "gpu" && (
          <div className="view-panel">
            <GPUMemoryVisualization models={mockModels} />
          </div>
        )}

        {activeView === "models" && (
          <div className="view-panel">
            <EnhancedModelBrowser models={mockModels} onModelAction={handleModelAction} />
          </div>
        )}
      </div>

      <div className="test-info">
        <h3>🧪 Test Information</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>Development Analytics</h4>
            <ul>
              <li>Code duplication detection</li>
              <li>Build performance tracking</li>
              <li>Dependency optimization</li>
              <li>Interactive charts</li>
            </ul>
          </div>
          <div className="info-card">
            <h4>GPU Memory Visualization</h4>
            <ul>
              <li>Memory usage analytics</li>
              <li>Model performance comparison</li>
              <li>Optimization suggestions</li>
              <li>Real-time monitoring</li>
            </ul>
          </div>
          <div className="info-card">
            <h4>Enhanced Model Browser</h4>
            <ul>
              <li>Virtual scrolling (100k+ models)</li>
              <li>Advanced filtering</li>
              <li>Smart search</li>
              <li>Batch operations</li>
            </ul>
          </div>
        </div>
        <div className="mock-data-note">
          <p>
            <strong>Note:</strong> This is using mock data to demonstrate the enhanced features. The
            actual backend integration would provide real analytics from your directory.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestDashboard;
