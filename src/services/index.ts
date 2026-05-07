/**
 * Services Index
 * Centralized service exports to prevent circular dependencies
 */

// Core Services
export { PortDetector } from "./PortDetector";
export { ConfigService } from "./ConfigService";
export { ErrorHandler } from "./ErrorHandler";
export { DebugLogger } from "./DebugLogger";

// File System Services
export { FileSystemService } from "./FileSystemService";
export { FileManagementService } from "./FileManagementService";

// Analysis Services
export { AnalysisBridge } from "./analysis/AnalysisBridge";
export { visualAnalysisService } from "./analysis/VisualAnalysisService";

// AI Services
export { AIService } from "./ai/AIService";
export { AIChatService } from "./ai/AIChatService";
export { ollamaService } from "./ai/OllamaService";
export { ollamaAI } from "./ai/OllamaAI";
export { GoogleAIService } from "./ai/GoogleAIService";
export { pythonAIService } from "./ai/PythonAIService";

// AI Tools
export { localToolRegistry } from "./ai/tools/LocalToolRegistry";

// Learning Services
export { LearningService } from "./LearningService";
export { NeuralDataService } from "./NeuralDataService";

// Utility Services
export { ExportService } from "./ExportService";
export { SearchService } from "./SearchService";
export { TrendAnalysisService } from "./TrendAnalysisService";
export { StateManager } from "./StateManager";
export { TODOTrackingService } from "./TODOTrackingService";

// Browser Automation
export { BrowserAutomation } from "./BrowserAutomation";

// Collaboration
export { CollaborationService } from "./CollaborationService";

// IDE Integration
export { IDEIntegrationService } from "./IDEIntegrationService";
