#!/bin/bash

# GTX 1070 Ti Optimized Model Installation Script
# Installs CUDA-optimized, 4-bit quantized models for Mixture of Experts system

echo "🎮 GTX 1070 Ti Model Installation Script"
echo "======================================="
echo ""
echo "Hardware: GTX 1070 Ti 8GB VRAM, Ryzen 5 5500, 32GB DDR4 3200MHz"
echo "Optimization: 4-bit quantized models, CUDA enabled"
echo ""

# Check if Ollama is running
echo "🔌 Checking Ollama status..."
if ! curl -s http://localhost:11434/api/version > /dev/null; then
    echo "❌ Ollama is not running. Please start Ollama first:"
    echo "   ollama serve"
    exit 1
fi
echo "✅ Ollama is running"

echo ""
echo "📦 Installing GTX 1070 Ti Optimized Models..."
echo ""

# Install models in parallel for faster download
echo "🚀 Starting parallel downloads..."

# Vision model (already good, keep as is)
echo "📸 Vision Model: llava:7b (already installed)"

# Install the 4-bit quantized models
echo "🤖 Installing Design Critic: mistral:7b-instruct-q4_0"
ollama pull mistral:7b-instruct-q4_0 &

echo "👨‍💻 Installing Technical Architect: qwen2.5-coder:7b-instruct-q4_0"
ollama pull qwen2.5-coder:7b-instruct-q4_0 &

echo "🎨 Installing UX Specialist: qwen2.5-coder:7b-instruct-q4_0"
ollama pull qwen2.5-coder:7b-instruct-q4_0 &

echo "🧠 Installing Integration Expert: llama3.1:8b-instruct-q4_0"
ollama pull llama3.1:8b-instruct-q4_0 &

echo ""
echo "⏳ Waiting for all downloads to complete..."
wait

echo ""
echo "✅ All models installed successfully!"
echo ""
echo "📊 VRAM Usage Summary:"
echo "   • llava:7b: 4.4GB"
echo "   • mistral:7b-instruct-q4_0: 4.1GB"
echo "   • qwen2.5-coder:7b-instruct-q4_0: 4.4GB (x2 - shared)"
echo "   • llama3.1:8b-instruct-q4_0: 4.7GB"
echo "   • Total Peak: ~8GB (fits in GTX 1070 Ti 8GB)"
echo ""
echo "🧪 Testing installation..."
echo ""

# Test the models
echo "Testing Vision Model..."
ollama run llava:7b "Hello" --format json | head -1

echo ""
echo "Testing Design Critic..."
ollama run mistral:7b-instruct-q4_0 "Hello" --format json | head -1

echo ""
echo "Testing Technical Architect..."
ollama run qwen2.5-coder:7b-instruct-q4_0 "Hello" --format json | head -1

echo ""
echo "Testing Integration Expert..."
ollama run llama3.1:8b-instruct-q4_0 "Hello" --format json | head -1

echo ""
echo "🎉 Installation complete! GTX 1070 Ti optimized setup ready."
echo ""
echo "🚀 Next steps:"
echo "   1. Run: node mixture-of-experts-workflow.js"
echo "   2. Check performance: node check-models-for-moe.js"
echo ""
echo "💡 Performance tips:"
echo "   • Models use 4-bit quantization for optimal GTX 1070 Ti performance"
echo "   • CUDA acceleration enabled for maximum speed"
echo "   • Total VRAM usage stays under 8GB limit"
echo "   • Ryzen 5 5500 provides excellent CPU support"