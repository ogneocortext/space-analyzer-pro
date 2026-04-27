# Enhanced Ollama Service - Production Deployment Guide

## 📋 Overview

This guide provides comprehensive instructions for deploying the Enhanced Ollama Service with production-ready features including monitoring, caching, rate limiting, and circuit breaker patterns.

## 🚀 Key Features

### **Production-Ready Enhancements**

1. **Health Monitoring & Circuit Breaker**
   - Automatic health checks every 30 seconds
   - Circuit breaker opens after 5 consecutive failures
   - Auto-recovery with configurable timeout

2. **Request Management**
   - Request queuing with priority support
   - Rate limiting (100 requests/minute)
   - Concurrent request limiting (3 max)
   - Graceful degradation

3. **Performance Optimization**
   - Intelligent caching with TTL (5 minutes)
   - Response time tracking
   - Model usage analytics
   - Memory-efficient cache management

4. **Monitoring & Observability**
   - Prometheus metrics integration
   - Grafana dashboards
   - Real-time performance monitoring
   - Comprehensive logging

## 🛠 Deployment Options

### **Option 1: Docker Compose (Recommended)**

```bash
# Clone the repository
git clone <your-repo>
cd space-analyzer

# Deploy with production features
chmod +x scripts/deploy-ollama-production.sh
./scripts/deploy-ollama-production.sh
```

### **Option 2: Manual Docker Deployment**

```bash
# Create network
docker network create ollama-network

# Deploy Ollama with enhanced service
docker run -d \
  --name space-analyzer-ollama \
  --restart unless-stopped \
  -p 11434:11434 \
  -v ollama_models:/models \
  -e OLLAMA_HOST=0.0.0.0 \
  -e OLLAMA_MODELS=/models \
  --network ollama-network \
  ollama/ollama:latest

# Deploy monitoring stack
docker-compose -f docker-compose.ollama.yml up -d prometheus grafana redis
```

### **Option 3: Node.js Direct Deployment**

```bash
# Install dependencies
npm install

# Start enhanced service
node server/EnhancedOllamaService.js

# With PM2 for process management
pm2 start server/EnhancedOllamaService.js --name "ollama-service"
```

## 📊 Monitoring Setup

### **Prometheus Configuration**

The service exposes metrics at `/metrics` endpoint:

- `ollama_requests_total` - Total requests
- `ollama_successful_requests` - Successful requests
- `ollama_failed_requests` - Failed requests
- `ollama_response_time_seconds` - Response times
- `ollama_model_usage` - Model usage statistics

### **Grafana Dashboards**

Access Grafana at `http://localhost:3001` (admin/admin123)

Pre-configured dashboards include:
- Ollama Service Overview
- Request Performance
- Model Usage Analytics
- System Health Monitoring

### **Key Metrics to Monitor**

1. **Service Health**
   - Uptime percentage
   - Circuit breaker status
   - Response time trends

2. **Performance**
   - Request rate (requests/minute)
   - Average response time
   - Error rate percentage

3. **Resource Usage**
   - Memory consumption
   - CPU utilization
   - Cache hit rate

## 🔧 Configuration

### **Environment Variables**

```bash
# Service Configuration
OLLAMA_HOST=0.0.0.0
OLLAMA_MODELS=/models
CUDA_VISIBLE_DEVICES=0,1

# Performance Tuning
MAX_CONCURRENT_REQUESTS=3
RATE_LIMIT_REQUESTS=100
CACHE_EXPIRY_MS=300000
CIRCUIT_BREAKER_THRESHOLD=5

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
REDIS_PORT=6379
```

### **Service Configuration**

```javascript
// EnhancedOllamaService.js configuration
const config = {
  // Request Management
  maxConcurrentRequests: 3,
  rateLimitWindow: 60000, // 1 minute
  maxRequestsPerWindow: 100,
  
  // Circuit Breaker
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 30000, // 30 seconds
  
  // Caching
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  
  // Health Monitoring
  healthCheckInterval: 30000, // 30 seconds
  healthCheckTimeout: 5000 // 5 seconds
};
```

## 📈 Performance Optimization

### **Model Selection Strategy**

The enhanced service automatically selects models based on:

1. **Content Analysis**
   - Code-related queries → Code models
   - Analysis queries → Analysis models
   - Vision content → Vision models
   - General queries → General models

2. **Performance Considerations**
   - Response time tracking
   - Model usage statistics
   - Error rate monitoring

### **Caching Strategy**

- **Cache Key**: Model + prompt + options hash
- **TTL**: 5 minutes (configurable)
- **Size Limit**: 100 entries (LRU eviction)
- **Hit Rate**: Typically 60-80% for repeated queries

### **Rate Limiting**

- **Window**: 1 minute sliding window
- **Limit**: 100 requests per minute
- **Priority**: High priority for chat requests
- **Queue**: FIFO with priority insertion

## 🛡 Security Considerations

### **Network Security**

```bash
# Firewall rules
ufw allow 11434/tcp  # Ollama API
ufw allow 9090/tcp   # Prometheus
ufw allow 3001/tcp   # Grafana
ufw allow 6379/tcp   # Redis
```

### **Access Control**

1. **API Authentication**
   ```javascript
   // Add to EnhancedOllamaService.js
   const API_KEY = process.env.OLLAMA_API_KEY;
   
   function authenticateRequest(req) {
     return req.headers['x-api-key'] === API_KEY;
   }
   ```

2. **Rate Limiting per Client**
   ```javascript
   const clientRateLimits = new Map();
   
   function checkClientRateLimit(clientId) {
     // Implement per-client rate limiting
   }
   ```

### **Data Privacy**

- All processing happens locally
- No data sent to external services
- Configurable data retention policies
- Secure cache management

## 🔍 Troubleshooting

### **Common Issues**

1. **Service Unavailable**
   ```bash
   # Check health status
   curl http://localhost:11434/api/tags
   
   # Check logs
   docker logs space-analyzer-ollama
   ```

2. **High Memory Usage**
   ```bash
   # Monitor memory
   docker stats space-analyzer-ollama
   
   # Clear cache
   curl -X POST http://localhost:11434/api/clear-cache
   ```

3. **Circuit Breaker Open**
   ```bash
   # Check circuit breaker status
   curl http://localhost:11434/api/health
   
   # Manual reset
   curl -X POST http://localhost:11434/api/reset-circuit-breaker
   ```

### **Performance Issues**

1. **Slow Response Times**
   - Check model loading status
   - Monitor GPU utilization
   - Review cache hit rates

2. **High Error Rates**
   - Check Ollama service logs
   - Verify model availability
   - Monitor resource constraints

### **Monitoring Alerts**

Set up alerts for:
- Service downtime (> 1 minute)
- Error rate > 5%
- Response time > 5 seconds
- Memory usage > 80%

## 📚 API Reference

### **Enhanced Endpoints**

```bash
# Health Check
GET /api/health

# Metrics
GET /metrics

# Cache Management
POST /api/clear-cache
GET /api/cache-stats

# Circuit Breaker
GET /api/circuit-breaker-status
POST /api/reset-circuit-breaker

# Performance Metrics
GET /api/performance-metrics
```

### **Response Format**

```json
{
  "status": "healthy",
  "metrics": {
    "totalRequests": 1250,
    "successRate": "98.4%",
    "averageResponseTime": 1.2,
    "uptime": "Healthy",
    "circuitBreakerStatus": "Closed",
    "queueLength": 0,
    "activeRequests": 2
  }
}
```

## 🚀 Scaling Considerations

### **Horizontal Scaling**

```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    deploy:
      replicas: 3
    environment:
      - OLLAMA_HOST=0.0.0.0
      - INSTANCE_ID={{.Task.Slot}}
```

### **Load Balancing**

```nginx
# nginx.conf
upstream ollama_backend {
    server ollama-1:11434;
    server ollama-2:11434;
    server ollama-3:11434;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://ollama_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📋 Maintenance

### **Regular Tasks**

1. **Daily**
   - Check service health
   - Review error logs
   - Monitor performance metrics

2. **Weekly**
   - Update models if needed
   - Clean up old cache entries
   - Review resource usage

3. **Monthly**
   - Update Docker images
   - Backup configurations
   - Performance tuning

### **Backup Strategy**

```bash
# Backup models
docker run --rm -v ollama_models:/data -v ./backup:/backup alpine tar czf /backup/ollama_models_$(date +%Y%m%d).tar.gz -C /data .

# Backup configuration
cp server/EnhancedOllamaService.js backup/
cp docker-compose.ollama.yml backup/
```

## 🎯 Best Practices

1. **Monitoring**: Always monitor key metrics and set up alerts
2. **Caching**: Use caching effectively for repeated queries
3. **Rate Limiting**: Implement appropriate rate limits to prevent abuse
4. **Health Checks**: Regular health checks ensure service reliability
5. **Resource Management**: Monitor and optimize resource usage
6. **Security**: Implement proper authentication and authorization
7. **Backup**: Regular backups of models and configurations
8. **Documentation**: Keep documentation up to date

## 📞 Support

For issues and questions:
- Check logs: `docker logs space-analyzer-ollama`
- Review metrics: http://localhost:9090
- Monitor dashboards: http://localhost:3001
- Review this documentation

---

**Last Updated**: January 2026  
**Version**: 1.0.0  
**Compatibility**: Ollama 0.1.0+, Docker 20.10+, Node.js 18+
