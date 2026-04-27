# 🔍 Troubleshooting Documentation

## 📋 Overview

This document provides comprehensive troubleshooting guidelines for common issues that may arise when developing, deploying, or using the refactored Space Analyzer with its **modular architecture**, **ML-powered capabilities**, and **self-learning features**.

---

## 🎯 Common Issues

### **🚀 Application Startup Issues**
- **Frontend not loading**: Check dependencies and build process
- **Backend not starting**: Verify configuration and database connection
- **ML services not responding**: Check Python environment and model files
- **Database connection failed**: Verify database credentials and network connectivity

### **🐛 Performance Issues**
- **Slow response times**: Check caching, database queries, and resource usage
- **High memory usage**: Optimize code and implement proper memory management
- **CPU usage spikes**: Optimize algorithms and implement proper load balancing
- **Database timeouts**: Optimize queries and implement connection pooling

### **🧠 ML Model Issues**
- **Model not loading**: Check model file paths and permissions
- **Poor prediction accuracy**: Check training data quality and model architecture
- **Slow inference**: Optimize model architecture and implement batch processing
- **Model training failures**: Check training data and hyperparameters

---

## 🚀 Application Startup Issues

### **Frontend Not Loading**

#### **Symptoms:**
- White screen or error page
- Console errors about missing modules
- Build process fails
- Application won't start

#### **Common Causes:**
```bash
# Check if dependencies are installed
npm list

# Check for missing dependencies
npm install

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check build process
npm run build
```

#### **Solutions:**
```bash
# 1. Check Node.js version
node --version

# 2. Clear npm cache
npm cache clean --force

# 3. Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# 4. Reinstall dependencies
npm install

# 5. Check environment variables
cat .env.example
```

### **Backend Not Starting**

#### **Symptoms:**
- Server fails to start
- Database connection errors
- Port conflicts
- Configuration errors

#### **Common Causes:**
```bash
# Check if port is in use
netstat -an | grep :3001

# Check database connection
psql -h localhost -U space_analyzer

# Check environment variables
cat .env
```

#### **Solutions:**
```bash
# 1. Kill processes using the port
sudo kill -9 $(lsof -ti :3001)

# 2. Check database status
docker ps -a | grep postgres

# 3. Check environment variables
echo $DATABASE_URL

# 4. Restart services
docker-compose down
docker-compose up -d
```

### **ML Services Not Responding**

#### **Symptoms:**
- ML services return 500 errors
- Model loading failures
- Python import errors
- Inference timeouts

#### **Common Causes:**
```bash
# Check Python environment
python --version

# Check virtual environment
source venv/bin/activate

# Check dependencies
pip list

# Check model files
ls -la models/
```

#### **Solutions:**
```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Check model files
ls -la models/

# 4. Test model loading
python -c "import joblib; print(joblib.load('models/complexity_model.pkl'))"

# 5. Restart services
docker-compose restart ml-services
```

---

## 🐛 Performance Issues

### **Slow Response Times**

#### **Frontend Performance**

#### **Symptoms:**
- Slow initial load (> 3s)
- Slow interactions (> 200ms)
- High memory usage
- CPU spikes

#### **Common Causes:**
- Large bundle size
- Unoptimized images
- Excessive re-renders
- Memory leaks

#### **Solutions:**
```typescript
// 1. Check bundle size
npm run build --analyze

// 2. Optimize images
const optimizedImage = {
  src: image,
  webp: {
    quality: 80,
    sizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
  }
};

// 3. Implement code splitting
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// 4. Use React.memo
const MemoizedComponent = React.memo(Component);

// 5. Optimize state management
const [data, setData] = useState(null);
```

#### **Backend Performance**

#### **Solutions:**
```typescript
// 1. Add database indexes
CREATE INDEX idx_analysis_created_at ON analysis(created_at);

// 2. Optimize queries
const query = this.analysisRepository
  .createQueryBuilder('analysis')
  .select(['id', 'type', 'complexity'])
  .where('type', :type)
  .orderBy('createdAt', 'DESC')
  .limit(100);

// 3. Implement caching
@Cache({ ttl: 60 * 60 })
async function getCachedAnalysis(key: string) {
  return this.analysisService.getAnalysis(key);
}

// 4. Use connection pooling
const config = {
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  }
};
```

#### **ML Services Performance**

#### **Solutions:**
```python
# 1. Use model caching
@lru_cache(maxsize=10)
def get_model(model_name: str):
    if model_name not in self.models:
        self.models[model_name] = joblib.load(f'models/{model_name}.pkl')
    return self.models[model_name]

# 2. Implement batch processing
def process_batch(data, batch_size=32):
    results = []
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        batch_result = model.predict(batch)
        results.extend(batch_result)
    return results

# 3. Use TensorFlow Lite
import tensorflow as tf
interpreter = tf.lite.Interpreter()
model = tf.lite.Interpreter.load('model.tflite', interpreter)
```

---

## 🧠 ML Model Issues

### **Model Not Loading**

#### **Symptoms:**
- Model file not found
- Permission denied errors
- Model format errors
- Loading timeouts

#### **Common Causes:**
```bash
# Check model file exists
ls -la models/

# Check file permissions
ls -la models/complexity_model.pkl

# Check model format
file models/complexity_model.pkl
```

#### **Solutions:**
```bash
# 1. Check model file path
ls -la models/

# 2. Verify file permissions
chmod 644 models/complexity_model.pkl

# 3. Check model format
python -c "import pickle; model = pickle.load(open('models/complexity_model.pkl', 'rb')); print(type(model))"

# 4. Test model loading
python -c "import joblib; model = joblib.load('models/complexity_model.pkl')); print(model.predict([[1, 2, 3]]))"
```

### **Poor Prediction Accuracy**

#### **Symptoms:**
- Low accuracy (< 70%)
- Inconsistent predictions
- High error rates
- Poor generalization

#### **Common Causes:**
- Insufficient training data
- Overfitting
- Poor model architecture
- Data quality issues

#### **Solutions:**
```python
# 1. Check training data quality
print(f"Training data shape: {X_train.shape}")
print(f"Labels shape: {y_train.shape}")

# 2. Check for overfitting
history = model.fit(X_train, y_train, validation_data=(X_val, y_val))

# 3. Improve model architecture
model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation='relu', input_shape=input_shape),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(output_shape, activation='sigmoid')
]);

# 4. Add regularization
model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy'],
    callbacks=[
        tf.keras.callbacks.EarlyStopping(patience=10),
        tf.keras.callbacks.ReduceLROnPlateau(patience=5)
    ]
);
```

### **Slow Inference**

#### **Solutions:**
```python
# 1. Use TensorFlow Lite
interpreter = tf.lite.Interpreter()
model = tf.lite.Interpreter.load('model.tflite', interpreter)

# 2. Optimize batch processing
def predict_batch(data, batch_size=32):
    results = []
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        batch_result = model.predict(batch)
        results.extend(batch_result)
    return results

# 3. Use GPU acceleration
with tf.device('/GPU:0'):
    model = model
    predictions = model.predict(data)
```

---

## 🔒 Database Issues

### **Connection Issues**

#### **Symptoms:**
- Connection refused
- Connection timeout
- Authentication failed
- Database not responding

#### **Solutions:**
```bash
# 1. Check database status
docker ps -a | grep postgres

# 2. Check network connectivity
ping localhost
telnet localhost 5432

# 3. Check database logs
docker logs space-analyzer-postgres

# 4. Restart database
docker-compose restart postgres
```

### **Performance Issues**

#### **Solutions:**
```sql
-- 1. Add indexes
CREATE INDEX CONCURRENTLY idx_analysis_type ON analysis(type);

-- 2. Optimize queries
EXPLAIN ANALYZE SELECT * FROM analysis WHERE type = 'complexity' ORDER BY created_at DESC;

-- 3. Use connection pooling
ALTER SYSTEM SET shared_buffers = 256MB;
ALTER SYSTEM SET effective_cache_size = 1GB;
ALTER SYSTEM SET work_mem = 4MB;
```

---

## 🌐 Network Issues

### **Port Conflicts**

#### **Symptoms:**
- Port already in use
- Connection refused
- Service not accessible

#### **Solutions:**
```bash
# 1. Find process using the port
sudo lsof -i :3001

# 2. Kill the process
sudo kill -9 $(lsof -ti :3001)

# 3. Use different port
export PORT=3002
npm start
```

### **CORS Issues**

#### **Solutions:**
```typescript
// Backend CORS configuration
app.enableCors();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

---

## 🔧 Configuration Issues

### **Environment Variables**

#### **Symptoms:**
- Missing environment variables
- Incorrect configuration values
- Environment not loading

#### **Solutions:**
```bash
# 1. Check environment files
ls -la .env*

# 2. Copy example file
cp .env.example .env

# 3. Edit environment variables
vim .env

# 4. Restart services
docker-compose restart
```

### **Docker Issues**

#### **Solutions:**
```bash
# 1. Check Docker version
docker --version

# 2. Check Docker daemon
docker info

# 3. Rebuild images
docker-compose build

# 4. Restart containers
docker-compose up -d
```

---

## 📊 Monitoring Issues

### **Metrics Not Showing**

#### **Solutions:**
```bash
# 1. Check Prometheus status
docker ps -a | grep prometheus

# 2. Check Prometheus logs
docker logs space-analyzer-prometheus

# 3. Check configuration
cat prometheus.yml

# 4. Restart Prometheus
docker-compose restart prometheus
```

### **Alerts Not Working**

#### **Solutions:**
```yaml
# 1. Check alert rules
cat prometheus.yml | grep -A 10 -B 10 "alert:"

# 2. Test alert rules
curl -X POST http://localhost:9090/api/v1/alerts/test

# 3. Check Alertmanager status
docker ps -a | grep alertmanager

# 4. Restart Alertmanager
docker-compose restart alertmanager
```

---

## 🧪 Testing Issues

### **Test Failures**

#### **Frontend Tests**
```bash
# 1. Check test configuration
cat jest.config.js

# 2. Run tests with verbose output
npm test --verbose

# 3. Run specific test file
npm test -- --testPath=src/components/ThreeDVisualization

# 4. Update test snapshots
npm test --updateSnapshot
```

#### **Backend Tests**
```bash
# 1. Check test configuration
cat jest.config.js

# 2. Run tests with coverage
npm run test --coverage

# 3. Run integration tests
npm run test:integration

# 4. Run e2e tests
npm run test:e2e
```

#### **ML Tests**
```bash
# 1. Check test configuration
pytest --version

# 2. Run tests with verbose output
pytest -v tests/

# 3. Run specific test file
pytest tests/test_model.py -v

# 4. Run tests with coverage
pytest --cov=ml_services tests/
```

---

## 🔧 Development Environment Issues

### **IDE Configuration**

#### **VS Code Issues**
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

#### **Extension Issues**
```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-vscode.prettier-vscode",
    "ms-vscode.vscode-react-hooks"
  ]
}
```

### **Build Tool Issues**

#### **Webpack Issues**
```bash
# 1. Check webpack version
npm list webpack

# 2. Clear webpack cache
npm run build -- --reset-cache

# 3. Update dependencies
npm update

# 4. Rebuild
npm run build
```

---

## 📱 Logging Issues

### **Log Levels**

#### **Frontend Logging**
```typescript
// Configure logging levels
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});
```

#### **Backend Logging**
```typescript
// Configure NestJS logging
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});
```

#### **ML Services Logging**
```python
# Configure Python logging
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/ml_services.log'),
        logging.StreamHandler()
    ]
)
```

---

## 🔍 Security Issues

### **Authentication Issues**

#### **Solutions:**
```typescript
// Check JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
      expiresIn: '1h',
      signOptions: {
        algorithm: 'HS256'
      }
};
```

### **Authorization Issues**

#### **Solutions:**
```typescript
// Check RBAC configuration
const rbacConfig = {
  users: [
    {
      id: 1,
      email: 'user@example.com',
      roles: ['user']
    },
    {
      id: 2,
      email: 'admin@example.com',
      roles: ['admin', 'user']
    }
  ]
};
```

---

## 🎯 Debugging Tools

### **Frontend Debugging**
- **React DevTools**: Browser developer tools
- **React DevTools**: React developer tools
- **Redux DevTools**: Redux developer tools
- **Chrome DevTools**: Chrome developer tools

### **Backend Debugging**
- **Node.js Inspector**: Node.js debugging
- **NestJS Debugger**: NestJS debugging
- **VS Code Debugger**: VS Code debugging
- **Chrome DevTools**: Chrome developer tools

### **ML Services Debugging**
- **Python Debugger**: Python debugging
- **TensorFlow Debugger**: TensorFlow debugging
- **VS Code Python**: VS Code Python debugging
- **Jupyter Notebook**: Jupyter notebook debugging

---

## 📞 Getting Help

### **Community Support**
- **GitHub Issues**: Report bugs and request features
- **Discord**: Join community discussions
- **Stack Overflow**: Ask technical questions
- **Documentation**: Check documentation first

### **Support Channels**
- **Email**: support@space-analyzer.com
- **Discord**: https://discord.gg/space-analyzer
- **GitHub**: https://github.com/your-org/space-analyzer

### **Troubleshooting Process**
1. **Check documentation** first
2. **Search existing issues**
3. **Create minimal reproduction**
4. **Provide detailed information**
5. **Include logs and errors**

---

## 🎯 Common Error Messages

### **Frontend Errors**
```
Error: Cannot find module 'module-name'
Solution: Check if module is installed and import path is correct

Error: Module not found: 'module-name'
Solution: Run npm install to install missing module

Error: Cannot read property 'property' of undefined
Solution: Check if object exists before accessing property
```

### **Backend Errors**
```
Error: Cannot connect to database
Solution: Check database connection string and credentials

Error: Query failed
Solution: Check SQL syntax and table structure

Error: Service unavailable
Solution: Check service status and logs
```

### **ML Services Errors**
```
Error: Model file not found
Solution: Check model file path and permissions

Error: Model loading failed
Solution: Check model format and compatibility

Error: Inference failed
Solution: Check input data format and model architecture
```

---

## 🎯 Best Practices

### **Prevention**
- **Regular Testing**: Run tests regularly
- **Code Reviews**: Review code before merging
- **Performance Monitoring**: Monitor performance metrics
- **Security Audits**: Regular security assessments

### **Troubleshooting Checklist**
- [ ] Check logs for error messages
- [ ] Verify configuration
- [ ] Test with minimal reproduction
- [ ] Check dependencies
- [ ] Verify environment variables
- [ ] Check network connectivity
- [ ] Check resource usage

### **Performance Checklist**
- [ ] Monitor response times
- [ ] Check memory usage
- [ ] Optimize database queries
- [ ] Implement caching
- [ ] Optimize bundle size
- [ ] Monitor CPU usage

---

## 🎯 Conclusion

Troubleshooting is an essential part of software development. By following the guidelines and best practices outlined in this document, you can effectively diagnose and resolve issues that may arise during development, deployment, or use of the Space Analyzer.

Remember to:
- **Document issues** for future reference
- **Share solutions** with the community
- **Learn from mistakes** to prevent recurrence
- **Ask for help** when needed

The Space Analyzer community is here to help you succeed!

---

## 📞 Contact Information

### **Support Channels:**
- **GitHub Issues**: https://github.com/your-org/space-analyzer/issues
- **Discord**: https://discord.gg/space-analyzer
- **Email**: support@space-analyzer.com
- **Documentation**: https://docs.space-analyzer.com

### **Community Resources:**
- **Wiki**: https://github.com/your-org/space-analyzer/wiki
- **Discussions**: https://github.com/your-org/space-analyzer/discussions
- **Releases**: https://github.com/your-org/space-analyzer/releases

---

## 🎉 Thank You!

Thank you for using the Space Analyzer troubleshooting documentation! We hope these guidelines help you resolve issues quickly and effectively.

If you have any questions or suggestions for improving this documentation, please don't hesitate to reach out to our community.

**Happy troubleshooting!** 🔍

---

## 📚 Resources

### **Troubleshooting Tools:**
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools/)
- [React DevTools](https://reactjs.org/blog/2022/03/react-profiler/)
- [NestJS Profiler](https://docs.nestjs.com/techniques/performance/)
- [TensorFlow Debugger](https://www.tensorflow.org/guide/debugger/)
- [Python Debugger](https://docs.python.org/3/library/debugger.html)

### **Documentation:**
- [Architecture Documentation](./ARCHITECTURE.md)
- [Component Documentation](./COMPONENTS.md)
- [ML Integration Documentation](./ML_INTEGRATION.md)
- [Deployment Documentation](./DEPLOYMENT.md)
- [Development Documentation](./DEVELOPMENT.md)
- [Performance Documentation](./PERFORMANCE.md)

---

## 🎉 Quick Reference

### **Common Commands:**
```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm test            # Run tests
npm run test:coverage  # Run tests with coverage

# Backend
npm run dev          # Start development server
npm run build        # Build for production
npm test            # Run tests
npm run test:e2e       # Run e2e tests

# ML Services
source venv/bin/activate
python app.py        # Start ML services
pytest tests/          # Run tests
```

### **Docker Commands:**
```bash
# Build and run all services
docker-compose up -d

# Build specific service
docker-compose build frontend
docker-compose build backend
docker-compose build ml-services

# View logs
docker-compose logs frontend
docker-compose logs backend
docker-compose logs ml-services

# Restart services
docker-compose restart
docker-compose restart frontend
docker-compose restart backend
docker-compose restart ml-services

# Stop services
docker-compose down
```

---

## 🎉 Emergency Contacts

### **Critical Issues**
- **Production Outage**: Contact support@space-analyzer.com
- **Security Incident**: Contact security@space-analyzer.com
- **Data Loss**: Contact support@space-analyzer.com

### **Non-Critical Issues**
- **Bug Reports**: Create GitHub issue
- **Feature Requests**: Create GitHub issue
- **Documentation**: Create GitHub issue

---

## 🎉 Final Notes

This troubleshooting documentation is a living document that will be updated as new issues are discovered and solutions are found. Please check back regularly for the latest information.

The Space Analyzer team is committed to providing the best possible support and documentation to help you succeed with our powerful code analysis and refactoring tool.

**Happy troubleshooting!** 🔍