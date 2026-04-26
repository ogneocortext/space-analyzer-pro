const { parentPort, workerData } = require('worker_threads');
const { enhancedCodeAnalysisService } = require('./EnhancedCodeAnalysisService');

// Worker for parallel code analysis
class AnalysisWorker {
  constructor() {
    this.setupMessageHandlers();
  }
  
  setupMessageHandlers() {
    parentPort.on('message', async (message) => {
      try {
        const result = await this.handleMessage(message);
        parentPort.postMessage({ success: true, result });
      } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
      }
    });
  }
  
  async handleMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'analyze_file':
        return await this.analyzeFile(data);
      case 'analyze_batch':
        return await this.analyzeBatch(data);
      case 'parse_ast':
        return await this.parseAST(data);
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }
  
  async analyzeFile(fileData) {
    const { filePath, content, options } = fileData;
    
    // Use the enhanced analysis service
    const analysis = await enhancedCodeAnalysisService.analyzeFile(filePath, content);
    
    return {
      filePath,
      analysis,
      performance: {
        processingTime: Date.now() - (options.startTime || Date.now()),
        memoryUsage: process.memoryUsage()
      }
    };
  }
  
  async analyzeBatch(batchData) {
    const { files, options } = batchData;
    const results = [];
    
    for (const file of files) {
      try {
        const result = await this.analyzeFile({
          filePath: file.path,
          content: file.content,
          options
        });
        results.push(result);
      } catch (error) {
        results.push({
          filePath: file.path,
          error: error.message,
          performance: {
            processingTime: 0,
            memoryUsage: process.memoryUsage()
          }
        });
      }
    }
    
    return {
      results,
      batchPerformance: {
        totalTime: Date.now() - (options.startTime || Date.now()),
        filesProcessed: files.length,
        averageTimePerFile: (Date.now() - (options.startTime || Date.now())) / files.length,
        memoryUsage: process.memoryUsage()
      }
    };
  }
  
  async parseAST(parseData) {
    const { filePath, content, language } = parseData;
    
    // Use Tree-sitter for AST parsing
    const ast = await enhancedCodeAnalysisService.parser.parseFile(filePath, content);
    
    return {
      filePath,
      language,
      ast,
      performance: {
        parseTime: Date.now() - (parseData.startTime || Date.now()),
        nodeCount: ast.rootNode.descendantsOfType('*').length,
        memoryUsage: process.memoryUsage()
      }
    };
  }
}

// Initialize worker
new AnalysisWorker();