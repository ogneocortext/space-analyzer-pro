/**
 * Ollama Cloud Rate Limiter
 * Tracks and limits calls to Ollama Cloud API to stay within free tier limits
 */

export interface RateLimitConfig {
  // Maximum calls per session (5 hours)
  maxCallsPerSession: number;
  // Maximum calls per week
  maxCallsPerWeek: number;
  // Minimum time between calls (ms)
  minIntervalMs: number;
  // Enable warning at threshold
  warningThreshold: number; // 0.0 - 1.0
}

export interface RateLimitState {
  callsThisSession: number;
  callsThisWeek: number;
  lastCallTime: number | null;
  sessionStartTime: number;
  weekStartTime: number;
}

// Default free tier limits (conservative estimates)
export const FREE_TIER_LIMITS: RateLimitConfig = {
  maxCallsPerSession: 50, // Conservative estimate for "light usage"
  maxCallsPerWeek: 200,   // Conservative weekly limit
  minIntervalMs: 1000,    // Minimum 1 second between calls
  warningThreshold: 0.8,  // Warn at 80% usage
};

// Local-only mode - no cloud calls allowed
export const LOCAL_ONLY_CONFIG: RateLimitConfig = {
  maxCallsPerSession: 0,
  maxCallsPerWeek: 0,
  minIntervalMs: 0,
  warningThreshold: 0,
};

class OllamaRateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;
  private storageKey = "ollama_rate_limit_state";

  constructor(config: RateLimitConfig = FREE_TIER_LIMITS) {
    this.config = config;
    this.state = this.loadState();
  }

  /**
   * Check if a cloud call is allowed
   */
  canMakeCall(): { allowed: boolean; reason?: string } {
    // Local-only mode
    if (this.config.maxCallsPerSession === 0) {
      return { allowed: false, reason: "Local-only mode: Ollama Cloud calls disabled" };
    }

    // Check session reset (5 hours = 18,000,000 ms)
    const now = Date.now();
    const sessionAge = now - this.state.sessionStartTime;
    if (sessionAge > 18_000_000) {
      this.resetSession();
    }

    // Check week reset (7 days = 604,800,000 ms)
    const weekAge = now - this.state.weekStartTime;
    if (weekAge > 604_800_000) {
      this.resetWeek();
    }

    // Check session limit
    if (this.state.callsThisSession >= this.config.maxCallsPerSession) {
      return {
        allowed: false,
        reason: `Session limit reached (${this.config.maxCallsPerSession} calls). Resets in ${this.getTimeUntilSessionReset()}.`,
      };
    }

    // Check weekly limit
    if (this.state.callsThisWeek >= this.config.maxCallsPerWeek) {
      return {
        allowed: false,
        reason: `Weekly limit reached (${this.config.maxCallsPerWeek} calls). Resets in ${this.getTimeUntilWeekReset()}.`,
      };
    }

    // Check rate limiting (min interval)
    if (this.state.lastCallTime) {
      const timeSinceLastCall = now - this.state.lastCallTime;
      if (timeSinceLastCall < this.config.minIntervalMs) {
        const waitMs = this.config.minIntervalMs - timeSinceLastCall;
        return {
          allowed: false,
          reason: `Rate limited. Wait ${Math.ceil(waitMs / 1000)}s before next call.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a cloud call
   */
  recordCall(): void {
    this.state.callsThisSession++;
    this.state.callsThisWeek++;
    this.state.lastCallTime = Date.now();
    this.saveState();

    // Check warning threshold
    const sessionUsage = this.state.callsThisSession / this.config.maxCallsPerSession;
    const weekUsage = this.state.callsThisWeek / this.config.maxCallsPerWeek;

    if (sessionUsage >= this.config.warningThreshold) {
      console.warn(
        `[OllamaRateLimiter] Session usage at ${(sessionUsage * 100).toFixed(0)}% ` +
        `(${this.state.callsThisSession}/${this.config.maxCallsPerSession} calls)`
      );
    }

    if (weekUsage >= this.config.warningThreshold) {
      console.warn(
        `[OllamaRateLimiter] Weekly usage at ${(weekUsage * 100).toFixed(0)}% ` +
        `(${this.state.callsThisWeek}/${this.config.maxCallsPerWeek} calls)`
      );
    }
  }

  /**
   * Get current usage stats
   */
  getUsageStats(): {
    callsThisSession: number;
    callsThisWeek: number;
    sessionLimit: number;
    weekLimit: number;
    sessionUsage: number;
    weekUsage: number;
    timeUntilSessionReset: string;
    timeUntilWeekReset: string;
  } {
    return {
      callsThisSession: this.state.callsThisSession,
      callsThisWeek: this.state.callsThisWeek,
      sessionLimit: this.config.maxCallsPerSession,
      weekLimit: this.config.maxCallsPerWeek,
      sessionUsage: this.state.callsThisSession / this.config.maxCallsPerSession,
      weekUsage: this.state.callsThisWeek / this.config.maxCallsPerWeek,
      timeUntilSessionReset: this.getTimeUntilSessionReset(),
      timeUntilWeekReset: this.getTimeUntilWeekReset(),
    };
  }

  /**
   * Set local-only mode (no cloud calls)
   */
  setLocalOnlyMode(): void {
    this.config = LOCAL_ONLY_CONFIG;
    console.log("[OllamaRateLimiter] Local-only mode enabled. Ollama Cloud calls disabled.");
  }

  /**
   * Check if running in local-only mode
   */
  isLocalOnlyMode(): boolean {
    return this.config.maxCallsPerSession === 0;
  }

  /**
   * Reset session counters
   */
  private resetSession(): void {
    this.state.callsThisSession = 0;
    this.state.sessionStartTime = Date.now();
    this.saveState();
    console.log("[OllamaRateLimiter] Session counters reset");
  }

  /**
   * Reset weekly counters
   */
  private resetWeek(): void {
    this.state.callsThisWeek = 0;
    this.state.weekStartTime = Date.now();
    this.saveState();
    console.log("[OllamaRateLimiter] Weekly counters reset");
  }

  /**
   * Get time until session reset
   */
  private getTimeUntilSessionReset(): string {
    const now = Date.now();
    const sessionAge = now - this.state.sessionStartTime;
    const remaining = Math.max(0, 18_000_000 - sessionAge);
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Get time until week reset
   */
  private getTimeUntilWeekReset(): string {
    const now = Date.now();
    const weekAge = now - this.state.weekStartTime;
    const remaining = Math.max(0, 604_800_000 - weekAge);
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    return `${days}d ${hours}h`;
  }

  /**
   * Load state from storage
   */
  private loadState(): RateLimitState {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          callsThisSession: parsed.callsThisSession || 0,
          callsThisWeek: parsed.callsThisWeek || 0,
          lastCallTime: parsed.lastCallTime || null,
          sessionStartTime: parsed.sessionStartTime || Date.now(),
          weekStartTime: parsed.weekStartTime || Date.now(),
        };
      }
    } catch (e) {
      console.warn("[OllamaRateLimiter] Failed to load state:", e);
    }

    return {
      callsThisSession: 0,
      callsThisWeek: 0,
      lastCallTime: null,
      sessionStartTime: Date.now(),
      weekStartTime: Date.now(),
    };
  }

  /**
   * Save state to storage
   */
  private saveState(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.warn("[OllamaRateLimiter] Failed to save state:", e);
    }
  }
}

// Export singleton instance with free tier defaults
export const ollamaRateLimiter = new OllamaRateLimiter(FREE_TIER_LIMITS);
export default ollamaRateLimiter;
