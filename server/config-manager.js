const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
  constructor(configPath = path.join(__dirname, '..', 'config')) {
    this.configPath = configPath;
    this.config = new Map();
    this.defaultConfig = this.getDefaultConfig();
    this.configFile = path.join(configPath, 'app-config.json');
    this.userConfigFile = path.join(configPath, 'user-config.json');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.configPath, { recursive: true });
      await this.loadConfig();
    } catch (error) {
      console.error('Failed to initialize config manager:', error);
    }
  }

  getDefaultConfig() {
    return {
      // Application settings
      app: {
        name: 'Space Analyzer',
        version: '2.0.0',
        port: 8080,
        host: 'localhost',
        debug: false,
        logLevel: 'info'
      },

      // Scan settings
      scan: {
        defaultProfile: 'standard',
        maxConcurrentScans: 3,
        defaultTimeout: 300000, // 5 minutes
        enableCaching: true,
        cacheTTL: 86400000, // 24 hours
        enableRealTimePreview: true,
        enablePauseResume: true,
        enableFiltering: true
      },

      // Performance settings
      performance: {
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxFilesPerScan: 1000000,
        enableParallelProcessing: true,
        workerThreads: 4,
        chunkSize: 1000
      },

      // UI settings
      ui: {
        theme: 'light',
        language: 'en',
        autoRefresh: true,
        refreshInterval: 5000,
        showHiddenFiles: false,
        showSystemFiles: false,
        maxResultsPerPage: 100
      },

      // Security settings
      security: {
        enableRateLimit: true,
        maxRequestsPerMinute: 100,
        enableCORS: true,
        allowedOrigins: ['http://localhost:3000', 'http://localhost:8080'],
        enableAuthentication: false,
        sessionTimeout: 3600000 // 1 hour
      },

      // Analytics settings
      analytics: {
        enabled: true,
        trackScans: true,
        trackPerformance: true,
        trackErrors: true,
        retentionDays: 30,
        anonymizeData: true
      },

      // Ollama/AI settings
      ai: {
        enabled: true,
        defaultModel: 'gemma3:latest',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 30000,
        enableCache: true,
        cacheSize: 100
      },

      // File preview settings
      preview: {
        enabled: true,
        maxPreviewSize: 10 * 1024 * 1024, // 10MB
        cacheEnabled: true,
        cacheSize: 100,
        includeTextPreview: true,
        previewLines: 5,
        includeHash: false
      },

      // Export settings
      export: {
        defaultFormat: 'json',
        includeMetadata: true,
        compression: false,
        maxExportSize: 100 * 1024 * 1024 // 100MB
      }
    };
  }

  async loadConfig() {
    try {
      // Load default config
      this.config.set('default', { ...this.defaultConfig });

      // Load user config if exists
      const userConfigExists = await fs.access(this.userConfigFile).then(() => true).catch(() => false);
      if (userConfigExists) {
        const userConfigData = await fs.readFile(this.userConfigFile, 'utf8');
        const userConfig = JSON.parse(userConfigData);
        this.config.set('user', userConfig);
        console.log('📝 Loaded user configuration');
      }

      // Load app config if exists
      const appConfigExists = await fs.access(this.configFile).then(() => true).catch(() => false);
      if (appConfigExists) {
        const appConfigData = await fs.readFile(this.configFile, 'utf8');
        const appConfig = JSON.parse(appConfigData);
        this.config.set('app', appConfig);
        console.log('📝 Loaded application configuration');
      }

    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Use default config if loading fails
      this.config.set('default', { ...this.defaultConfig });
    }
  }

  async saveConfig(configType = 'user') {
    try {
      const configData = this.config.get(configType);
      if (!configData) {
        throw new Error(`Configuration type '${configType}' not found`);
      }

      const configFile = configType === 'user' ? this.userConfigFile : this.configFile;
      await fs.writeFile(configFile, JSON.stringify(configData, null, 2));
      
      console.log(`💾 Saved ${configType} configuration`);
      return true;
    } catch (error) {
      console.error(`Failed to save ${configType} configuration:`, error);
      return false;
    }
  }

  get(key, defaultValue = null) {
    // Check user config first, then app config, then default
    const userConfig = this.config.get('user');
    const appConfig = this.config.get('app');
    const defaultConfig = this.config.get('default');

    if (userConfig && this.getNestedValue(userConfig, key) !== undefined) {
      return this.getNestedValue(userConfig, key);
    }
    if (appConfig && this.getNestedValue(appConfig, key) !== undefined) {
      return this.getNestedValue(appConfig, key);
    }
    if (defaultConfig && this.getNestedValue(defaultConfig, key) !== undefined) {
      return this.getNestedValue(defaultConfig, key);
    }

    return defaultValue;
  }

  set(key, value, configType = 'user') {
    let config = this.config.get(configType);
    if (!config) {
      config = {};
      this.config.set(configType, config);
    }

    this.setNestedValue(config, key, value);
    return this.saveConfig(configType);
  }

  getNestedValue(obj, key) {
    return key.split('.').reduce((current, keyPart) => {
      return current && current[keyPart] !== undefined ? current[keyPart] : undefined;
    }, obj);
  }

  setNestedValue(obj, key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, keyPart) => {
      if (!current[keyPart]) {
        current[keyPart] = {};
      }
      return current[keyPart];
    }, obj);
    
    target[lastKey] = value;
  }

  async reset(key = null, configType = 'user') {
    if (key) {
      // Reset specific key
      const defaultValue = this.getNestedValue(this.defaultConfig, key);
      return this.set(key, defaultValue, configType);
    } else {
      // Reset entire configuration
      if (configType === 'user') {
        this.config.set('user', {});
        return this.saveConfig('user');
      } else if (configType === 'app') {
        this.config.set('app', {});
        return this.saveConfig('app');
      }
    }
    return false;
  }

  async exportConfig(format = 'json') {
    const mergedConfig = this.getMergedConfig();
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(mergedConfig, null, 2);
      case 'yaml':
        // Simple YAML conversion (would need a proper YAML library in production)
        return this.convertToYAML(mergedConfig);
      case 'env':
        return this.convertToEnv(mergedConfig);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async importConfig(configData, format = 'json') {
    try {
      let parsedConfig;
      
      switch (format.toLowerCase()) {
        case 'json':
          parsedConfig = typeof configData === 'string' ? JSON.parse(configData) : configData;
          break;
        case 'yaml':
          // Would need a proper YAML parser in production
          throw new Error('YAML import not implemented');
        case 'env':
          parsedConfig = this.parseEnvFormat(configData);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate imported config
      this.validateConfig(parsedConfig);
      
      // Save as user config
      this.config.set('user', parsedConfig);
      await this.saveConfig('user');
      
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  }

  getMergedConfig() {
    const defaultConfig = this.config.get('default') || {};
    const appConfig = this.config.get('app') || {};
    const userConfig = this.config.get('user') || {};

    // Deep merge configurations (user overrides app overrides default)
    return this.deepMerge(defaultConfig, this.deepMerge(appConfig, userConfig));
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  validateConfig(config) {
    const errors = [];

    // Validate app settings
    if (config.app) {
      if (config.app.port && (config.app.port < 1 || config.app.port > 65535)) {
        errors.push('App port must be between 1 and 65535');
      }
      if (config.app.logLevel && !['error', 'warn', 'info', 'debug'].includes(config.app.logLevel)) {
        errors.push('Log level must be one of: error, warn, info, debug');
      }
    }

    // Validate scan settings
    if (config.scan) {
      if (config.scan.maxConcurrentScans && config.scan.maxConcurrentScans < 1) {
        errors.push('Max concurrent scans must be at least 1');
      }
      if (config.scan.defaultTimeout && config.scan.defaultTimeout < 1000) {
        errors.push('Default timeout must be at least 1000ms');
      }
    }

    // Validate performance settings
    if (config.performance) {
      if (config.performance.maxMemoryUsage && config.performance.maxMemoryUsage < 1024 * 1024) {
        errors.push('Max memory usage must be at least 1MB');
      }
      if (config.performance.workerThreads && config.performance.workerThreads < 1) {
        errors.push('Worker threads must be at least 1');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  convertToYAML(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.convertToYAML(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${item}\n`;
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
    
    return yaml;
  }

  convertToEnv(obj) {
    let env = '';
    
    const flatten = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}_${key.toUpperCase()}` : key.toUpperCase();
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value, fullKey);
        } else {
          env += `${fullKey}=${value}\n`;
        }
      }
    };
    
    flatten(obj);
    return env;
  }

  parseEnvFormat(envString) {
    const config = {};
    const lines = envString.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          this.setNestedValue(config, key.toLowerCase().replace(/_/g, '.'), value);
        }
      }
    }
    
    return config;
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        app: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            port: { type: 'number', minimum: 1, maximum: 65535 },
            host: { type: 'string' },
            debug: { type: 'boolean' },
            logLevel: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] }
          }
        },
        scan: {
          type: 'object',
          properties: {
            defaultProfile: { type: 'string', enum: ['quick', 'standard', 'deep'] },
            maxConcurrentScans: { type: 'number', minimum: 1 },
            defaultTimeout: { type: 'number', minimum: 1000 },
            enableCaching: { type: 'boolean' },
            cacheTTL: { type: 'number', minimum: 0 }
          }
        },
        performance: {
          type: 'object',
          properties: {
            maxMemoryUsage: { type: 'number', minimum: 1048576 },
            maxFileSize: { type: 'number', minimum: 1 },
            maxFilesPerScan: { type: 'number', minimum: 1 },
            enableParallelProcessing: { type: 'boolean' },
            workerThreads: { type: 'number', minimum: 1 }
          }
        },
        ui: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark'] },
            language: { type: 'string' },
            autoRefresh: { type: 'boolean' },
            refreshInterval: { type: 'number', minimum: 1000 }
          }
        }
      }
    };
  }

  async backup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.configPath, `config-backup-${timestamp}.json`);
      
      const mergedConfig = this.getMergedConfig();
      await fs.writeFile(backupFile, JSON.stringify(mergedConfig, null, 2));
      
      console.log(`💾 Configuration backed up to ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('Failed to backup configuration:', error);
      throw error;
    }
  }

  async restore(backupFile) {
    try {
      const backupData = await fs.readFile(backupFile, 'utf8');
      const config = JSON.parse(backupData);
      
      this.validateConfig(config);
      this.config.set('user', config);
      await this.saveConfig('user');
      
      console.log(`📂 Configuration restored from ${backupFile}`);
      return true;
    } catch (error) {
      console.error('Failed to restore configuration:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.configPath);
      const backupFiles = files.filter(file => file.startsWith('config-backup-') && file.endsWith('.json'));
      
      // Keep only the last 10 backups
      if (backupFiles.length > 10) {
        backupFiles.sort();
        const toDelete = backupFiles.slice(0, -10);
        
        for (const file of toDelete) {
          await fs.unlink(path.join(this.configPath, file));
          console.log(`🗑️ Cleaned up old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }
}

module.exports = ConfigManager;
