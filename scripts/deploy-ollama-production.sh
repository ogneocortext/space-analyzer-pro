#!/bin/bash

# Production Deployment Script for Enhanced Ollama Service
# This script sets up and deploys the Ollama service with production-ready features

set -e

echo "🚀 Starting Ollama Production Deployment..."

# Configuration
OLLAMA_VERSION="latest"
PROJECT_NAME="space-analyzer-ollama"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./logs/deployment_$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p backups logs monitoring/grafana/dashboards monitoring/grafana/datasources nginx/ssl

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
    log "✅ Docker is running"
}

# Function to backup existing data
backup_existing() {
    log "📦 Backing up existing data..."
    
    if docker volume ls | grep -q "ollama_models"; then
        docker run --rm -v ollama_models:/data -v "$PWD/backups":/backup alpine tar czf /backup/ollama_models_backup.tar.gz -C /data .
        log "✅ Backed up ollama_models volume"
    fi
    
    if [ -f "./server/OllamaService.js" ]; then
        cp "./server/OllamaService.js" "$BACKUP_DIR/OllamaService.js.backup"
        log "✅ Backed up original OllamaService.js"
    fi
}

# Function to pull latest images
pull_images() {
    log "📥 Pulling latest Docker images..."
    
    docker pull ollama/ollama:$OLLAMA_VERSION
    docker pull prom/prometheus:latest
    docker pull grafana/grafana:latest
    docker pull redis:7-alpine
    docker pull nginx:alpine
    
    log "✅ All images pulled successfully"
}

# Function to deploy services
deploy_services() {
    log "🚀 Deploying services..."
    
    # Stop existing services
    docker-compose -f docker-compose.ollama.yml down || true
    
    # Start services
    docker-compose -f docker-compose.ollama.yml up -d
    
    log "✅ Services deployed successfully"
}

# Function to wait for services to be healthy
wait_for_health() {
    log "⏳ Waiting for services to be healthy..."
    
    # Wait for Ollama
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:11434/api/tags > /dev/null 2>&1; then
            log "✅ Ollama service is healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log "❌ Ollama service failed to become healthy"
            exit 1
        fi
        
        log "⏳ Waiting for Ollama... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    # Wait for other services
    sleep 30
    log "✅ All services should be healthy now"
}

# Function to setup monitoring
setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    # Create Grafana datasources
    cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
    
    log "✅ Monitoring setup complete"
}

# Function to run health checks
run_health_checks() {
    log "🔍 Running comprehensive health checks..."
    
    # Check Ollama
    if curl -f http://localhost:11434/api/tags > /dev/null 2>&1; then
        log "✅ Ollama API is accessible"
    else
        log "❌ Ollama API is not accessible"
        return 1
    fi
    
    # Check Prometheus
    if curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
        log "✅ Prometheus is healthy"
    else
        log "❌ Prometheus is not healthy"
        return 1
    fi
    
    # Check Grafana
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        log "✅ Grafana is healthy"
    else
        log "❌ Grafana is not healthy"
        return 1
    fi
    
    # Check Redis
    if docker exec space-analyzer-redis redis-cli ping > /dev/null 2>&1; then
        log "✅ Redis is healthy"
    else
        log "❌ Redis is not healthy"
        return 1
    fi
    
    log "✅ All health checks passed"
}

# Function to show deployment info
show_deployment_info() {
    log "📋 Deployment Information:"
    echo "=================================="
    echo "🔗 Ollama API: http://localhost:11434"
    echo "📊 Prometheus: http://localhost:9090"
    echo "📈 Grafana: http://localhost:3001 (admin/admin123)"
    echo "💾 Redis: localhost:6379"
    echo "🌐 Nginx: http://localhost:80"
    echo "=================================="
    echo ""
    echo "📝 Logs:"
    echo "  Docker logs: docker-compose -f docker-compose.ollama.yml logs -f"
    echo "  Deployment log: $LOG_FILE"
    echo ""
    echo "🛠 Management Commands:"
    echo "  Stop services: docker-compose -f docker-compose.ollama.yml down"
    echo "  Restart services: docker-compose -f docker-compose.ollama.yml restart"
    echo "  View status: docker-compose -f docker-compose.ollama.yml ps"
    echo ""
    echo "📊 Monitoring:"
    echo "  View metrics: http://localhost:9090"
    echo "  View dashboards: http://localhost:3001"
    echo ""
}

# Main deployment flow
main() {
    log "🚀 Starting Ollama Production Deployment..."
    
    check_docker
    backup_existing
    setup_monitoring
    pull_images
    deploy_services
    wait_for_health
    run_health_checks
    show_deployment_info
    
    log "🎉 Deployment completed successfully!"
}

# Handle script interruption
trap 'log "❌ Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
