#!/bin/bash
# Comprehensive startup script for Space Analyzer Pro services
# Starts all services and performs health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service ports
FRONTEND_PORT=5173
BACKEND_PORT=8080
AI_SERVICE_PORT=5000

# Log files
LOG_DIR="logs"
mkdir -p "$LOG_DIR"

echo -e "${BLUE}🚀 Starting Space Analyzer Pro Services${NC}"
echo "=================================="

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Attempt $attempt/$max_attempts...${NC}"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to start within timeout${NC}"
    return 1
}

# Function to start service in background
start_service() {
    local command=$1
    local service_name=$2
    local log_file="$LOG_DIR/${service_name}.log"
    
    echo -e "${BLUE}🔧 Starting $service_name...${NC}"
    
    # Start service in background
    eval "$command" > "$log_file" 2>&1 &
    local pid=$!
    
    echo "PID: $pid" > "$LOG_DIR/${service_name}.pid"
    
    # Give service a moment to start
    sleep 3
    
    # Check if process is still running
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✅ $service_name started (PID: $pid)${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name failed to start${NC}"
        echo -e "${RED}Check log: $log_file${NC}"
        return 1
    fi
}

# Function to stop all services
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all services...${NC}"
    
    for service in frontend backend ai-service; do
        if [ -f "$LOG_DIR/${service}.pid" ]; then
            local pid=$(cat "$LOG_DIR/${service}.pid")
            if kill -0 $pid 2>/dev/null; then
                echo -e "${YELLOW}🛑 Stopping $service (PID: $pid)...${NC}"
                kill $pid 2>/dev/null || true
                sleep 2
                kill -9 $pid 2>/dev/null || true
            fi
            rm -f "$LOG_DIR/${service}.pid"
        fi
    done
    
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

# Check if required ports are available
echo -e "${BLUE}🔍 Checking port availability...${NC}"

for port in $FRONTEND_PORT $BACKEND_PORT $AI_SERVICE_PORT; do
    if check_port $port; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        echo -e "${YELLOW}   Services may already be running${NC}"
        
        read -p "Do you want to stop existing services and continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}🛑 Stopping existing services...${NC}"
            # Kill processes using the ports
            for p in $FRONTEND_PORT $BACKEND_PORT $AI_SERVICE_PORT; do
                lsof -ti:$p | xargs kill -9 2>/dev/null || true
            done
            sleep 2
        else
            echo -e "${RED}❌ Please stop services using ports $FRONTEND_PORT, $BACKEND_PORT, $AI_SERVICE_PORT${NC}"
            exit 1
        fi
    fi
done

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

# Check Poetry (for AI service)
if ! command -v poetry &> /dev/null; then
    echo -e "${YELLOW}⚠️  Poetry is not installed (required for AI service)${NC}"
    echo -e "${YELLOW}   Installing Poetry...${NC}"
    curl -sSL https://install.python-poetry.org | python3 -
fi

echo -e "${GREEN}✅ Dependencies check passed${NC}"

# Start services in order

# 1. Start Backend
echo -e "\n${BLUE}🔧 Starting Backend Service${NC}"
cd "$(dirname "$0")/.."
start_service "npm run server" "backend"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    exit 1
fi

# Wait for backend to be ready
wait_for_service "http://localhost:$BACKEND_PORT/health" "Backend"

# 2. Start AI Service
echo -e "\n${BLUE}🔧 Starting AI Service${NC}"
cd ai-service

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Setting up Python virtual environment...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

# Install dependencies
if [ ! -f "poetry.lock" ]; then
    echo -e "${YELLOW}📦 Installing AI service dependencies...${NC}"
    pip install -r requirements.txt 2>/dev/null || {
        echo -e "${YELLOW}📦 Installing with Poetry...${NC}"
        poetry install
    }
fi

cd ..
start_service "cd ai-service && python main.py" "ai-service"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ AI service failed to start${NC}"
    echo -e "${YELLOW}⚠️  Continuing without AI service (some features may be limited)${NC}"
else
    # Wait for AI service to be ready
    wait_for_service "http://localhost:$AI_SERVICE_PORT/health" "AI Service"
fi

# 3. Start Frontend
echo -e "\n${BLUE}🔧 Starting Frontend Service${NC}"
start_service "npm run dev" "frontend"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    exit 1
fi

# Wait for frontend to be ready
wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"

echo -e "\n${GREEN}🎉 All services started successfully!${NC}"
echo "=================================="
echo -e "${GREEN}🌐 Frontend:${NC}     http://localhost:$FRONTEND_PORT"
echo -e "${GREEN}🔧 Backend API:${NC}  http://localhost:$BACKEND_PORT"
echo -e "${GREEN}🤖 AI Service:${NC}    http://localhost:$AI_SERVICE_PORT"
echo -e "${GREEN}📊 AI Docs:${NC}       http://localhost:$AI_SERVICE_PORT/docs"
echo "=================================="
echo -e "${BLUE}📝 Logs available in: $LOG_DIR/${NC}"
echo -e "${YELLOW}⚠️  Press Ctrl+C to stop all services${NC}"

# Keep script running
while true; do
    sleep 10
    
    # Check if services are still running
    services_running=true
    
    for service in frontend backend ai-service; do
        if [ -f "$LOG_DIR/${service}.pid" ]; then
            local pid=$(cat "$LOG_DIR/${service}.pid")
            if ! kill -0 $pid 2>/dev/null; then
                echo -e "${RED}❌ $service (PID: $pid) is no longer running${NC}"
                services_running=false
            fi
        else
            echo -e "${RED}❌ $service PID file not found${NC}"
            services_running=false
        fi
    done
    
    if [ "$services_running" = false ]; then
        echo -e "${RED}❌ One or more services stopped unexpectedly${NC}"
        cleanup
    fi
done
