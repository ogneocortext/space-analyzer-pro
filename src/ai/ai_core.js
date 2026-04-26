/**
 * AI Core Module for Space Analyzer
 * Main AI engine that coordinates all AI-powered features
 */

class AICore {
  constructor() {
    this.modules = {};
    this.initialized = false;
    this.config = {
      visualization: {
        enabled: true,
        tools: ['thoughtspot', 'tableau', 'powerbi']
      },
      predictive: {
        enabled: true,
        models: ['datarobot', 'h2o']
      },
      nlp: {
        enabled: true,
        engines: ['julius', 'formula_bot']
      },
      automation: {
        enabled: true,
        tools: ['alteryx', 'knime']
      }
    };
  }

  /**
   * Initialize the AI core system
   */
  async initialize() {
    try {
      console.log('Initializing AI Core...');

      // Load all AI modules
      await this.loadModules();

      // Initialize each module
      for (const moduleName in this.modules) {
        if (this.modules[moduleName].initialize) {
          await this.modules[moduleName].initialize();
        }
      }

      this.initialized = true;
      console.log('AI Core initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize AI Core:', error);
      return false;
    }
  }

  /**
   * Load all AI modules
   */
  async loadModules() {
    // Load visualization module
    const { VisualizationModule } = await import('./modules/visualization.js');
    this.modules.visualization = new VisualizationModule(this.config.visualization);

    // Load predictive analytics module
    const { PredictiveModule } = await import('./modules/predictive.js');
    this.modules.predictive = new PredictiveModule(this.config.predictive);

    // Load NLP module
    const { NLPModule } = await import('./modules/nlp.js');
    this.modules.nlp = new NLPModule(this.config.nlp);

    // Load automation module
    const { AutomationModule } = await import('./modules/automation.js');
    this.modules.automation = new AutomationModule(this.config.automation);

    console.log('All AI modules loaded');
  }

  /**
   * Get a specific AI module
   * @param {string} moduleName - Name of the module to retrieve
   * @returns {object|null} The requested module or null if not found
   */
  getModule(moduleName) {
    return this.modules[moduleName] || null;
  }

  /**
   * Process file analysis with AI enhancements
   * @param {object} fileData - File data to analyze
   * @returns {object} AI-enhanced analysis results
   */
  async analyzeFiles(fileData) {
    if (!this.initialized) {
      throw new Error('AI Core not initialized');
    }

    const results = {
      visualization: null,
      predictions: null,
      insights: null,
      recommendations: null
    };

    // Run visualization analysis
    if (this.modules.visualization) {
      results.visualization = await this.modules.visualization.analyze(fileData);
    }

    // Run predictive analysis
    if (this.modules.predictive) {
      results.predictions = await this.modules.predictive.analyze(fileData);
    }

    // Generate insights and recommendations
    if (this.modules.nlp) {
      results.insights = await this.modules.nlp.generateInsights(fileData);
      results.recommendations = await this.modules.nlp.generateRecommendations(fileData);
    }

    return results;
  }

  /**
   * Execute automated workflows
   * @param {object} workflowConfig - Workflow configuration
   * @returns {object} Workflow execution results
   */
  async executeWorkflow(workflowConfig) {
    if (!this.initialized || !this.modules.automation) {
      throw new Error('AI Core or Automation module not initialized');
    }

    return this.modules.automation.execute(workflowConfig);
  }

  /**
   * Process natural language query
   * @param {string} query - Natural language query
   * @returns {object} Query processing results
   */
  async processQuery(query) {
    if (!this.initialized || !this.modules.nlp) {
      throw new Error('AI Core or NLP module not initialized');
    }

    return this.modules.nlp.processQuery(query);
  }

  /**
   * Analyze dependencies in files
   * @param {Array} files - Array of file objects to analyze
   * @returns {object} Dependency analysis results
   */
  async analyzeDependencies(files) {
    if (!this.initialized) {
      throw new Error('AI Core not initialized');
    }

    // Load dependency checker if not already loaded
    if (!this.modules.dependencyChecker) {
      const { DependencyChecker } = await import('./modules/dependency-checker.js');
      this.modules.dependencyChecker = new DependencyChecker();
    }

    return this.modules.dependencyChecker.analyzeDependencies(files);
  }

  /**
   * Shutdown the AI core system
   */
  async shutdown() {
    console.log('Shutting down AI Core...');

    // Shutdown each module
    for (const moduleName in this.modules) {
      if (this.modules[moduleName].shutdown) {
        await this.modules[moduleName].shutdown();
      }
    }

    this.initialized = false;
    console.log('AI Core shutdown complete');
  }
}

// Export singleton instance
const aiCore = new AICore();
export { aiCore };