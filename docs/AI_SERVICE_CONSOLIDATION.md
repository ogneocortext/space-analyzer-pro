# AI Service Consolidation - Migration Guide

## Overview

Three separate AI services have been consolidated into a single unified FastAPI service running on **port 5000**.

### Before (3 services)
| Service | Port | Framework | Purpose |
|---------|------|-----------|---------|
| `ai-service/main.py` | 5000 | FastAPI | ML predictions, cleanup, auth |
| `ai-service/ml_categorizer/src/api.py` | 8001 | FastAPI | Advanced file categorization |
| `server/python-ai-service/ai_service.py` | 8084 | Flask | Ollama proxy for AI insights |

### After (1 service)
| Service | Port | Framework | Purpose |
|---------|------|-----------|---------|
| `ai-service/app/main.py` | 5000 | FastAPI | All AI features unified |

## Endpoint Mapping

### Auth (was `/auth/*` on port 5000)
| Old | New | Status |
|-----|-----|--------|
| `POST /auth/token` | `POST /auth/token` | Same |
| `GET /auth/verify` | `GET /auth/verify` | Same |
| `GET /auth/me` | `GET /auth/me` | Same |
| N/A | `GET /auth/api-key/verify` | New |

### ML Predictions (was `/predict/*` on port 5000)
| Old | New | Status |
|-----|-----|--------|
| `POST /predict/category` | `POST /predict/category` | Same |
| `POST /predict/cleanup` | `POST /predict/cleanup` | Same |
| `POST /predict/categories-batch` | `POST /predict/categories-batch` | Same |
| `POST /train/categorizer` | `POST /predict/train/categorizer` | Same |
| `GET /models/status` | `GET /predict/models/status` | Moved under /predict |

### Ollama Proxy (was port 8084 Flask)
| Old (Flask) | New (FastAPI) | Status |
|-------------|---------------|--------|
| `GET /health` | `GET /health` | Merged |
| `GET /models` | `GET /ollama/models` | Prefixed |
| `POST /generate` | `POST /ollama/generate` | Prefixed |
| `POST /analyze` | `POST /ollama/analyze` | Prefixed |

### ML Categorizer (was port 8001)
| Old | New | Status |
|-----|-----|--------|
| `GET /health` | `GET /categorizer/health` | Prefixed |
| `GET /model/info` | `GET /categorizer/model/info` | Same |
| `POST /categorize` | `POST /categorizer/categorize` | Same |
| `POST /categorize/batch` | `POST /categorizer/categorize/batch` | Same |
| `POST /upload/categorize` | `POST /categorizer/upload/categorize` | Same |
| `POST /train` | `POST /categorizer/train` | Same |
| `GET /categories` | `GET /categorizer/categories` | Same |
| `GET /statistics` | `GET /categorizer/statistics` | Same |

## How to Migrate

### 1. Update client code
Replace three service URLs with one:
```python
# OLD
AI_SERVICE = "http://localhost:5000"
CATEGORIZER = "http://localhost:8001"
OLLAMA_PROXY = "http://localhost:8084"

# NEW
AI_SERVICE = "http://localhost:5000"
# All endpoints now under this single URL
```

### 2. Update environment variables
See `.env.example` for the new unified configuration. Key changes:
- `PYTHON_AI_PORT` → `AI_SERVICE_PORT`
- `NODE_ENV` → no longer used for auth decisions
- New feature flags: `ENABLE_OLLAMA`, `ENABLE_ML_CATEGORIZER`

### 3. Start the service
```bash
# Old: start 3 separate processes
python ai-service/main.py              # port 5000
python ai-service/ml_categorizer/src/api.py  # port 8001
python server/python-ai-service/ai_service.py # port 8084

# New: start 1 process
python -m ai-service.app.main          # port 5000 (all features)
# Or use the batch script:
start-ai-service.bat
```

### 4. Disable old services
Remove from `start-all-services.bat`:
- Remove `cd ai-service && python main.py`
- Remove `cd ai-service/ml_categorizer/src && python api.py`
- Remove `cd server/python-ai-service && python ai_service.py`

## Security Improvements
- `SECRET_KEY` and `API_KEY` are now auto-generated if not set (no more hardcoded defaults)
- Feature flags allow disabling unused endpoints
- All auth logic centralized in `/auth/*` router

## Rollback
If you need to revert, the old service files are preserved:
- `ai-service/main.py` (original)
- `ai-service/ml_categorizer/src/api.py` (original)
- `server/python-ai-service/ai_service.py` (original)

Simply start them individually as before.
