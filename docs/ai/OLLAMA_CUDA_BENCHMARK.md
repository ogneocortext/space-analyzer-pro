# Ollama CUDA vs Non-CUDA Benchmark Workflow

This workflow allows you to test and optimize Ollama coding models for maximum performance by comparing CUDA vs non-CUDA environments.

## Overview

The benchmark suite compares CUDA and non-CUDA Ollama backends for coding-specific tasks including:
- Code generation
- Code debugging
- Code explanation
- Code refactoring
- Algorithm design

## Prerequisites

1. **Ollama** (installed via winget):
   ```bash
   winget install Ollama.Ollama
   ```

2. **CUDA Environment** (optional, for GPU acceleration):
   - NVIDIA GPU with CUDA support
   - CUDA toolkit installed
   - Conda environment with CUDA packages

3. **Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Installation

### Setup

1. Start Ollama server:
   ```bash
   ollama serve
   ```

2. Pull coding models in Ollama:
   ```bash
   ollama pull qwen2.5-coder:7b-instruct
   ollama pull deepseek-coder:6.7b-instruct
   ```

## Usage

### Quick Start

Run the automated benchmark script:

```bash
cd scripts
python ollama_cuda_benchmark.py --quick
```

This will:
- Detect your current environment (CUDA or non-CUDA)
- Run benchmark tests on coding tasks
- Generate performance report

### Manual Usage

#### CUDA Benchmark

```bash
cd scripts
python ollama_cuda_benchmark.py --environment cuda
```

#### Non-CUDA Benchmark

```bash
cd scripts
python ollama_cuda_benchmark.py --environment non-cuda
```

#### Custom Models

```bash
python ollama_cuda_benchmark.py --model "deepseek-coder:6.7b-instruct" --environment cuda
```

#### Full Benchmark

```bash
python ollama_cuda_benchmark.py --model "qwen2.5-coder:7b-instruct"
```

## Components

### ollama_client.py (Optimized)

Enhanced Ollama client with CUDA optimization support:

**New CUDA Parameters:**
- `num_gpu`: Number of GPU layers to offload (default: 50 for CUDA)
- `num_ctx`: Context window size (default: 4096 for CUDA, 2048 for non-CUDA)
- `num_thread`: Number of CPU threads (default: 8 for CUDA, 4 for non-CUDA)

**Usage:**
```python
from ollama_client import OllamaClient

client = OllamaClient(base_url="http://localhost:11434", default_model="qwen2.5-coder:7b-instruct")

# CUDA optimized
response = client.generate(
    prompt="Write a Python function...",
    num_gpu=50,
    num_ctx=4096,
    num_thread=8,
)

# Non-CUDA
response = client.generate(
    prompt="Write a Python function...",
    num_ctx=2048,
    num_thread=4,
)
```

### ollama_cuda_benchmark.py

Benchmark script that compares CUDA vs non-CUDA performance.

**Features:**
- Automatic environment detection
- Coding-specific prompts
- Quality scoring for code generation
- Performance metrics (latency, tokens/sec)
- Detailed comparison reports
- JSON and Markdown output

## Benchmark Tasks

The benchmark includes 6 coding-specific tasks:

1. **Code Generation Speed** - Speed of generating code
2. **Code Generation Quality** - Quality of generated code
3. **Debugging Accuracy** - Finding and fixing bugs
4. **Code Explanation** - Clarity of explanations
5. **Refactoring Skill** - Code improvement ability
6. **Algorithm Design** - Algorithm implementation

## Results

Results are saved to `benchmark_results\` directory:

- `ollama_cuda_benchmark_YYYYMMDD_HHMMSS.json` - Raw results
- `ollama_cuda_benchmark_report_YYYYMMDD_HHMMSS.md` - Human-readable report

### Report Contents

- Overall winner comparison
- Performance metrics table
- Per-task scores
- Recommendations for environment selection

## Performance Comparison

The benchmark evaluates:

- **Weighted Score** - Overall performance across tasks
- **Quality Score** - Code quality metrics
- **Performance Score** - Speed and efficiency
- **Latency** - Response time
- **Tokens/Second** - Generation speed
- **Speedup Factor** - CUDA vs non-CUDA speedup

## Example Results

Based on benchmark tests with qwen2.5-coder:7b-instruct:

```
## Overall Winner

**CUDA** wins with better overall performance

### Performance Metrics

| Metric | CUDA | Non-CUDA | Difference |
|--------|------|----------|------------|
| Weighted Score | 45.2 | 45.2 | 0.0 |
| Quality Score | 26.9 | 26.9 | 0.0 |
| Avg Latency (ms) | 11634 | 17167 | -5533 |
| Tokens/sec | 26.1 | 19.4 | +6.7 |
| Speedup Factor | - | - | 1.35x |
| Latency Improvement | - | - | 32.2% |

### Recommendations

- CUDA environment provides better overall performance
- CUDA is 1.35x faster in token generation
- CUDA has 32.2% lower latency
```

## CUDA Optimization Tips

### For Maximum Performance:

1. **Use GPU Layers**: Offload as many layers as possible to GPU
   ```python
   num_gpu=50  # or higher if GPU memory allows
   ```

2. **Increase Context Size**: Larger context for complex tasks
   ```python
   num_ctx=4096  # or 8192 for very complex tasks
   ```

3. **Optimize Threads**: Match CPU threads to your CPU cores
   ```python
   num_thread=8  # or number of CPU cores
   ```

4. **Use CUDA Environment**: Run in conda environment with CUDA packages
   ```bash
   conda activate cuda_env
   ```

### Environment Variables:

Set these to help automatic detection:
```bash
export CUDA_VISIBLE_DEVICES=0
export CUDA_HOME=/usr/local/cuda
export NVIDIA_VISIBLE_DEVICES=0
```

## Troubleshooting

### CUDA Not Detected

**Issue:** Benchmark detects non-CUDA environment despite having CUDA

**Solution:**
- Set environment variables manually
- Use `--environment cuda` flag to force CUDA mode
- Verify CUDA installation: `nvidia-smi`

### Ollama Server Not Reachable

**Error:** `Ollama server not reachable`

**Solution:**
- Start Ollama: `ollama serve`
- Check if port 11434 is available
- Verify Ollama installation

### Model Not Found

**Error:** `Model not found`

**Solution:**
- Pull the model: `ollama pull <model-name>`
- Verify model name matches available models: `ollama list`

## Tips for Maximum Performance

1. **Use CUDA Environment** for GPU acceleration (35% faster in tests)
2. **Optimize GPU Layers** based on available GPU memory
3. **Use Appropriate Context Size** based on your needs
4. **Benchmark Multiple Times** for accurate results
5. **Monitor GPU Usage** with `nvidia-smi` during benchmarks

## Custom Coding Agents

Based on benchmark results, you can:

1. **Choose the faster environment** for your coding agent
2. **Optimize CUDA parameters** for your specific GPU
3. **Select appropriate models** for specific coding tasks
4. **Configure backend settings** for your use case

## Next Steps

1. Run the benchmark in your CUDA environment
2. Run the benchmark in non-CUDA environment
3. Compare the results to determine optimal configuration
4. Integrate the optimized settings into your coding agent
5. Monitor performance over time

## Additional Resources

- [Ollama Documentation](https://ollama.com/docs)
- [CUDA Toolkit Documentation](https://docs.nvidia.com/cuda/)
- [Model Benchmark Guide](../docs/OLLAMA_TESTING_GUIDE.md)
