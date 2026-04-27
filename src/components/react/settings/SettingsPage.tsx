import React, { useState } from "react";
import {
  Palette,
  Search,
  Bell,
  Cpu,
  Database,
  Info,
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";

interface SettingsPageProps {
  onSettingsChange?: (settings: any) => void;
}

/**
 * Comprehensive Settings Page Component
 * Full-featured settings interface with multiple categories
 */
const SettingsPage: React.FC<SettingsPageProps> = ({ onSettingsChange }) => {
  const [activeSection, setActiveSection] = useState("appearance");
  const [settings, setSettings] = useState({
    // Appearance
    theme: "dark",
    accentColor: "#3b82f6",
    fontSize: "medium",
    compactMode: false,

    // Analysis Preferences
    defaultScanDepth: 3,
    excludeFileTypes: [".tmp", ".log"],
    includeHiddenFiles: false,
    followSymlinks: true,

    // Notifications
    notificationsEnabled: true,
    analysisCompleteAlerts: true,
    lowDiskSpaceWarnings: true,
    duplicateFoundNotifications: false,

    // Performance
    maxThreads: 4,
    memoryLimit: "1GB",
    backgroundAnalysis: false,
    cacheSize: "500MB",

    // Data & Privacy
    dataRetentionPeriod: 90,
    analyticsEnabled: false,
    autoExportEnabled: false,
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    onSettingsChange?.(newSettings);
  };

  const saveSettings = () => {
    // In a real app, this would save to backend/localStorage
    localStorage.setItem("space-analyzer-settings", JSON.stringify(settings));
    setHasUnsavedChanges(false);
    // Show success message
    alert("Settings saved successfully!");
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      theme: "dark",
      accentColor: "#3b82f6",
      fontSize: "medium",
      compactMode: false,
      defaultScanDepth: 3,
      excludeFileTypes: [".tmp", ".log"],
      includeHiddenFiles: false,
      followSymlinks: true,
      notificationsEnabled: true,
      analysisCompleteAlerts: true,
      lowDiskSpaceWarnings: true,
      duplicateFoundNotifications: false,
      maxThreads: 4,
      memoryLimit: "1GB",
      backgroundAnalysis: false,
      cacheSize: "500MB",
      dataRetentionPeriod: 90,
      analyticsEnabled: false,
      autoExportEnabled: false,
    };
    setSettings(defaultSettings);
    setHasUnsavedChanges(true);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = "space-analyzer-settings.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          setSettings({ ...settings, ...importedSettings });
          setHasUnsavedChanges(true);
        } catch (error) {
          alert("Invalid settings file");
        }
      };
      reader.readAsText(file);
    }
  };

  const sections = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "analysis", label: "Analysis Preferences", icon: Search },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "performance", label: "Performance", icon: Cpu },
    { id: "data-privacy", label: "Data & Privacy", icon: Database },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <div className="settings-page max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <SettingsIcon size={32} />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-slate-300">Customize your Space Analyzer Pro experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-lg p-4">
            <nav className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Action Buttons */}
            <div className="mt-6 space-y-2">
              <button
                onClick={saveSettings}
                disabled={!hasUnsavedChanges}
                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  hasUnsavedChanges
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Save size={16} />
                <span>Save Settings</span>
              </button>

              <button
                onClick={resetToDefaults}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                <RotateCcw size={16} />
                <span>Reset to Defaults</span>
              </button>

              <button
                onClick={exportSettings}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Download size={16} />
                <span>Export Settings</span>
              </button>

              <label className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer">
                <Upload size={16} />
                <span>Import Settings</span>
                <input type="file" accept=".json" onChange={importSettings} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-800 rounded-lg p-6">
            {activeSection === "appearance" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Palette className="text-blue-400" size={24} />
                  <h2 className="text-2xl font-bold text-white">Appearance</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                    <select
                      value={settings.theme}
                      onChange={(e) => updateSetting("theme", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Accent Color
                    </label>
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => updateSetting("accentColor", e.target.value)}
                      className="w-full h-10 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Font Size
                    </label>
                    <select
                      value={settings.fontSize}
                      onChange={(e) => updateSetting("fontSize", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Compact Mode</h4>
                      <p className="text-sm text-slate-400">Reduce spacing and padding</p>
                    </div>
                    <button
                      onClick={() => updateSetting("compactMode", !settings.compactMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.compactMode ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.compactMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "analysis" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Search className="text-green-400" size={24} />
                  <h2 className="text-2xl font-bold text-white">Analysis Preferences</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Default Scan Depth
                    </label>
                    <input
                      type="number"
                      value={settings.defaultScanDepth}
                      onChange={(e) => updateSetting("defaultScanDepth", parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      min="1"
                      max="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Exclude File Types
                    </label>
                    <input
                      type="text"
                      value={settings.excludeFileTypes.join(", ")}
                      onChange={(e) =>
                        updateSetting(
                          "excludeFileTypes",
                          e.target.value.split(",").map((s) => s.trim())
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder=".tmp, .log, .cache"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Include Hidden Files</h4>
                      <p className="text-sm text-slate-400">Scan files starting with dot</p>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting("includeHiddenFiles", !settings.includeHiddenFiles)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.includeHiddenFiles ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.includeHiddenFiles ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Follow Symlinks</h4>
                      <p className="text-sm text-slate-400">Follow symbolic links during scan</p>
                    </div>
                    <button
                      onClick={() => updateSetting("followSymlinks", !settings.followSymlinks)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.followSymlinks ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.followSymlinks ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Bell className="text-yellow-400" size={24} />
                  <h2 className="text-2xl font-bold text-white">Notifications</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                    <div>
                      <h4 className="font-medium text-white">Enable Notifications</h4>
                      <p className="text-sm text-slate-400">Receive system notifications</p>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting("notificationsEnabled", !settings.notificationsEnabled)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.notificationsEnabled ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.notificationsEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {settings.notificationsEnabled && (
                    <>
                      <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                        <div>
                          <h4 className="font-medium text-white">Analysis Complete Alerts</h4>
                          <p className="text-sm text-slate-400">Notify when analysis finishes</p>
                        </div>
                        <button
                          onClick={() =>
                            updateSetting(
                              "analysisCompleteAlerts",
                              !settings.analysisCompleteAlerts
                            )
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.analysisCompleteAlerts ? "bg-blue-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.analysisCompleteAlerts ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                        <div>
                          <h4 className="font-medium text-white">Low Disk Space Warnings</h4>
                          <p className="text-sm text-slate-400">Alert when disk space is low</p>
                        </div>
                        <button
                          onClick={() =>
                            updateSetting("lowDiskSpaceWarnings", !settings.lowDiskSpaceWarnings)
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.lowDiskSpaceWarnings ? "bg-blue-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.lowDiskSpaceWarnings ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                        <div>
                          <h4 className="font-medium text-white">Duplicate Found Notifications</h4>
                          <p className="text-sm text-slate-400">Notify when duplicates are found</p>
                        </div>
                        <button
                          onClick={() =>
                            updateSetting(
                              "duplicateFoundNotifications",
                              !settings.duplicateFoundNotifications
                            )
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.duplicateFoundNotifications ? "bg-blue-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.duplicateFoundNotifications
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === "performance" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Cpu className="text-purple-400" size={24} />
                  <h2 className="text-2xl font-bold text-white">Performance</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Max Threads
                    </label>
                    <input
                      type="number"
                      value={settings.maxThreads}
                      onChange={(e) => updateSetting("maxThreads", parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      min="1"
                      max="16"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Memory Limit
                    </label>
                    <select
                      value={settings.memoryLimit}
                      onChange={(e) => updateSetting("memoryLimit", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="512MB">512 MB</option>
                      <option value="1GB">1 GB</option>
                      <option value="2GB">2 GB</option>
                      <option value="4GB">4 GB</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Background Analysis</h4>
                      <p className="text-sm text-slate-400">Run analysis in background</p>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting("backgroundAnalysis", !settings.backgroundAnalysis)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.backgroundAnalysis ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.backgroundAnalysis ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Cache Size
                    </label>
                    <select
                      value={settings.cacheSize}
                      onChange={(e) => updateSetting("cacheSize", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="100MB">100 MB</option>
                      <option value="500MB">500 MB</option>
                      <option value="1GB">1 GB</option>
                      <option value="2GB">2 GB</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "data-privacy" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Database className="text-red-400" size={24} />
                  <h2 className="text-2xl font-bold text-white">Data & Privacy</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Data Retention Period (days)
                    </label>
                    <input
                      type="number"
                      value={settings.dataRetentionPeriod}
                      onChange={(e) =>
                        updateSetting("dataRetentionPeriod", parseInt(e.target.value))
                      }
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      min="7"
                      max="365"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Analytics</h4>
                      <p className="text-sm text-slate-400">Help improve the app with usage data</p>
                    </div>
                    <button
                      onClick={() => updateSetting("analyticsEnabled", !settings.analyticsEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.analyticsEnabled ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.analyticsEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Auto Export</h4>
                      <p className="text-sm text-slate-400">
                        Automatically export analysis results
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting("autoExportEnabled", !settings.autoExportEnabled)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.autoExportEnabled ? "bg-blue-600" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.autoExportEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-slate-700 rounded-lg">
                  <h4 className="font-medium text-white mb-2">Data Management</h4>
                  <div className="space-y-2">
                    <button className="w-full text-left px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm text-slate-300 hover:text-white transition-colors">
                      Clear Analysis History
                    </button>
                    <button className="w-full text-left px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm text-slate-300 hover:text-white transition-colors">
                      Export All Data
                    </button>
                    <button className="w-full text-left px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors">
                      Delete All Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "about" && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Info className="text-cyan-400" size={24} />
                  <h2 className="text-2xl font-bold text-white">About</h2>
                </div>

                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Space Analyzer Pro</h3>
                    <p className="text-slate-400">Version 1.0.0</p>
                    <p className="text-slate-400">Advanced AI-powered file system analysis</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-700 rounded-lg text-center">
                      <h4 className="font-medium text-white mb-1">License</h4>
                      <p className="text-sm text-slate-400">MIT License</p>
                    </div>
                    <div className="p-4 bg-slate-700 rounded-lg text-center">
                      <h4 className="font-medium text-white mb-1">Platform</h4>
                      <p className="text-sm text-slate-400">Web Application</p>
                    </div>
                    <div className="p-4 bg-slate-700 rounded-lg text-center">
                      <h4 className="font-medium text-white mb-1">Technology</h4>
                      <p className="text-sm text-slate-400">React + TypeScript</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-white">Credits</h4>
                    <div className="space-y-2 text-sm text-slate-400">
                      <p>• Built with React, TypeScript, and Tailwind CSS</p>
                      <p>• Icons by Lucide React</p>
                      <p>• Charts powered by custom visualization engine</p>
                      <p>• AI features integrated with Ollama</p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors">
                      Check for Updates
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
