#!/bin/bash

# Model Cleanup Script for Mixture of Experts Upgrade
# Removes old models that have been replaced by GTX 1070 Ti optimized versions

echo "🧹 MIXTURE OF EXPERTS MODEL CLEANUP"
echo "==================================="
echo ""
echo "Removing old models replaced by GTX 1070 Ti optimized versions..."
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
echo "📋 Current installed models:"
ollama list

echo ""
echo "🗑️  Removing replaced models..."
echo ""

# Models being replaced by GTX 1070 Ti optimized versions
echo "Removing gemma3:latest (replaced by mistral:7b-instruct-q4_0)..."
ollama rm gemma3:latest

echo "Removing deepseek-coder:6.7b (replaced by qwen2.5-coder:7b-instruct-q4_0)..."
ollama rm deepseek-coder:6.7b

echo "Removing codegemma:7b-instruct (replaced by llama3.1:8b-instruct-q4_0)..."
ollama rm codegemma:7b-instruct

echo ""
echo "✅ Old models removed successfully!"
echo ""

echo "📦 Remaining models:"
ollama list

echo ""
echo "💾 Disk space freed:"
echo "   • gemma3:latest: ~3.1GB"
echo "   • deepseek-coder:6.7b: ~3.6GB"
echo "   • codegemma:7b-instruct: ~4.7GB"
echo "   • Total freed: ~11.4GB"
echo ""

echo "🎯 Next steps:"
echo "   1. Install new GTX 1070 Ti optimized models:"
echo "      ./install-gtx1070ti-models.sh"
echo "   2. Test the upgraded system:"
echo "      node mixture-of-experts-workflow.js"
echo ""

echo "✨ Cleanup complete! Ready for GTX 1070 Ti optimized models."