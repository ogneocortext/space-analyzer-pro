// Quick test to verify error routes can be loaded
console.log('🧪 Testing route loading...\n');

try {
  console.log('1. Testing error-logger.js...');
  const { getErrorLogger } = require('./utils/error-logger');
  console.log('   ✅ error-logger loaded');
  
  console.log('2. Testing errors.js...');
  const ErrorRoutes = require('./routes/errors');
  console.log('   ✅ errors.js loaded, type:', typeof ErrorRoutes);
  
  console.log('3. Testing index.js (RoutesManager)...');
  const RoutesManager = require('./routes/index');
  console.log('   ✅ RoutesManager loaded, type:', typeof RoutesManager);
  
  console.log('4. Creating mock server...');
  const mockServer = { 
    knowledgeDB: null,
    errorLogger: getErrorLogger()
  };
  
  console.log('5. Creating RoutesManager instance...');
  const rm = new RoutesManager(mockServer);
  console.log('   ✅ RoutesManager created');
  console.log('   - Has analysis routes:', !!rm.routes.analysis);
  console.log('   - Has error routes:', !!rm.routes.errors);
  
  console.log('6. Testing getRouter on error routes...');
  const errorRouter = rm.routes.errors.getRouter();
  console.log('   ✅ Got error router, type:', typeof errorRouter);
  console.log('   - Router stack length:', errorRouter.stack?.length || 0);
  
  console.log('\n✅ All tests passed! Error routes should work.');
} catch (err) {
  console.error('\n❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
