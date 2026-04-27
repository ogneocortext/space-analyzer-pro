import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Type,
  Palette,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  MousePointer,
  Keyboard,
  Zap,
  Check,
  X,
} from "lucide-react";

interface AccessibilitySettingsProps {
  onBack?: () => void;
  className?: string;
}

const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({
  onBack,
  className = "",
}) => {
  const [settings, setSettings] = useState({
    highContrast: false,
    reducedMotion: false,
    largeText: false,
    screenReader: false,
    keyboardNavigation: true,
    focusVisible: true,
    darkMode: true,
    soundEffects: false,
    visualIndicators: true,
    tooltipsEnabled: true,
  });

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("accessibility-settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error("Failed to load accessibility settings:", error);
      }
    }
  }, []);

  // Save settings to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem("accessibility-settings", JSON.stringify(settings));

    // Apply settings to document
    const root = document.documentElement;

    // High contrast
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }

    // Large text
    if (settings.largeText) {
      root.classList.add("large-text");
    } else {
      root.classList.remove("large-text");
    }

    // Dark mode
    if (settings.darkMode) {
      root.classList.add("dark-mode");
    } else {
      root.classList.remove("dark-mode");
    }

    // Focus visible
    if (settings.focusVisible) {
      root.classList.add("focus-visible-enabled");
    } else {
      root.classList.remove("focus-visible-enabled");
    }
  }, [settings]);

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetSettings = () => {
    const defaultSettings = {
      highContrast: false,
      reducedMotion: false,
      largeText: false,
      screenReader: false,
      keyboardNavigation: true,
      focusVisible: true,
      darkMode: true,
      soundEffects: false,
      visualIndicators: true,
      tooltipsEnabled: true,
    };
    setSettings(defaultSettings);
  };

  const settingsCategories = [
    {
      title: "Visual",
      icon: Eye,
      settings: [
        { key: "highContrast" as keyof typeof settings, label: "High Contrast", icon: Palette },
        { key: "largeText" as keyof typeof settings, label: "Large Text", icon: Type },
        { key: "darkMode" as keyof typeof settings, label: "Dark Mode", icon: Moon },
        {
          key: "visualIndicators" as keyof typeof settings,
          label: "Visual Indicators",
          icon: Monitor,
        },
      ],
    },
    {
      title: "Interaction",
      icon: MousePointer,
      settings: [
        { key: "reducedMotion" as keyof typeof settings, label: "Reduced Motion", icon: Zap },
        {
          key: "keyboardNavigation" as keyof typeof settings,
          label: "Keyboard Navigation",
          icon: Keyboard,
        },
        { key: "focusVisible" as keyof typeof settings, label: "Focus Indicators", icon: Eye },
        { key: "tooltipsEnabled" as keyof typeof settings, label: "Tooltips", icon: EyeOff },
      ],
    },
    {
      title: "Assistive",
      icon: Volume2,
      settings: [
        {
          key: "screenReader" as keyof typeof settings,
          label: "Screen Reader Mode",
          icon: Volume2,
        },
        { key: "soundEffects" as keyof typeof settings, label: "Sound Effects", icon: VolumeX },
      ],
    },
  ];

  return (
    <div className={`accessibility-settings ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Accessibility Settings</h2>
            <p className="text-sm text-slate-400">Customize your viewing experience</p>
          </div>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white transition-colors focus-enhanced"
            aria-label="Go back to previous page"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Settings Categories */}
      <div className="space-y-6">
        {settingsCategories.map((category) => (
          <div key={category.title} className="content-section polished-card">
            <div className="flex items-center gap-3 mb-4">
              <category.icon className="w-5 h-5 text-blue-400" />
              <h3 className="content-section-title">{category.title}</h3>
            </div>

            <div className="space-y-3">
              {category.settings.map((setting) => {
                const Icon = setting.icon;
                const isEnabled = settings[setting.key];

                return (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-medium text-white">{setting.label}</div>
                        <div className="text-xs text-slate-400">
                          {setting.key === "highContrast" &&
                            "Increase contrast for better visibility"}
                          {setting.key === "largeText" && "Increase font size for readability"}
                          {setting.key === "darkMode" && "Switch between light and dark themes"}
                          {setting.key === "visualIndicators" && "Show visual feedback for actions"}
                          {setting.key === "reducedMotion" && "Minimize animations and transitions"}
                          {setting.key === "keyboardNavigation" && "Enable keyboard shortcuts"}
                          {setting.key === "focusVisible" && "Show focus indicators"}
                          {setting.key === "tooltipsEnabled" && "Display helpful tooltips"}
                          {setting.key === "screenReader" && "Optimize for screen readers"}
                          {setting.key === "soundEffects" && "Enable audio feedback"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleSetting(setting.key)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors focus-enhanced
                        ${isEnabled ? "bg-blue-600" : "bg-slate-600"}
                      `}
                      role="switch"
                      aria-checked={isEnabled ? "true" : "false"}
                      aria-label={`Toggle ${setting.label}`}
                    >
                      <div
                        className={`
                          absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                          ${isEnabled ? "translate-x-6" : "translate-x-1"}
                        `}
                      />
                      {isEnabled && <Check className="absolute top-1 right-1 w-2 h-2 text-white" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-lg">
        <h4 className="font-medium text-white mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={resetSettings}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors focus-enhanced"
          >
            Reset to Defaults
          </button>
          <button
            onClick={() => {
              // Apply preset for visual impairments
              setSettings((prev) => ({
                ...prev,
                highContrast: true,
                largeText: true,
                visualIndicators: true,
                focusVisible: true,
              }));
            }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors focus-enhanced"
          >
            Visual Preset
          </button>
          <button
            onClick={() => {
              // Apply preset for motor impairments
              setSettings((prev) => ({
                ...prev,
                reducedMotion: true,
                keyboardNavigation: true,
                focusVisible: true,
                tooltipsEnabled: true,
              }));
            }}
            className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors focus-enhanced"
          >
            Motor Preset
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Eye className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-white mb-1">Accessibility Information</h4>
            <p className="text-sm text-slate-300 mb-2">
              These settings help customize Space Analyzer for different accessibility needs.
              Changes are saved automatically and will persist across sessions.
            </p>
            <div className="text-xs text-slate-400">
              <p>• Settings are stored locally in your browser</p>
              <p>• Some changes may require a page refresh to take full effect</p>
              <p>• Keyboard shortcuts: Tab to navigate, Enter to toggle</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessibilitySettings;
