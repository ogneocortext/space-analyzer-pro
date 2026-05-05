/**
 * 3D File System Browser Settings Manager
 * Handles user preferences, settings persistence, and configuration
 */

// Settings Categories
export type SettingsCategory = "general" | "performance" | "visual" | "navigation" | "advanced";

// Settings Interface
export interface Settings3D {
  general: {
    autoSave: boolean;
    autoSaveInterval: number;
    defaultLayout: "tree" | "sphere" | "cylinder" | "spiral";
    maxDepth: number;
    maxNodes: number;
    showWelcome: boolean;
    enableTooltips: boolean;
    language: string;
  };
  performance: {
    enableLOD: boolean;
    enableFrustumCulling: boolean;
    enableObjectPooling: boolean;
    maxMemoryMB: number;
    targetFPS: number;
    adaptiveQuality: boolean;
    webWorkers: boolean;
    cacheSize: number;
  };
  visual: {
    nodeSize: number;
    zoomLevel: number;
    showFileLabels: boolean;
    showDirectoryLabels: boolean;
    colorBySize: boolean;
    colorByType: boolean;
    showHeatMap: boolean;
    wireframe: boolean;
    shadows: boolean;
    antialiasing: boolean;
    backgroundColor: string;
    fogEnabled: boolean;
  };
  navigation: {
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableFlyTo: boolean;
    flyToDuration: number;
    mouseSensitivity: number;
    scrollSpeed: number;
    enableKeyboardShortcuts: boolean;
    enableGestures: boolean;
    cameraMode: "orbit" | "fly" | "first-person";
  };
  advanced: {
    debugMode: boolean;
    showFPS: boolean;
    showMemoryUsage: boolean;
    showStatistics: boolean;
    enableLogging: boolean;
    logLevel: "error" | "warn" | "info" | "debug";
    experimentalFeatures: boolean;
    developerMode: boolean;
  };
}

// Default Settings
const DEFAULT_SETTINGS: Settings3D = {
  general: {
    autoSave: true,
    autoSaveInterval: 30000,
    defaultLayout: "tree",
    maxDepth: 5,
    maxNodes: 1000,
    showWelcome: true,
    enableTooltips: true,
    language: "en",
  },
  performance: {
    enableLOD: true,
    enableFrustumCulling: true,
    enableObjectPooling: true,
    maxMemoryMB: 512,
    targetFPS: 60,
    adaptiveQuality: true,
    webWorkers: true,
    cacheSize: 100,
  },
  visual: {
    nodeSize: 1.0,
    zoomLevel: 1.0,
    showFileLabels: true,
    showDirectoryLabels: true,
    colorBySize: false,
    colorByType: true,
    showHeatMap: false,
    wireframe: false,
    shadows: true,
    antialiasing: true,
    backgroundColor: "#0a0a0a",
    fogEnabled: true,
  },
  navigation: {
    autoRotate: false,
    autoRotateSpeed: 0.5,
    enableFlyTo: true,
    flyToDuration: 1000,
    mouseSensitivity: 1.0,
    scrollSpeed: 1.0,
    enableKeyboardShortcuts: true,
    enableGestures: false,
    cameraMode: "orbit",
  },
  advanced: {
    debugMode: false,
    showFPS: false,
    showMemoryUsage: false,
    showStatistics: false,
    enableLogging: false,
    logLevel: "info",
    experimentalFeatures: false,
    developerMode: false,
  },
};

// Settings Manager Class
export class Settings3DManager {
  private settings: Settings3D;
  private listeners: Map<string, (category: string, changes: any) => void>;
  private autoSaveTimer: number | null;
  private storageKey: string;

  constructor(storageKey: string = "filesystem3d-settings") {
    this.storageKey = storageKey;
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = new Map();
    this.autoSaveTimer = null;

    this.loadSettings();
    this.startAutoSave();
  }

  // Get Settings
  public getSettings(): Settings3D {
    return { ...this.settings };
  }

  // Get Category Settings
  public getCategorySettings<K extends keyof Settings3D>(category: K): Settings3D[K] {
    return { ...this.settings[category] };
  }

  // Get Specific Setting
  public getSetting<K extends keyof Settings3D, L extends keyof Settings3D[K]>(
    category: K,
    key: L
  ): Settings3D[K][L] {
    return this.settings[category][key];
  }

  // Set Category Settings
  public setCategorySettings<K extends keyof Settings3D>(
    category: K,
    settings: Partial<Settings3D[K]>
  ): void {
    Object.assign(this.settings[category], settings);
    this.notifyListeners(category as string, settings);
    this.scheduleAutoSave();
  }

  // Set Specific Setting
  public setSetting<K extends keyof Settings3D, L extends keyof Settings3D[K]>(
    category: K,
    key: L,
    value: Settings3D[K][L]
  ): void {
    const _oldValue = this.settings[category][key];
    this.settings[category][key] = value;

    this.notifyListeners(category as string, { [key as string]: value });
    this.scheduleAutoSave();
  }

  // Reset Settings
  public resetSettings(category?: keyof Settings3D): void {
    if (category) {
      this.settings[category] = { ...DEFAULT_SETTINGS[category] };
      this.notifyListeners(category as string, this.settings[category]);
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
      this.notifyListeners("all", this.settings);
    }

    this.scheduleAutoSave();
  }

  // Reset to Defaults
  public resetToDefaults(): void {
    this.resetSettings();
  }

  // Export Settings
  public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  // Import Settings
  public importSettings(settingsJson: string): boolean {
    try {
      const imported = JSON.parse(settingsJson);

      // Validate imported settings
      if (this.validateSettings(imported)) {
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, imported);
        this.notifyListeners("all", this.settings);
        this.scheduleAutoSave();
        return true;
      }
    } catch (error) {
      console.error("Failed to import settings:", error);
    }

    return false;
  }

  // Validate Settings
  private validateSettings(settings: any): boolean {
    if (!settings || typeof settings !== "object") return false;

    // Check if all required categories exist
    const requiredCategories = Object.keys(DEFAULT_SETTINGS) as (keyof Settings3D)[];
    for (const category of requiredCategories) {
      if (!settings[category] || typeof settings[category] !== "object") {
        return false;
      }
    }

    return true;
  }

  // Merge Settings
  private mergeSettings(defaults: Settings3D, imported: any): Settings3D {
    const merged = { ...defaults };

    Object.keys(imported).forEach((category) => {
      if (defaults[category as keyof Settings3D]) {
        merged[category as keyof Settings3D] = {
          ...defaults[category as keyof Settings3D],
          ...imported[category],
        };
      }
    });

    return merged;
  }

  // Load Settings
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.validateSettings(parsed)) {
          this.settings = this.mergeSettings(DEFAULT_SETTINGS, parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      // Use defaults if loading fails
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  // Save Settings
  public saveSettings(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  // Start Auto Save
  private startAutoSave(): void {
    if (this.settings.general.autoSave) {
      this.autoSaveTimer = window.setInterval(() => {
        this.saveSettings();
      }, this.settings.general.autoSaveInterval);
    }
  }

  // Stop Auto Save
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // Schedule Auto Save
  private scheduleAutoSave(): void {
    if (this.settings.general.autoSave) {
      // Restart auto save with new interval
      this.stopAutoSave();
      this.startAutoSave();
    }
  }

  // Add Listener
  public addListener(callback: (category: string, changes: any) => void): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.listeners.set(id, callback);
    return id;
  }

  // Remove Listener
  public removeListener(id: string): void {
    this.listeners.delete(id);
  }

  // Notify Listeners
  private notifyListeners(category: string, changes: any): void {
    this.listeners.forEach((callback) => {
      try {
        callback(category, changes);
      } catch (error) {
        console.error("Error in settings listener:", error);
      }
    });
  }

  // Get Performance Profile
  public getPerformanceProfile(): "low" | "medium" | "high" | "ultra" {
    const { maxMemoryMB, targetFPS, enableLOD, enableFrustumCulling, enableObjectPooling } =
      this.settings.performance;

    if (
      maxMemoryMB >= 1024 &&
      targetFPS >= 120 &&
      enableLOD &&
      enableFrustumCulling &&
      enableObjectPooling
    ) {
      return "ultra";
    } else if (maxMemoryMB >= 512 && targetFPS >= 60 && enableLOD && enableFrustumCulling) {
      return "high";
    } else if (maxMemoryMB >= 256 && targetFPS >= 30 && enableLOD) {
      return "medium";
    } else {
      return "low";
    }
  }

  // Set Performance Profile
  public setPerformanceProfile(profile: "low" | "medium" | "high" | "ultra"): void {
    const profiles = {
      low: {
        maxMemoryMB: 128,
        targetFPS: 30,
        enableLOD: false,
        enableFrustumCulling: false,
        enableObjectPooling: false,
        adaptiveQuality: false,
        webWorkers: false,
        cacheSize: 50,
      },
      medium: {
        maxMemoryMB: 256,
        targetFPS: 30,
        enableLOD: true,
        enableFrustumCulling: false,
        enableObjectPooling: false,
        adaptiveQuality: false,
        webWorkers: true,
        cacheSize: 75,
      },
      high: {
        maxMemoryMB: 512,
        targetFPS: 60,
        enableLOD: true,
        enableFrustumCulling: true,
        enableObjectPooling: true,
        adaptiveQuality: true,
        webWorkers: true,
        cacheSize: 100,
      },
      ultra: {
        maxMemoryMB: 1024,
        targetFPS: 120,
        enableLOD: true,
        enableFrustumCulling: true,
        enableObjectPooling: true,
        adaptiveQuality: true,
        webWorkers: true,
        cacheSize: 200,
      },
    };

    this.setCategorySettings("performance", profiles[profile]);
  }

  // Get Visual Theme
  public getVisualTheme(): "dark" | "light" | "custom" {
    const { backgroundColor } = this.settings.visual;

    if (backgroundColor === "#0a0a0a" || backgroundColor === "#000000") {
      return "dark";
    } else if (backgroundColor === "#ffffff" || backgroundColor === "#f8f9fa") {
      return "light";
    } else {
      return "custom";
    }
  }

  // Set Visual Theme
  public setVisualTheme(theme: "dark" | "light" | "custom"): void {
    const themes = {
      dark: {
        backgroundColor: "#0a0a0a",
        fogEnabled: true,
        shadows: true,
        antialiasing: true,
      },
      light: {
        backgroundColor: "#ffffff",
        fogEnabled: false,
        shadows: true,
        antialiasing: true,
      },
      custom: {
        backgroundColor: this.settings.visual.backgroundColor,
        fogEnabled: this.settings.visual.fogEnabled,
        shadows: this.settings.visual.shadows,
        antialiasing: this.settings.visual.antialiasing,
      },
    };

    this.setCategorySettings("visual", themes[theme]);
  }

  // Optimize Settings for Device
  public optimizeForDevice(): void {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const isLowEnd = this.detectLowEndDevice();

    if (isMobile || isLowEnd) {
      this.setPerformanceProfile("low");
      this.setSetting("visual", "shadows", false);
      this.setSetting("visual", "antialiasing", false);
      this.setSetting("performance", "webWorkers", false);
      this.setSetting("general", "maxNodes", 500);
    } else {
      this.setPerformanceProfile("high");
    }
  }

  // Detect Low End Device
  private detectLowEndDevice(): boolean {
    // Check hardware concurrency
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      return true;
    }

    // Check device memory (if available)
    if ("deviceMemory" in navigator && (navigator as any).deviceMemory < 4) {
      return true;
    }

    // Check canvas performance
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") ||
        (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer.includes("Software") || renderer.includes("Microsoft")) {
            return true;
          }
        }
      }
    } catch (error) {
      // Ignore errors in device detection
    }

    return false;
  }

  // Get Settings Summary
  public getSettingsSummary(): {
    totalSettings: number;
    modifiedSettings: number;
    categories: string[];
    lastModified?: Date;
  } {
    let totalSettings = 0;
    let modifiedSettings = 0;
    const categories: string[] = [];

    Object.entries(this.settings).forEach(([category, categorySettings]) => {
      categories.push(category);
      Object.keys(categorySettings).forEach((key) => {
        totalSettings++;

        // Check if setting differs from default
        if (
          categorySettings[key as keyof typeof categorySettings] !==
          DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS][
            key as keyof (typeof DEFAULT_SETTINGS)[keyof typeof DEFAULT_SETTINGS]
          ]
        ) {
          modifiedSettings++;
        }
      });
    });

    return {
      totalSettings,
      modifiedSettings,
      categories,
      lastModified: this.getLastModified(),
    };
  }

  // Get Last Modified
  private getLastModified(): Date | undefined {
    try {
      const stored = localStorage.getItem(`${this.storageKey}-timestamp`);
      return stored ? new Date(stored) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Dispose
  public dispose(): void {
    this.stopAutoSave();
    this.saveSettings();
    this.listeners.clear();
  }
}

// Settings Validator
export class SettingsValidator {
  // Validate Setting Value
  public static validateValue(category: string, key: string, value: any): boolean {
    const validators: Record<string, Record<string, (value: any) => boolean>> = {
      general: {
        autoSave: (v) => typeof v === "boolean",
        autoSaveInterval: (v) => typeof v === "number" && v >= 1000,
        defaultLayout: (v) => ["tree", "sphere", "cylinder", "spiral"].includes(v),
        maxDepth: (v) => typeof v === "number" && v >= 1 && v <= 10,
        maxNodes: (v) => typeof v === "number" && v >= 100 && v <= 10000,
        showWelcome: (v) => typeof v === "boolean",
        enableTooltips: (v) => typeof v === "boolean",
        language: (v) => typeof v === "string" && v.length >= 2,
      },
      performance: {
        enableLOD: (v) => typeof v === "boolean",
        enableFrustumCulling: (v) => typeof v === "boolean",
        enableObjectPooling: (v) => typeof v === "boolean",
        maxMemoryMB: (v) => typeof v === "number" && v >= 64 && v <= 2048,
        targetFPS: (v) => typeof v === "number" && v >= 15 && v <= 144,
        adaptiveQuality: (v) => typeof v === "boolean",
        webWorkers: (v) => typeof v === "boolean",
        cacheSize: (v) => typeof v === "number" && v >= 10 && v <= 500,
      },
      visual: {
        nodeSize: (v) => typeof v === "number" && v >= 0.1 && v <= 3,
        zoomLevel: (v) => typeof v === "number" && v >= 0.1 && v <= 5,
        showFileLabels: (v) => typeof v === "boolean",
        showDirectoryLabels: (v) => typeof v === "boolean",
        colorBySize: (v) => typeof v === "boolean",
        colorByType: (v) => typeof v === "boolean",
        showHeatMap: (v) => typeof v === "boolean",
        wireframe: (v) => typeof v === "boolean",
        shadows: (v) => typeof v === "boolean",
        antialiasing: (v) => typeof v === "boolean",
        backgroundColor: (v) => typeof v === "string" && /^#[0-9A-F]{6}$/i.test(v),
        fogEnabled: (v) => typeof v === "boolean",
      },
      navigation: {
        autoRotate: (v) => typeof v === "boolean",
        autoRotateSpeed: (v) => typeof v === "number" && v >= 0 && v <= 5,
        enableFlyTo: (v) => typeof v === "boolean",
        flyToDuration: (v) => typeof v === "number" && v >= 100 && v <= 5000,
        mouseSensitivity: (v) => typeof v === "number" && v >= 0.1 && v <= 5,
        scrollSpeed: (v) => typeof v === "number" && v >= 0.1 && v <= 5,
        enableKeyboardShortcuts: (v) => typeof v === "boolean",
        enableGestures: (v) => typeof v === "boolean",
        cameraMode: (v) => ["orbit", "fly", "first-person"].includes(v),
      },
      advanced: {
        debugMode: (v) => typeof v === "boolean",
        showFPS: (v) => typeof v === "boolean",
        showMemoryUsage: (v) => typeof v === "boolean",
        showStatistics: (v) => typeof v === "boolean",
        enableLogging: (v) => typeof v === "boolean",
        logLevel: (v) => ["error", "warn", "info", "debug"].includes(v),
        experimentalFeatures: (v) => typeof v === "boolean",
        developerMode: (v) => typeof v === "boolean",
      },
    };

    const validator = validators[category]?.[key];
    return validator ? validator(value) : false;
  }

  // Sanitize Setting Value
  public static sanitizeValue(_category: string, _key: string, value: any): any {
    // Basic sanitization - can be extended for more complex cases
    if (typeof value === "string") {
      return value.trim();
    }

    if (typeof value === "number") {
      return Number(value);
    }

    if (typeof value === "boolean") {
      return Boolean(value);
    }

    return value;
  }
}

// Settings Migrator
export class SettingsMigrator {
  // Migrate Settings from Old Version
  public static migrate(oldSettings: any, fromVersion: string, toVersion: string): Settings3D {
    let settings = { ...DEFAULT_SETTINGS };

    // Handle different migration scenarios
    if (fromVersion === "1.0" && toVersion === "2.0") {
      settings = this.migrateFrom1_0To2_0(oldSettings);
    } else if (fromVersion === "2.0" && toVersion === "2.1") {
      settings = this.migrateFrom2_0To2_1(oldSettings);
    }

    return settings;
  }

  // Migrate from 1.0 to 2.0
  private static migrateFrom1_0To2_0(oldSettings: any): Settings3D {
    const settings = { ...DEFAULT_SETTINGS };

    // Map old settings to new structure
    if (oldSettings.nodeSize) {
      settings.visual.nodeSize = oldSettings.nodeSize;
    }

    if (oldSettings.enableLOD !== undefined) {
      settings.performance.enableLOD = oldSettings.enableLOD;
    }

    if (oldSettings.autoRotate !== undefined) {
      settings.navigation.autoRotate = oldSettings.autoRotate;
    }

    return settings;
  }

  // Migrate from 2.0 to 2.1
  private static migrateFrom2_0To2_1(oldSettings: any): Settings3D {
    const settings = { ...DEFAULT_SETTINGS };

    // Copy existing settings
    Object.assign(settings, oldSettings);

    // Add new default settings
    settings.advanced.experimentalFeatures = false;
    settings.advanced.developerMode = false;

    return settings;
  }
}

// Global Settings Manager Instance
export const globalSettingsManager = new Settings3DManager();
