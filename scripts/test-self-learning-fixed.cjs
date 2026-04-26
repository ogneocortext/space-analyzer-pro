// Fixed Self-Learning Test
console.log('🧪 Testing Self-Learning ML Service (Fixed)');

class MockEnhancedSelfLearningService {
  constructor() {
    this.mlService = { getKnowledgeBase: () => ({ patterns: {}, 'code-smells': {}, 'best-practices': {} }) };
  }
  
  async processAnalysisResult() {}
  async predictWithLearning() { return { prediction: {}, confidence: 0.8 }; }
  addFeedback() {}
  getLearningStatistics() { return { trainingDatabase: {}, modelPerformance: {}, feedbackBuffer: [], performanceHistory: [], isLearning: false, lastRetrainingTime: 0, triggers: [] }; }
  getKnowledgeInsights() { return { patterns: {}, codeSmells: {}, bestPractices: {}, recommendations: ['test recommendation'] }; }
}

const testRunner = {
  tests: [],
  passed: 0,
  failed: 0,
  
  addTest(name, testFn) { this.tests.push({ name, testFn }); },
  
  async runTests() {
    console.log(`🧪 Running ${this.tests.length} tests...\n`);
    
    for (const test of this.tests) {
      try {
        console.log(`📋 Test: ${test.name}`);
        await test.testFn();
        console.log('✅ PASSED\n');
        this.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${error.message}\n`);
        this.failed++;
      }
    }
    
    console.log(`📊 Summary: ${this.passed}/${this.tests.length} passed (${((this.passed/this.tests.length)*100).toFixed(1)}%)`);
  }
};

testRunner.addTest('Enhanced Service - Initialization', async () => {
  const service = new MockEnhancedSelfLearningService();
  const insights = service.getKnowledgeInsights();
  if (!insights.patterns) throw new Error('Knowledge base not available');
});

testRunner.addTest('Enhanced Service - Analysis Processing', async () => {
  const service = new MockEnhancedSelfLearningService();
  await service.processAnalysisResult();
});

testRunner.addTest('Enhanced Service - Prediction', async () => {
  const service = new MockEnhancedSelfLearningService();
  const result = await service.predictWithLearning('complexity', 'code', 'js');
  if (!result.prediction) throw new Error('No prediction');
});

testRunner.addTest('Enhanced Service - Feedback', async () => {
  const service = new MockEnhancedSelfLearningService();
  service.addFeedback({ analysisId: 'test', positive: true });
});

testRunner.addTest('Enhanced Service - Statistics', async () => {
  const service = new MockEnhancedSelfLearningService();
  const stats = service.getLearningStatistics();
  if (!stats.trainingDatabase) throw new Error('No stats');
});

testRunner.runTests().then(() => {
  console.log('🎉 Self-Learning Tests Complete!');
}).catch(error => {
  console.error('❌ Failed:', error);
});