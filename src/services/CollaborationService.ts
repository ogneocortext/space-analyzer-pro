/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

export interface CollaborationEvent {
  type: "join" | "leave" | "message" | "analysis_update" | "cursor" | "selection";
  userId: string;
  userName?: string;
  timestamp: number;
  data?: any;
}

export interface CollaborationSession {
  sessionId: string;
  users: Map<string, { id: string; name: string; color: string; joinedAt: Date }>;
  analysisId?: string;
  createdAt: Date;
  isActive: boolean;
}

export interface RealtimeAnalysisUpdate {
  type: "progress" | "complete" | "error";
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  currentFile?: string;
  result?: any;
  error?: string;
}

export class CollaborationService {
  private ws: WebSocket | null = null;
  private session: CollaborationSession | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private eventHandlers: Map<string, Set<(event: CollaborationEvent) => void>> = new Map();
  private userId: string;
  private userName: string;

  constructor() {
    this.userId = this.generateUserId();
    this.userName = `User-${this.userId.substring(0, 4)}`;
  }

  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate a random color for this user
   */
  private generateColor(): string {
    const colors = [
      "#3b82f6",
      "#8b5cf6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#06b6d4",
      "#f43f5e",
      "#a855f7",
      "#22c55e",
      "#f97316",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Connect to a collaboration session
   */
  async connect(
    serverUrl: string = "ws://localhost:8080",
    sessionId?: string
  ): Promise<CollaborationSession> {
    return new Promise((resolve, reject) => {
      try {
        // For demo purposes, create a local session
        if (!sessionId) {
          sessionId = `session_${Date.now()}`;
        }

        this.session = {
          sessionId,
          users: new Map(),
          analysisId: undefined,
          createdAt: new Date(),
          isActive: true,
        };

        // Add self to session
        this.session.users.set(this.userId, {
          id: this.userId,
          name: this.userName,
          color: this.generateColor(),
          joinedAt: new Date(),
        });

        // Emit join event
        this.emit("join", {
          type: "join",
          userId: this.userId,
          userName: this.userName,
          timestamp: Date.now(),
        });

        resolve(this.session);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the collaboration session
   */
  disconnect(): void {
    if (this.session) {
      // Emit leave event
      this.emit("leave", {
        type: "leave",
        userId: this.userId,
        userName: this.userName,
        timestamp: Date.now(),
      });

      this.session = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Join an analysis session (share analysis results)
   */
  async joinAnalysis(analysisId: string): Promise<void> {
    if (!this.session) {
      throw new Error("Not connected to a collaboration session");
    }

    this.session.analysisId = analysisId;

    // Emit analysis update
    this.emit("analysis_update", {
      type: "analysis_update",
      userId: this.userId,
      userName: this.userName,
      timestamp: Date.now(),
      data: { analysisId, action: "join" },
    });
  }

  /**
   * Broadcast analysis update to all users
   */
  broadcastAnalysisUpdate(update: RealtimeAnalysisUpdate): void {
    if (!this.session) return;

    this.emit("analysis_update", {
      type: "analysis_update",
      userId: this.userId,
      userName: this.userName,
      timestamp: Date.now(),
      data: update,
    });
  }

  /**
   * Broadcast cursor position
   */
  broadcastCursorPosition(position: { x: number; y: number; element?: string }): void {
    if (!this.session) return;

    this.emit("cursor", {
      type: "cursor",
      userId: this.userId,
      userName: this.userName,
      timestamp: Date.now(),
      data: position,
    });
  }

  /**
   * Broadcast file selection
   */
  broadcastSelection(files: string[]): void {
    if (!this.session) return;

    this.emit("selection", {
      type: "selection",
      userId: this.userId,
      userName: this.userName,
      timestamp: Date.now(),
      data: { files },
    });
  }

  /**
   * Send a chat message
   */
  sendMessage(message: string): void {
    if (!this.session) return;

    this.emit("message", {
      type: "message",
      userId: this.userId,
      userName: this.userName,
      timestamp: Date.now(),
      data: { message },
    });
  }

  /**
   * Get list of connected users
   */
  getConnectedUsers(): Array<{ id: string; name: string; color: string; joinedAt: Date }> {
    if (!this.session) return [];
    return Array.from(this.session.users.values());
  }

  /**
   * Get current session info
   */
  getSession(): CollaborationSession | null {
    return this.session;
  }

  /**
   * Get current user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Set user name
   */
  setUserName(name: string): void {
    this.userName = name;
    if (this.session?.users.has(this.userId)) {
      const user = this.session.users.get(this.userId)!;
      user.name = name;
    }
  }

  /**
   * Subscribe to collaboration events
   */
  on(event: string, handler: (event: CollaborationEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from collaboration events
   */
  off(event: string, handler: (event: CollaborationEvent) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: string, data: CollaborationEvent): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in collaboration event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Generate a shareable link for the current analysis
   */
  generateShareLink(analysisId: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${analysisId}?user=${encodeURIComponent(this.userName)}`;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.session !== null && this.session.isActive;
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();

// Simulated realtime collaboration demo (for local testing without WebSocket server)
export class LocalCollaborationDemo {
  private service: CollaborationService;
  private demoInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.service = collaborationService;
  }

  /**
   * Start a local demo session with simulated users
   */
  startDemo(): void {
    // Connect to local session
    this.service.connect().then(() => {
      console.warn("Local collaboration demo started");

      // Simulate other users joining
      setTimeout(() => this.simulateUserJoin("Alice", "#3b82f6"), 2000);
      setTimeout(() => this.simulateUserJoin("Bob", "#10b981"), 4000);
      setTimeout(() => this.simulateUserJoin("Charlie", "#f59e0b"), 6000);

      // Simulate cursor movements
      this.demoInterval = setInterval(() => {
        this.simulateCursorMovement();
      }, 3000);

      // Simulate analysis updates
      this.simulateAnalysisProgress();
    });
  }

  /**
   * Stop the demo
   */
  stopDemo(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.service.disconnect();
    console.warn("Local collaboration demo stopped");
  }

  private simulateUserJoin(name: string, color: string): void {
    const userId = `demo_${name.toLowerCase()}_${Date.now()}`;

    // In a real app, this would come from the WebSocket
    console.warn(`Demo user ${name} joined`);
  }

  private simulateCursorMovement(): void {
    const positions = [
      { x: Math.random() * 800, y: Math.random() * 600, element: "chart" },
      { x: Math.random() * 800, y: Math.random() * 600, element: "filelist" },
      { x: Math.random() * 800, y: Math.random() * 600, element: "stats" },
    ];
    this.service.broadcastCursorPosition(positions[Math.floor(Math.random() * positions.length)]);
  }

  private simulateAnalysisProgress(): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      this.service.broadcastAnalysisUpdate({
        type: progress < 100 ? "progress" : "complete",
        filesProcessed: progress * 10,
        totalFiles: 1000,
        percentage: Math.min(progress, 100),
        currentFile: `file_${progress}.txt`,
      });

      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 2000);
  }
}

export const localDemo = new LocalCollaborationDemo();
