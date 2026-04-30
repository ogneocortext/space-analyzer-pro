try {
  const KnowledgeDatabase = require('./KnowledgeDatabase');
  console.log('KnowledgeDatabase loaded, type:', typeof KnowledgeDatabase);
  const db = new KnowledgeDatabase();
  console.log('KnowledgeDatabase instantiated successfully');
} catch(e) { 
  console.error('KnowledgeDatabase FAIL:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
}
