/**
 * AI Backend Service
 * Provides local AI processing when backend server is unavailable
 */

export interface AIResponse {
  success: boolean;
  response: string;
  metadata?: {
    modelUsed: string;
    processingTime: number;
    confidence?: number;
  };
}

export class AIBackendService {
  private static instance: AIBackendService;

  static getInstance(): AIBackendService {
    if (!AIBackendService.instance) {
      AIBackendService.instance = new AIBackendService();
    }
    return AIBackendService.instance;
  }

  /**
   * Process message locally when backend is unavailable
   */
  async processMessage(message: string, context?: any): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Handle direct commands locally
      const response = this.handleLocalCommand(message, context);

      if (response) {
        return {
          success: true,
          response,
          metadata: {
            modelUsed: "Local Processing",
            processingTime: Date.now() - startTime,
            confidence: 0.95,
          },
        };
      }

      // Fallback to generic AI response
      const genericResponse = this.generateGenericResponse(message, context);

      return {
        success: true,
        response: genericResponse,
        metadata: {
          modelUsed: "Local Fallback",
          processingTime: Date.now() - startTime,
          confidence: 0.7,
        },
      };
    } catch (error) {
      console.error("Local AI processing failed:", error);

      return {
        success: false,
        response: "I'm having trouble processing your request right now. Please try again later.",
        metadata: {
          modelUsed: "Error Fallback",
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Handle known commands locally
   */
  private handleLocalCommand(message: string, context?: any): string | null {
    const lowerMessage = message.toLowerCase().trim();

    // Check if this is a command we should handle locally
    if (this.isDirectCommand(lowerMessage)) {
      return null; // Let the direct command handler in the UI handle it
    }

    // Handle other common requests
    if (lowerMessage.includes("help") || lowerMessage.includes("what can you do")) {
      return this.getHelpMessage();
    }

    if (lowerMessage.includes("status") || lowerMessage.includes("how are you")) {
      return this.getStatusMessage(context);
    }

    return null;
  }

  /**
   * Check if message is a direct command
   */
  private isDirectCommand(message: string): boolean {
    const directCommands = [
      "run scan",
      "new scan",
      "scan directory",
      "generate report",
      "create report",
      "detailed report",
      "compare scans",
      "compare analysis",
      "previous scan",
      "export data",
      "export analysis",
      "save data",
      "largest files",
      "show largest",
      "biggest files",
      "storage usage",
      "disk usage",
      "how much space",
    ];

    return directCommands.some((cmd) => message.includes(cmd));
  }

  /**
   * Generate generic response for unknown commands
   */
  private generateGenericResponse(message: string, context?: any): string {
    const lowerMessage = message.toLowerCase().trim();

    if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
      return "Hello! I'm your AI storage assistant. I can help you analyze files, run scans, generate reports, and manage your storage. Use the Tools panel to see available actions, or ask me what you'd like to do!";
    }

    if (lowerMessage.includes("thank")) {
      return "You're welcome! I'm here to help you manage your storage efficiently. Feel free to ask if you need anything else!";
    }

    if (context?.analysisData) {
      return `I can help you analyze your storage data. You have ${context.files?.length || 0} files analyzed. Try asking me to "show me the largest files" or "generate a detailed report" to get started!`;
    }

    return "I'm here to help with storage analysis and file management. Try using the Tools panel to see available actions, or ask me to run a scan to get started!";
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return `## 🤖 AI Storage Assistant Help

I can help you with the following tasks:

### 🔍 **Analysis Commands**
- **"Run new scan"** - Scan directory for file analysis
- **"Show me the largest files"** - Display biggest files
- **"Show me storage usage"** - View storage summary

### 📊 **Reporting Commands**
- **"Generate detailed report"** - Create comprehensive analysis
- **"Compare scans"** - Compare with previous analyses
- **"Export data"** - Export in various formats (CSV, Excel, PDF)

### 🛠️ **Management Commands**
- **"Find duplicate files"** - Identify duplicates
- **"Suggest cleanup"** - Get optimization recommendations
- **"Organize files"** - File organization suggestions

### 💡 **Tips**
- Use the **Tools panel** for quick access to all actions
- Commands work with natural language variations
- I provide real-time progress for long operations

What would you like to do?`;
  }

  /**
   * Get status message
   */
  private getStatusMessage(context?: any): string {
    const hasData = !!context?.analysisData;
    const fileCount = context?.files?.length || 0;
    const totalSize = context?.analysisData?.totalSize || 0;

    return `## 📊 System Status

### ✅ **AI Assistant**: Online and ready
### 📁 **Data Available**: ${hasData ? "Yes" : "No"}
### 📄 **Files Analyzed**: ${fileCount.toLocaleString()}
### 💾 **Total Size**: ${this.formatBytes(totalSize)}

### 🛠️ **Available Tools**: All systems operational
### 🔍 **Scan Engine**: Ready
### 📤 **Export Functions**: Available

I'm ready to help you analyze and manage your storage!`;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Check if backend is available
   */
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch("http://localhost:8085/api/health", {
        method: "GET",
        timeout: 3000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
