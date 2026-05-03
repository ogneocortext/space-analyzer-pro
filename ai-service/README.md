# Space Analyzer AI Service

Python-based ML service for intelligent file analysis and cleanup predictions.

## Features

- **File Categorization**: ML-powered file type prediction
- **Cleanup Recommendations**: AI-suggested files for deletion/archival
- **REST API**: FastAPI-based with automatic OpenAPI docs
- **Background Training**: Train models without blocking requests

## Quick Start

### 1. Install Dependencies

```bash
cd ai-service
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Start the Service

```bash
python main.py
```

Or with auto-reload for development:

```bash
uvicorn main:app --reload --port 5000
```

### 3. Access API Documentation

- Swagger UI: http://localhost:5000/docs
- ReDoc: http://localhost:5000/redoc

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/models/status` | GET | List all ML models and their status |
| `/predict/category` | POST | Predict file category |
| `/predict/categories-batch` | POST | Batch file categorization |
| `/predict/cleanup` | POST | Get cleanup recommendations |
| `/train/categorizer` | POST | Train categorization model |
| `/train/cleanup-predictor` | POST | Train cleanup predictor |

## Example Usage

### Predict File Category

```bash
curl -X POST http://localhost:5000/predict/category \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/docs/report.pdf",
    "name": "report.pdf",
    "size": 2048000,
    "extension": ".pdf",
    "modified_time": 1704067200
  }'
```

Response:
```json
{
  "path": "/docs/report.pdf",
  "predicted_category": "documents",
  "confidence": 0.95,
  "alternatives": [
    {"category": "documents", "confidence": 0.95},
    {"category": "archives", "confidence": 0.03}
  ]
}
```

### Train Categorizer

```bash
curl -X POST http://localhost:5000/train/categorizer \
  -H "Content-Type: application/json" \
  -d '[
    {"path": "/docs/file1.pdf", "name": "file1.pdf", "size": 1000, "extension": ".pdf", "modified_time": 1704067200, "category": "documents"},
    {"path": "/images/photo.jpg", "name": "photo.jpg", "size": 5000, "extension": ".jpg", "modified_time": 1704067200, "category": "images"}
  ]'
```

### Get Cleanup Recommendations

```bash
curl -X POST http://localhost:5000/predict/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "directory_path": "/downloads",
    "total_files": 1000,
    "total_size": 5000000000,
    "file_types": {".zip": 50, ".pdf": 200},
    "age_distribution": {"<30d": 100, "30-90d": 300, "90-365d": 400, ">365d": 200},
    "largest_files": [
      {"path": "/downloads/old.zip", "name": "old.zip", "size": 1000000000, "extension": ".zip", "modified_time": 1609459200}
    ]
  }'
```

## Integration with Node.js Backend

The AI service integrates with the existing Node.js backend:

1. Port configuration is shared via `config/ports.config.js` (`PYTHON_AI_PORT: 5000`)
2. The Node backend can proxy AI requests or call directly
3. Models are saved to `./models/` directory

## Model Storage

Trained models are saved to the `models/` directory:
- `file_categorizer.pkl` - File categorization model
- `file_categorizer_encoder.pkl` - Label encoder for categories
- `cleanup_predictor.pkl` - Cleanup prediction model

Models persist across service restarts.

## Development

### Code Formatting

```bash
black main.py
```

### Testing

```bash
pytest
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTHON_AI_PORT` | 5000 | Service port |
| `MODELS_DIR` | ./models | Model storage path |
| `LOG_LEVEL` | INFO | Logging level |
| `DEBUG` | false | Debug mode |

## Architecture

```
┌─────────────────┐
│   Vue.js UI     │
│   (Frontend)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Node/Express   │────▶│  Python AI      │
│  (API Router)   │     │  (Port 5000)    │
│  Port 8080      │◄────│  FastAPI + ML   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Rust Scanner   │
│  (Native)       │
└─────────────────┘
```

## Future Enhancements

- [ ] Deep learning models (PyTorch/TensorFlow)
- [ ] Natural language processing for document analysis
- [ ] Image classification for photo organization
- [ ] Time-series forecasting for storage growth prediction
- [ ] Anomaly detection for unusual file patterns
