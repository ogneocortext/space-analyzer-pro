import React, { useState } from 'react';
import { Settings, Database, Cpu, HardDrive, Shield, Bell, Palette, Globe } from 'lucide-react';

interface SystemSettingsProps {
  onSettingsChange?: (settings: any) => void;
}

/**
 * System Settings Component
 * Configuration panel for system preferences and settings
 */
const SystemSettings: React.FC<SystemSettingsProps> = ({ onSettingsChange }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'performance' | 'security' | 'notifications'>('general');
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'en',
    autoSave: true,
    cacheSize: '500MB',
    maxConnections: 10,
    enableSecurity: true,
    enableNotifications: true,
    notificationSound: true
  });

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'performance', label: 'Performance', icon: Cpu },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="system-settings space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
        <p className="text-gray-600">Configure your Space Analyzer preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex space-x-1 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                aria-label={`${tab.label} settings`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => updateSetting('theme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  aria-label="Select theme"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSetting('language', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  aria-label="Select language"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Auto Save</h4>
                  <p className="text-sm text-gray-600">Automatically save analysis results</p>
                </div>
                <button
                  onClick={() => updateSetting('autoSave', !settings.autoSave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoSave ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle auto save"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoSave ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache Size
                </label>
                <select
                  value={settings.cacheSize}
                  onChange={(e) => updateSetting('cacheSize', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  aria-label="Select cache size"
                >
                  <option value="100MB">100 MB</option>
                  <option value="500MB">500 MB</option>
                  <option value="1GB">1 GB</option>
                  <option value="2GB">2 GB</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Connections
                </label>
                <input
                  type="number"
                  value={settings.maxConnections}
                  onChange={(e) => updateSetting('maxConnections', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  max="20"
                  aria-label="Maximum connections"
                />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Enable Security</h4>
                  <p className="text-sm text-gray-600">Enable security features and protections</p>
                </div>
                <button
                  onClick={() => updateSetting('enableSecurity', !settings.enableSecurity)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enableSecurity ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle security"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enableSecurity ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Enable Notifications</h4>
                  <p className="text-sm text-gray-600">Receive system notifications</p>
                </div>
                <button
                  onClick={() => updateSetting('enableNotifications', !settings.enableNotifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enableNotifications ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle notifications"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enableNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Notification Sound</h4>
                  <p className="text-sm text-gray-600">Play sound for notifications</p>
                </div>
                <button
                  onClick={() => updateSetting('notificationSound', !settings.notificationSound)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notificationSound ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle notification sound"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notificationSound ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
