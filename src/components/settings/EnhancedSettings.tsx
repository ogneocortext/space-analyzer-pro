import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Palette,
  Search,
  Bell,
  Cpu,
  Database,
  Info,
  Save,
  RotateCcw,
  Download,
  Upload,
  X,
  Check,
  AlertTriangle,
  Filter,
  User,
  Shield,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Moon,
  Sun,
  Zap,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Edit,
  Trash2,
  Copy,
  Share2,
  RefreshCw,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Volume2,
  Wifi,
  HardDrive,
  MemoryStick,
  Network,
  FileText,
  Folder,
  Tag,
  Star,
  Heart,
  Bookmark,
  Archive,
  Settings2,
  UserCheck,
  Users,
  Fingerprint,
  Smartphone as SmartphoneIcon
} from 'lucide-react';
import styles from './EnhancedSettings.module.css';

interface SettingsPageProps {
  onSettingsChange?: (settings: any) => void;
}

interface SettingsProfile {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  settings: Partial<SettingsState>;
  isDefault?: boolean;
  isCustom?: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

interface SettingsState {
  // Appearance
  theme: 'light' | 'dark' | 'auto' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  animationsEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  customCSS: string;
  
  // Analysis Preferences
  defaultScanDepth: number;
  excludeFileTypes: string[];
  includeHiddenFiles: boolean;
  followSymlinks: boolean;
  maxFileSize: string;
  excludePatterns: string[];
  scanTimeout: number;
  
  // Notifications
  notificationsEnabled: boolean;
  analysisCompleteAlerts: boolean;
  lowDiskSpaceWarnings: boolean;
  duplicateFoundNotifications: boolean;
  systemAlerts: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  
  // Performance
  maxThreads: number;
  memoryLimit: string;
  backgroundAnalysis: boolean;
  cacheSize: string;
  gpuAcceleration: boolean;
  webWorkers: boolean;
  
  // Data & Privacy
  dataRetentionPeriod: number;
  analyticsEnabled: boolean;
  autoExportEnabled: boolean;
  crashReports: boolean;
  telemetryEnabled: boolean;
  dataEncryption: boolean;
  
  // Accessibility
  screenReaderEnabled: boolean;
  keyboardNavigation: boolean;
  highDPI: boolean;
  fontSizeScaling: number;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  
  // Advanced
  developerMode: boolean;
  debugMode: boolean;
  experimentalFeatures: boolean;
  betaFeatures: boolean;
  customAPIEndpoints: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const EnhancedSettings: React.FC<SettingsPageProps> = ({ onSettingsChange }) => {
  // State management
  const [activeSection, setActiveSection] = useState('appearance');
  const [settings, setSettings] = useState<SettingsState>({
    // Appearance
    theme: 'dark',
    accentColor: '#3b82f6',
    fontSize: 'medium',
    compactMode: false,
    animationsEnabled: true,
    reducedMotion: false,
    highContrast: false,
    customCSS: '',
    
    // Analysis Preferences
    defaultScanDepth: 3,
    excludeFileTypes: ['.tmp', '.log', '.cache'],
    includeHiddenFiles: false,
    followSymlinks: true,
    maxFileSize: '100MB',
    excludePatterns: ['node_modules', '.git', 'dist'],
    scanTimeout: 300,
    
    // Notifications
    notificationsEnabled: true,
    analysisCompleteAlerts: true,
    lowDiskSpaceWarnings: true,
    duplicateFoundNotifications: false,
    systemAlerts: true,
    soundEnabled: true,
    desktopNotifications: false,
    
    // Performance
    maxThreads: 4,
    memoryLimit: '1GB',
    backgroundAnalysis: false,
    cacheSize: '500MB',
    gpuAcceleration: true,
    webWorkers: true,
    
    // Data & Privacy
    dataRetentionPeriod: 90,
    analyticsEnabled: false,
    autoExportEnabled: false,
    crashReports: true,
    telemetryEnabled: false,
    dataEncryption: true,
    
    // Accessibility
    screenReaderEnabled: false,
    keyboardNavigation: true,
    highDPI: true,
    fontSizeScaling: 1.0,
    colorBlindMode: 'none',
    
    // Advanced
    developerMode: false,
    debugMode: false,
    experimentalFeatures: false,
    betaFeatures: false,
    customAPIEndpoints: false
  });

  const [profiles, setProfiles] = useState<SettingsProfile[]>([
    {
      id: 'default',
      name: 'Default',
      description: 'Standard configuration for most users',
      icon: <SettingsIcon size={20} />,
      settings: {},
      isDefault: true,
      isCustom: false,
      createdAt: new Date()
    },
    {
      id: 'performance',
      name: 'Performance',
      description: 'Optimized for maximum performance',
      icon: <Zap size={20} />,
      settings: {
        animationsEnabled: false,
        backgroundAnalysis: true,
        gpuAcceleration: true,
        webWorkers: true,
        cacheSize: '1GB'
      },
      isDefault: false,
      isCustom: false,
      createdAt: new Date()
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      description: 'Enhanced accessibility features',
      icon: <UserCheck size={20} />,
      settings: {
        fontSize: 'large',
        highContrast: true,
        screenReaderEnabled: true,
        keyboardNavigation: true,
        reducedMotion: true
      },
      isDefault: false,
      isCustom: false,
      createdAt: new Date()
    }
  ]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState('default');

  // Settings sections
  const sections = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'analysis', label: 'Analysis Preferences', icon: Search },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'performance', label: 'Performance', icon: Cpu },
    { id: 'data-privacy', label: 'Data & Privacy', icon: Shield },
    { id: 'accessibility', label: 'Accessibility', icon: User },
    { id: 'advanced', label: 'Advanced', icon: Settings2 },
    { id: 'about', label: 'About', icon: Info }
  ];

  // Update settings with validation
  const updateSetting = useCallback((key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    onSettingsChange?.(newSettings);
    
    // Validate settings
    validateSettings(newSettings);
  }, [settings, onSettingsChange]);

  // Validate settings
  const validateSettings = useCallback((settingsToValidate: SettingsState) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate scan depth
    if (settingsToValidate.defaultScanDepth < 1 || settingsToValidate.defaultScanDepth > 10) {
      errors.push('Scan depth must be between 1 and 10');
    }

    // Validate memory limit
    const memoryLimitMB = parseInt(settingsToValidate.memoryLimit);
    if (memoryLimitMB < 100 || memoryLimitMB > 16384) {
      errors.push('Memory limit must be between 100MB and 16GB');
    }

    // Validate max threads
    if (settingsToValidate.maxThreads < 1 || settingsToValidate.maxThreads > 32) {
      errors.push('Max threads must be between 1 and 32');
    }

    // Validate data retention
    if (settingsToValidate.dataRetentionPeriod < 7 || settingsToValidate.dataRetentionPeriod > 365) {
      warnings.push('Data retention period should be between 7 and 365 days');
    }

    setValidationResults({
      isValid: errors.length === 0,
      errors,
      warnings
    });
  }, []);

  // Save settings
  const saveSettings = useCallback(() => {
    if (!validationResults.isValid) {
      alert('Please fix validation errors before saving');
      return;
    }

    // Save to localStorage
    localStorage.setItem('space-analyzer-settings', JSON.stringify(settings));
    
    // Save to backend (mock)
    console.log('Settings saved to backend:', settings);
    
    setHasUnsavedChanges(false);
    
    // Show success message
    showNotification('Settings saved successfully!', 'success');
  }, [settings, validationResults]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaultSettings: SettingsState = {
      theme: 'dark',
      accentColor: '#3b82f6',
      fontSize: 'medium',
      compactMode: false,
      animationsEnabled: true,
      reducedMotion: false,
      highContrast: false,
      customCSS: '',
      defaultScanDepth: 3,
      excludeFileTypes: ['.tmp', '.log', '.cache'],
      includeHiddenFiles: false,
      followSymlinks: true,
      maxFileSize: '100MB',
      excludePatterns: ['node_modules', '.git', 'dist'],
      scanTimeout: 300,
      notificationsEnabled: true,
      analysisCompleteAlerts: true,
      lowDiskSpaceWarnings: true,
      duplicateFoundNotifications: false,
      systemAlerts: true,
      soundEnabled: true,
      desktopNotifications: false,
      maxThreads: 4,
      memoryLimit: '1GB',
      backgroundAnalysis: false,
      cacheSize: '500MB',
      gpuAcceleration: true,
      webWorkers: true,
      dataRetentionPeriod: 90,
      analyticsEnabled: false,
      autoExportEnabled: false,
      crashReports: true,
      telemetryEnabled: false,
      dataEncryption: true,
      screenReaderEnabled: false,
      keyboardNavigation: true,
      highDPI: true,
      fontSizeScaling: 1.0,
      colorBlindMode: 'none',
      developerMode: false,
      debugMode: false,
      experimentalFeatures: false,
      betaFeatures: false,
      customAPIEndpoints: false
    };
    
    setSettings(defaultSettings);
    setHasUnsavedChanges(true);
    validateSettings(defaultSettings);
  }, [validateSettings]);

  // Export settings
  const exportSettings = useCallback(() => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `space-analyzer-settings-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Settings exported successfully!', 'success');
  }, [settings]);

  // Import settings
  const importSettings = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          setSettings({ ...settings, ...importedSettings });
          setHasUnsavedChanges(true);
          validateSettings({ ...settings, ...importedSettings });
          showNotification('Settings imported successfully!', 'success');
        } catch (error) {
          showNotification('Invalid settings file', 'error');
        }
      };
      reader.readAsText(file);
    }
  }, [settings, validateSettings]);

  // Apply profile
  const applyProfile = useCallback((profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setSettings({ ...settings, ...profile.settings });
      setHasUnsavedChanges(true);
      setActiveProfile(profileId);
      showNotification(`Applied ${profile.name} profile`, 'success');
    }
  }, [profiles, settings]);

  // Save current settings as profile
  const saveAsProfile = useCallback((name: string, description: string) => {
    const newProfile: SettingsProfile = {
      id: `custom-${Date.now()}`,
      name,
      description,
      icon: <Star size={20} />,
      settings: { ...settings },
      isDefault: false,
      isCustom: true,
      createdAt: new Date()
    };
    
    setProfiles([...profiles, newProfile]);
    showNotification('Profile saved successfully!', 'success');
  }, [settings, profiles]);

  // Delete profile
  const deleteProfile = useCallback((profileId: string) => {
    if (profileId === 'default') {
      showNotification('Cannot delete default profile', 'error');
      return;
    }
    
    setProfiles(profiles.filter(p => p.id !== profileId));
    showNotification('Profile deleted successfully!', 'success');
  }, [profiles]);

  // Show notification
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    // Mock notification system
    console.log(`${type.toUpperCase()}: ${message}`);
  }, []);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    
    return sections.filter(section =>
      section.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            saveSettings();
            break;
          case 'r':
            event.preventDefault();
            resetToDefaults();
            break;
          case 'e':
            event.preventDefault();
            exportSettings();
            break;
          case 'f':
            event.preventDefault();
            setIsFullscreen(prev => !prev);
            break;
          case 'h':
            event.preventDefault();
            setShowHelp(true);
            break;
        }
      }
      
      switch (event.key) {
        case 'Escape':
          setShowHelp(false);
          setShowProfileModal(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveSettings, resetToDefaults, exportSettings]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('space-analyzer-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({ ...settings, ...parsedSettings });
        validateSettings({ ...settings, ...parsedSettings });
      } catch (error) {
        console.error('Failed to load saved settings:', error);
      }
    }
  }, []);

  return (
    <div className={`${styles.enhancedSettings} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <SettingsIcon className={styles.headerIcon} />
            <h1>Settings</h1>
            <div className={styles.headerSubtitle}>Configure your Space Analyzer</div>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <div className={styles.searchContainer}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`${styles.controlButton} ${showAdvanced ? styles.active : ''}`}
              title="Toggle Advanced Settings"
            >
              <Sliders size={16} />
            </button>
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={styles.controlButton}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Monitor size={16} /> : <Monitor size={16} />}
            </button>
            
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={styles.controlButton}
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
          
          <div className={styles.saveStatus}>
            {hasUnsavedChanges && (
              <div className={styles.unsavedIndicator}>
                <AlertTriangle size={14} />
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        <div className={styles.grid}>
          {/* Sidebar Navigation */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h3>Categories</h3>
            </div>
            
            <nav className={styles.navigation}>
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`${styles.navButton} ${activeSection === section.id ? styles.active : ''}`}
                  >
                    <Icon size={18} />
                    <span>{section.label}</span>
                    {activeSection === section.id && <ChevronRight size={16} />}
                  </button>
                );
              })}
            </nav>
            
            {/* Profile Management */}
            <div className={styles.profileSection}>
              <div className={styles.profileHeader}>
                <h3>Profiles</h3>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className={styles.addButton}
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className={styles.profileList}>
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={`${styles.profileItem} ${activeProfile === profile.id ? styles.active : ''}`}
                  >
                    <button
                      onClick={() => applyProfile(profile.id)}
                      className={styles.profileButton}
                    >
                      <div className={styles.profileIcon}>{profile.icon}</div>
                      <div className={styles.profileInfo}>
                        <span className={styles.profileName}>{profile.name}</span>
                        <span className={styles.profileDescription}>{profile.description}</span>
                      </div>
                    </button>
                    
                    {profile.isCustom && (
                      <button
                        onClick={() => deleteProfile(profile.id)}
                        className={styles.deleteButton}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className={styles.actionButtons}>
              <button
                onClick={saveSettings}
                disabled={!hasUnsavedChanges || !validationResults.isValid}
                className={`${styles.saveButton} ${!hasUnsavedChanges || !validationResults.isValid ? styles.disabled : ''}`}
              >
                <Save size={16} />
                Save Settings
              </button>
              
              <button
                onClick={resetToDefaults}
                className={styles.resetButton}
              >
                <RotateCcw size={16} />
                Reset to Defaults
              </button>
              
              <div className={styles.importExportButtons}>
                <button
                  onClick={() => document.getElementById('import-settings')?.click()}
                  className={styles.importButton}
                >
                  <Upload size={16} />
                  Import
                </button>
                <input
                  id="import-settings"
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  className={styles.fileInput}
                />
                
                <button
                  onClick={exportSettings}
                  className={styles.exportButton}
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Settings Content */}
          <div className={styles.settingsContent}>
            {/* Validation Errors */}
            {!validationResults.isValid && (
              <div className={styles.validationErrors}>
                <h4>Please fix the following errors:</h4>
                <ul>
                  {validationResults.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Validation Warnings */}
            {validationResults.warnings.length > 0 && (
              <div className={styles.validationWarnings}>
                <h4>Warnings:</h4>
                <ul>
                  {validationResults.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Settings Sections */}
            {activeSection === 'appearance' && (
              <div className={styles.section}>
                <h2>Appearance</h2>
                <div className={styles.settingsGrid}>
                  <div className={styles.settingGroup}>
                    <h3>Theme</h3>
                    <div className={styles.settingControl}>
                      <label>Theme Mode</label>
                      <select
                        value={settings.theme}
                        onChange={(e) => updateSetting('theme', e.target.value)}
                        className={styles.select}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                    
                    <div className={styles.settingControl}>
                      <label>Accent Color</label>
                      <div className={styles.colorPicker}>
                        <input
                          type="color"
                          value={settings.accentColor}
                          onChange={(e) => updateSetting('accentColor', e.target.value)}
                          className={styles.colorInput}
                        />
                        <span>{settings.accentColor}</span>
                      </div>
                    </div>
                    
                    <div className={styles.settingControl}>
                      <label>Font Size</label>
                      <select
                        value={settings.fontSize}
                        onChange={(e) => updateSetting('fontSize', e.target.value)}
                        className={styles.select}
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <h3>Display Options</h3>
                    <div className={styles.toggleControl}>
                      <label>Compact Mode</label>
                      <button
                        onClick={() => updateSetting('compactMode', !settings.compactMode)}
                        className={`${styles.toggle} ${settings.compactMode ? styles.active : ''}`}
                      >
                        <div className={styles.toggleSlider} />
                      </button>
                    </div>
                    
                    <div className={styles.toggleControl}>
                      <label>Animations</label>
                      <button
                        onClick={() => updateSetting('animationsEnabled', !settings.animationsEnabled)}
                        className={`${styles.toggle} ${settings.animationsEnabled ? styles.active : ''}`}
                      >
                        <div className={styles.toggleSlider} />
                      </button>
                    </div>
                    
                    <div className={styles.toggleControl}>
                      <label>Reduced Motion</label>
                      <button
                        onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
                        className={`${styles.toggle} ${settings.reducedMotion ? styles.active : ''}`}
                      >
                        <div className={styles.toggleSlider} />
                      </button>
                    </div>
                    
                    <div className={styles.toggleControl}>
                      <label>High Contrast</label>
                      <button
                        onClick={() => updateSetting('highContrast', !settings.highContrast)}
                        className={`${styles.toggle} ${settings.highContrast ? styles.active : ''}`}
                      >
                        <div className={styles.toggleSlider} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'analysis' && (
              <div className={styles.section}>
                <h2>Analysis Preferences</h2>
                <div className={styles.settingsGrid}>
                  <div className={styles.settingGroup}>
                    <h3>Scan Settings</h3>
                    <div className={styles.settingControl}>
                      <label>Default Scan Depth</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.defaultScanDepth}
                        onChange={(e) => updateSetting('defaultScanDepth', parseInt(e.target.value))}
                        className={styles.numberInput}
                      />
                    </div>
                    
                    <div className={styles.settingControl}>
                      <label>Max File Size</label>
                      <select
                        value={settings.maxFileSize}
                        onChange={(e) => updateSetting('maxFileSize', e.target.value)}
                        className={styles.select}
                      >
                        <option value="10MB">10MB</option>
                        <option value="50MB">50MB</option>
                        <option value="100MB">100MB</option>
                        <option value="500MB">500MB</option>
                        <option value="1GB">1GB</option>
                      </select>
                    </div>
                    
                    <div className={styles.settingControl}>
                      <label>Scan Timeout (seconds)</label>
                      <input
                        type="number"
                        min="30"
                        max="600"
                        value={settings.scanTimeout}
                        onChange={(e) => updateSetting('scanTimeout', parseInt(e.target.value))}
                        className={styles.numberInput}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <h3>File Handling</h3>
                    <div className={styles.toggleControl}>
                      <label>Include Hidden Files</label>
                      <button
                        onClick={() => updateSetting('includeHiddenFiles', !settings.includeHiddenFiles)}
                        className={`${styles.toggle} ${settings.includeHiddenFiles ? styles.active : ''}`}
                      >
                        <div className={styles.toggleSlider} />
                      </button>
                    </div>
                    
                    <div className={styles.toggleControl}>
                      <label>Follow Symbolic Links</label>
                      <button
                        onClick={() => updateSetting('followSymlinks', !settings.followSymlinks)}
                        className={`${styles.toggle} ${settings.followSymlinks ? styles.active : ''}`}
                      >
                        <div className={styles.toggleSlider} />
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <h3>Exclude Patterns</h3>
                    <div className={styles.listControl}>
                      {settings.excludePatterns.map((pattern, index) => (
                        <div key={index} className={styles.listItem}>
                          <input
                            type="text"
                            value={pattern}
                            onChange={(e) => {
                              const newPatterns = [...settings.excludePatterns];
                              newPatterns[index] = e.target.value;
                              updateSetting('excludePatterns', newPatterns);
                            }}
                            className={styles.textInput}
                          />
                          <button
                            onClick={() => {
                              const newPatterns = settings.excludePatterns.filter((_, i) => i !== index);
                              updateSetting('excludePatterns', newPatterns);
                            }}
                            className={styles.removeButton}
                          >
                            <Minus size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateSetting('excludePatterns', [...settings.excludePatterns, ''])}
                        className={styles.addButton}
                      >
                        <Plus size={16} />
                        Add Pattern
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add other sections... */}
            
            {activeSection === 'about' && (
              <div className={styles.section}>
                <h2>About</h2>
                <div className={styles.aboutContent}>
                  <div className={styles.aboutHeader}>
                    <div className={styles.appInfo}>
                      <h3>Space Analyzer Pro</h3>
                      <p>Version 2.0.0</p>
                      <p>Advanced file system analysis tool</p>
                    </div>
                  </div>
                  
                  <div className={styles.aboutDetails}>
                    <div className={styles.aboutSection}>
                      <h4>Features</h4>
                      <ul>
                        <li>Real-time file system analysis</li>
                        <li>Interactive visualizations</li>
                        <li>AI-powered insights</li>
                        <li>Performance monitoring</li>
                        <li>Export capabilities</li>
                      </ul>
                    </div>
                    
                    <div className={styles.aboutSection}>
                      <h4>Technologies</h4>
                      <ul>
                        <li>React with TypeScript</li>
                        <li>Framer Motion animations</li>
                        <li>Tailwind CSS</li>
                        <li>Web Workers</li>
                        <li>IndexedDB</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className={styles.helpOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.helpContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.helpHeader}>
                <h3>Settings Help</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li><kbd>Ctrl+S</kbd> - Save settings</li>
                    <li><kbd>Ctrl+R</kbd> - Reset to defaults</li>
                    <li><kbd>Ctrl+E</kbd> - Export settings</li>
                    <li><kbd>Ctrl+F</kbd> - Toggle fullscreen</li>
                    <li><kbd>Ctrl+H</kbd> - Show help</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Profiles</h4>
                  <ul>
                    <li><strong>Default:</strong> Standard configuration</li>
                    <li><strong>Performance:</strong> Optimized for speed</li>
                    <li><strong>Accessibility:</strong> Enhanced accessibility</li>
                    <li>Create custom profiles for your needs</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Settings Categories</h4>
                  <ul>
                    <li><strong>Appearance:</strong> Theme and display options</li>
                    <li><strong>Analysis:</strong> Scan preferences</li>
                    <li><strong>Notifications:</strong> Alert preferences</li>
                    <li><strong>Performance:</strong> Resource management</li>
                    <li><strong>Data & Privacy:</strong> Privacy settings</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedSettings;
