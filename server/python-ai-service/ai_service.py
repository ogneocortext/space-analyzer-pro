from flask import Flask, request, jsonify
from flask_cors import CORS
import ollama
import json
import logging
from datetime import datetime
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')
DEFAULT_MODEL = 'phi4-mini:latest'
TIMEOUT = 60  # seconds

# Set OLLAMA_HOST environment variable for the ollama library
os.environ['OLLAMA_HOST'] = OLLAMA_HOST

@app.route('/health', methods=['GET'])
def health_check():
    """Check if the service and Ollama are available"""
    try:
        # Test Ollama connection
        models = ollama.list()
        return jsonify({
            'status': 'ok',
            'service': 'python-ai-service',
            'ollama_available': True,
            'models_count': len(models.get('models', [])),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'service': 'python-ai-service',
            'ollama_available': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available Ollama models"""
    try:
        models = ollama.list()
        return jsonify({
            'success': True,
            'models': models.get('models', []),
            'count': len(models.get('models', []))
        })
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/generate', methods=['POST'])
def generate():
    """Generate AI insights for file system analysis"""
    try:
        data = request.json
        prompt = data.get('prompt', '')
        model = data.get('model', DEFAULT_MODEL)
        
        if not prompt:
            return jsonify({
                'success': False,
                'error': 'Prompt is required'
            }), 400
        
        logger.info(f"Generating with model: {model}, prompt length: {len(prompt)}")
        
        # Generate response using Ollama
        response = ollama.generate(
            model=model,
            prompt=prompt,
            options={
                'temperature': 0.3,
                'top_p': 0.8,
                'num_predict': 500
            }
        )
        
        logger.info(f"Generated response, length: {len(response.get('response', ''))}")
        
        return jsonify({
            'success': True,
            'response': response.get('response', ''),
            'model': model,
            'done': response.get('done', True)
        })
        
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/analyze', methods=['POST'])
def analyze_filesystem():
    """Analyze file system data and provide AI insights"""
    try:
        data = request.json
        analysis_data = data.get('analysisData', {})
        model = data.get('model', DEFAULT_MODEL)
        
        # Build a comprehensive prompt from the analysis data
        prompt = build_analysis_prompt(analysis_data)
        
        logger.info(f"Analyzing filesystem with model: {model}")
        
        # Generate insights
        response = ollama.generate(
            model=model,
            prompt=prompt,
            options={
                'temperature': 0.3,
                'top_p': 0.8,
                'num_predict': 800
            }
        )
        
        insights = parse_insights(response.get('response', ''))
        
        return jsonify({
            'success': True,
            'insights': insights,
            'raw_response': response.get('response', ''),
            'model': model
        })
        
    except Exception as e:
        logger.error(f"Filesystem analysis failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def build_analysis_prompt(data):
    """Build a comprehensive prompt from analysis data"""
    total_files = data.get('totalFiles', 0)
    total_size = data.get('totalSize', 0)
    categories = data.get('categories', {})
    
    prompt = f"""Analyze this file system data and provide actionable insights:

Total Files: {total_files}
Total Size: {format_size(total_size)}

Categories:"""
    
    for cat_name, cat_data in categories.items():
        count = cat_data.get('count', 0)
        size = cat_data.get('size', 0)
        prompt += f"\n- {cat_name}: {count} files ({format_size(size)})"
    
    prompt += """

Please provide:
1. Storage optimization recommendations
2. Potential duplicate files to investigate
3. Large files that might need attention
4. Unusual file patterns or extensions
5. Overall storage health assessment

Format your response as JSON with these keys:
- recommendations: array of strings
- large_files: array of objects with name and size
- unusual_patterns: array of strings
- health_score: number from 0-100
- summary: brief description"""
    
    return prompt

def parse_insights(response_text):
    """Parse the AI response into structured insights"""
    try:
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Failed to parse JSON from response: {e}")
        pass
    
    # Fallback to basic structure
    return {
        'recommendations': [],
        'large_files': [],
        'unusual_patterns': [],
        'health_score': 75,
        'summary': response_text[:500] if response_text else 'No insights generated'
    }

def format_size(bytes_size):
    """Format bytes to human-readable size"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_size < 1024:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.2f} PB"

if __name__ == '__main__':
    logger.info("Starting Python AI Service on port 8084...")
    app.run(host='0.0.0.0', port=8084, debug=True)
