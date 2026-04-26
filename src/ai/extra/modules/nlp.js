class NLPModule {
  constructor() {
    this.engines = {
      simple: {
        initialized: false,
        confidence: 0.7
      },
      advanced: {
        initialized: false,
        confidence: 0.9
      }
    };
    this.currentEngine = null;
    this.intentModels = {};
    this.entityRecognizers = {};
  }

  async initialize() {
    console.log("Initializing NLP module...");
    await this.loadIntentModels();
    await this.loadEntityRecognizers();
    console.log("NLP module initialized successfully");
  }

  async loadIntentModels() {
    console.log("Loading intent models...");
    this.intentModels = {
      storage_query: {
        patterns: ["storage", "space", "disk", "capacity", "used", "free"],
        confidence: 0.9,
        examples: ["how much storage", "disk usage", "free space"]
      },
      file_search: {
        patterns: ["find", "search", "locate", "where", "file"],
        confidence: 0.85,
        examples: ["find files", "search for", "where are"]
      },
      file_analysis: {
        patterns: ["analyze", "analyze file", "check file", "file type"],
        confidence: 0.8,
        examples: ["analyze this file", "what type of file"]
      },
      code_analysis: {
        patterns: ["code", "programming", "source", "javascript", "python"],
        confidence: 0.75,
        examples: ["code analysis", "source code"]
      },
      recommendation: {
        patterns: ["recommend", "suggest", "should", "advice"],
        confidence: 0.7,
        examples: ["recommend files", "suggest cleanup"]
      },
      visualization: {
        patterns: ["visualize", "chart", "graph", "display", "show"],
        confidence: 0.8,
        examples: ["visualize storage", "show chart"]
      }
    };
    console.log("Intent models loaded");
  }

  async loadEntityRecognizers() {
    console.log("Loading entity recognizers...");
    this.entityRecognizers = {
      file_type: { 
        patterns: ["\\.(pdf|docx?|xlsx?|pptx?|jpg|png|mp4|avi)$"], 
        examples: ["PDF files", "Word documents", "Excel spreadsheets"] 
      },
      code_type: { 
        patterns: ["\\.(js|ts|py|rs|cpp|c|h|hpp|java|go|rb|php|swift|kt|m|html|css|scss|sass|less)$"],
        examples: ["javascript files", "python scripts", "source code"]
      },
      build_system: { 
        patterns: ["package\\.json", "requirements\\.txt", "Cargo\\.toml", "go\\.mod"], 
        examples: ["node_modules", "dependencies", "imports"] 
      },
      file_size: { patterns: ["(small|medium|large|huge) files", "(big|small) files"], examples: ["large files", "files over 1MB"] },
      time_frame: { patterns: ["(last|past|recent) (\\d+ days|week|month|year)", "since (\\d{4}-\\d{2}-\\d{2})"], examples: ["last 7 days", "past month"] },
      storage_metric: { patterns: ["(used|free|total) (space|storage|capacity)"], examples: ["used space", "free storage"] }
    };
    console.log("Entity recognizers loaded");
  }

  async processQuery(query) {
    console.log(`Processing NLP query: "${query}"`);
    
    const result = {
      originalQuery: query,
      intent: null,
      entities: [],
      confidence: 0,
      processedQuery: query
    };

    // Detect intent
    result.intent = this.detectIntent(query);
    
    // Extract entities
    result.entities = this.extractEntities(query);
    
    // Calculate overall confidence
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  detectIntent(query) {
    const queryLower = query.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [intentName, model] of Object.entries(this.intentModels)) {
      let score = 0;
      
      // Check pattern matches
      for (const pattern of model.patterns) {
        if (queryLower.includes(pattern.toLowerCase())) {
          score += 1 / model.patterns.length;
        }
      }

      // Check example similarity (simplified)
      for (const example of model.examples) {
        if (queryLower.includes(example.toLowerCase())) {
          score += 0.5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          name: intentName,
          confidence: Math.min(score * model.confidence, 1.0),
          examples: model.examples
        };
      }
    }

    return bestMatch;
  }

  extractEntities(query) {
    const entities = [];
    const queryLower = query.toLowerCase();

    for (const [entityType, recognizer] of Object.entries(this.entityRecognizers)) {
      for (const pattern of recognizer.patterns) {
        const regex = new RegExp(pattern, 'gi');
        let match;
        
        while ((match = regex.exec(query)) !== null) {
          entities.push({
            type: entityType,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.8
          });
        }
      }
    }

    return entities;
  }

  calculateConfidence(result) {
    let confidence = 0;

    // Intent confidence
    if (result.intent) {
      confidence += result.intent.confidence * 0.6;
    }

    // Entity confidence
    if (result.entities.length > 0) {
      const avgEntityConfidence = result.entities.reduce((sum, entity) => 
        sum + entity.confidence, 0) / result.entities.length;
      confidence += avgEntityConfidence * 0.4;
    }

    return Math.min(confidence, 1.0);
  }

  async generateInsights(fileData) {
    const insights = [];

    if (fileData.files && fileData.files.length > 0) {
      insights.push({
        type: 'summary',
        message: `Found ${fileData.files.length} files with total size of ${this.formatFileSize(fileData.totalSize || 0)}`,
        confidence: 0.9
      });

      // File type insights
      const fileTypes = this.analyzeFileTypes(fileData.files);
      if (fileTypes.length > 0) {
        const dominantType = fileTypes[0];
        insights.push({
          type: 'file_type',
          message: `Most common file type is ${dominantType.type} (${dominantType.count} files, ${dominantType.percentage}%)`,
          confidence: 0.8
        });
      }

      // Size insights
      const largeFiles = fileData.files.filter(file => file.size > 10485760); // > 10MB
      if (largeFiles.length > 0) {
        insights.push({
          type: 'size',
          message: `Found ${largeFiles.length} large files (>10MB) that may impact storage performance`,
          confidence: 0.7
        });
      }
    }

    return insights;
  }

  async generateRecommendations(fileData) {
    const recommendations = [];

    if (fileData.files && fileData.files.length > 0) {
      // Cleanup recommendations
      const oldFiles = fileData.files.filter(file => {
        const fileDate = new Date(file.modifiedAt || file.createdAt);
        const daysOld = (new Date() - fileDate) / (1000 * 60 * 60 * 24);
        return daysOld > 365; // Older than 1 year
      });

      if (oldFiles.length > 0) {
        recommendations.push({
          type: 'cleanup',
          message: `Consider archiving ${oldFiles.length} files older than 1 year`,
          priority: 'medium',
          action: 'archive_old_files'
        });
      }

      // Duplicate recommendations (simplified)
      const fileNames = fileData.files.map(file => file.name.toLowerCase());
      const duplicates = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
      
      if (duplicates.length > 0) {
        recommendations.push({
          type: 'deduplication',
          message: `Found ${duplicates.length} potential duplicate files`,
          priority: 'high',
          action: 'remove_duplicates'
        });
      }
    }

    return recommendations;
  }

  analyzeFileTypes(files) {
    const typeCounts = {};
    
    files.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      typeCounts[ext] = (typeCounts[ext] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: ((count / files.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  async shutdown() {
    console.log("Shutting down NLP module...");
    for (const engineName in this.engines) {
      this.engines[engineName].initialized = false;
    }
    this.currentEngine = null;
    this.intentModels = {};
    this.entityRecognizers = {};
  }
}

export { NLPModule };