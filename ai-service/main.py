#!/usr/bin/env python3
"""
Space Analyzer AI Service
FastAPI-based ML service for file analysis, categorization, and cleanup predictions.
"""

import os
import json
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Space Analyzer AI Service",
    description="ML-powered file analysis and cleanup predictions",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
PORT = int(os.getenv("PYTHON_AI_PORT", 5000))
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Security Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Security
security = HTTPBearer()

# API Key for simple authentication (fallback)
API_KEY = os.getenv("API_KEY", "space-analyzer-ai-key-2024")


# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str

class UserInDB(User):
    hashed_password: str

class FileData(BaseModel):
    path: str
    name: str
    size: int
    extension: str
    modified_time: float
    category: Optional[str] = None


class DirectoryAnalysis(BaseModel):
    files: List[FileData]
    path: str


# Authentication Helper Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return username."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    # For demo purposes, accept any non-empty username
    # In production, verify against user database
    if not token_data.username:
        raise credentials_exception

    return token_data.username

def verify_api_key(api_key: str) -> bool:
    """Verify simple API key (fallback authentication)."""
    return api_key == API_KEY

async def get_current_user(token: str = Depends(verify_token)) -> User:
    """Get current authenticated user."""
    user = User(username=token)
    return user


class CleanupRecommendation(BaseModel):
    file_path: str
    confidence: float
    action: str  # 'delete', 'archive', 'review'
    reason: str


class FileCategorization(BaseModel):
    path: str
    predicted_category: str
    confidence: float
    alternatives: List[Dict[str, Any]]


class MLModelStatus(BaseModel):
    model_name: str
    trained: bool
    accuracy: Optional[float]
    last_trained: Optional[str]
    sample_count: int


# In-memory model cache (loaded from disk)
_models = {}
_label_encoders = {}


def get_model_path(model_name: str) -> Path:
    """Get path to saved model file."""
    return MODELS_DIR / f"{model_name}.pkl"


def get_encoder_path(model_name: str) -> Path:
    """Get path to saved label encoder."""
    return MODELS_DIR / f"{model_name}_encoder.pkl"


def save_model(model_name: str, model, encoder=None):
    """Save trained model to disk."""
    model_path = get_model_path(model_name)
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)

    if encoder:
        encoder_path = get_encoder_path(model_name)
        with open(encoder_path, 'wb') as f:
            pickle.dump(encoder, f)

    print(f"💾 Model saved: {model_path}")


def load_model(model_name: str):
    """Load model from disk if exists."""
    global _models, _label_encoders

    if model_name in _models:
        return _models[model_name], _label_encoders.get(model_name)

    model_path = get_model_path(model_name)
    encoder_path = get_encoder_path(model_name)

    if not model_path.exists():
        return None, None

    with open(model_path, 'rb') as f:
        _models[model_name] = pickle.load(f)

    if encoder_path.exists():
        with open(encoder_path, 'rb') as f:
            _label_encoders[model_name] = pickle.load(f)

    print(f"📂 Model loaded: {model_path}")
    return _models[model_name], _label_encoders.get(model_name)


def extract_features(file_data: FileData) -> np.ndarray:
    """Extract numerical features from file data for ML."""
    features = [
        file_data.size,
        len(file_data.name),
        hash(file_data.extension) % 1000,  # Simple encoding
        datetime.now().timestamp() - file_data.modified_time,
        file_data.name.count('.'),  # Number of dots
        len(file_data.extension),
    ]
    return np.array(features).reshape(1, -1)


# Authentication Endpoints
@app.post("/auth/token", response_model=Token)
async def login_for_access_token(username: str = "space-analyzer", password: str = "demo"):
    """
    Get access token for API authentication.
    For demo purposes, accepts any username/password.
    In production, verify against user database.
    """
    # Demo: accept any credentials
    # In production: verify_user(username, password)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@app.post("/auth/verify")
async def verify_authentication(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify authentication token."""
    try:
        username = verify_token(credentials)
        return {"valid": True, "username": username}
    except HTTPException:
        return {"valid": False, "error": "Invalid token"}

@app.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user

# Health check (public)
@app.get("/")
async def root():
    return {
        "service": "Space Analyzer AI",
        "version": "1.0.0",
        "status": "running",
        "models_available": ["file_categorizer", "cleanup_predictor"],
        "auth_required": True
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# Model management endpoints (authenticated)
@app.get("/models/status", response_model=List[MLModelStatus])
async def get_models_status(current_user: User = Depends(get_current_user)):
    """Get status of all ML models."""
    models = ["file_categorizer", "cleanup_predictor"]
    statuses = []

    for model_name in models:
        model, _ = load_model(model_name)
        model_path = get_model_path(model_name)

        status = MLModelStatus(
            model_name=model_name,
            trained=model is not None,
            accuracy=None,  # Would need validation data
            last_trained=datetime.fromtimestamp(
                model_path.stat().st_mtime
            ).isoformat() if model_path.exists() else None,
            sample_count=0  # Would track from training data
        )
        statuses.append(status)

    return statuses


# File categorization endpoint (authenticated)
@app.post("/predict/category", response_model=FileCategorization)
async def predict_category(file_data: FileData, current_user: User = Depends(get_current_user)):
    """
    Predict the category of a file based on its metadata.
    Uses trained ML model or falls back to rule-based categorization.
    """
    model, encoder = load_model("file_categorizer")

    # Rule-based fallback if model not trained
    if model is None:
        category = categorize_by_rules(file_data)
        return FileCategorization(
            path=file_data.path,
            predicted_category=category,
            confidence=0.5,
            alternatives=[
                {"category": category, "confidence": 0.5},
                {"category": "unknown", "confidence": 0.5}
            ]
        )

    # ML prediction
    features = extract_features(file_data)
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]

    # Decode label
    if encoder:
        predicted_category = encoder.inverse_transform([prediction])[0]
    else:
        predicted_category = str(prediction)

    # Get top 3 alternatives
    top_indices = np.argsort(probabilities)[-3:][::-1]
    alternatives = []
    for idx in top_indices:
        cat = encoder.inverse_transform([idx])[0] if encoder else str(idx)
        alternatives.append({
            "category": cat,
            "confidence": float(probabilities[idx])
        })

    return FileCategorization(
        path=file_data.path,
        predicted_category=predicted_category,
        confidence=float(max(probabilities)),
        alternatives=alternatives
    )


def categorize_by_rules(file_data: FileData) -> str:
    """Rule-based categorization when ML model unavailable."""
    ext = file_data.extension.lower()

    # Document types
    if ext in ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt']:
        return 'documents'
    # Images
    elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp']:
        return 'images'
    # Videos
    elif ext in ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv']:
        return 'videos'
    # Audio
    elif ext in ['.mp3', '.wav', '.flac', '.aac', '.ogg']:
        return 'audio'
    # Archives
    elif ext in ['.zip', '.rar', '.7z', '.tar', '.gz']:
        return 'archives'
    # Code
    elif ext in ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.rs', '.go']:
        return 'code'
    # Data
    elif ext in ['.json', '.xml', '.csv', '.xlsx', '.db', '.sql']:
        return 'data'
    # Executables
    elif ext in ['.exe', '.msi', '.dmg', '.app', '.deb', '.rpm']:
        return 'executables'
    else:
        return 'other'


# Cleanup prediction endpoint (authenticated)
@app.post("/predict/cleanup", response_model=List[CleanupRecommendation])
async def predict_cleanup(analysis: DirectoryAnalysis, current_user: User = Depends(get_current_user)):
    """
    Predict which files should be cleaned up based on directory analysis.
    Returns recommendations with confidence scores.
    """
    recommendations = []

    # Check for large old files
    for file_data in analysis.largest_files:
        file_age_days = (datetime.now().timestamp() - file_data.modified_time) / 86400

        # Large old files are candidates for archival
        if file_age_days > 365 and file_data.size > 100 * 1024 * 1024:  # > 100MB, > 1 year
            recommendations.append(CleanupRecommendation(
                file_path=file_data.path,
                confidence=min(0.9, file_age_days / 730),  # Confidence increases with age
                action='archive',
                reason=f"Large file ({file_data.size / 1024 / 1024:.1f} MB) not modified in {file_age_days:.0f} days"
            ))
        # Old temp files
        elif 'temp' in file_data.name.lower() or 'tmp' in file_data.name.lower():
            if file_age_days > 30:
                recommendations.append(CleanupRecommendation(
                    file_path=file_data.path,
                    confidence=0.85,
                    action='delete',
                    reason=f"Temporary file older than 30 days"
                ))
        # Duplicate extensions (suggest review)
        elif analysis.file_types.get(file_data.extension, 0) > 100:
            recommendations.append(CleanupRecommendation(
                file_path=file_data.path,
                confidence=0.6,
                action='review',
                reason=f"Many files with {file_data.extension} extension ({analysis.file_types[file_data.extension]} found)"
            ))

    return sorted(recommendations, key=lambda x: x.confidence, reverse=True)


# Training endpoints (authenticated)
@app.post("/train/categorizer")
async def train_categorizer(files: List[FileData], background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """
    Train file categorization model on provided labeled data.
    Runs in background to avoid blocking.
    """
    background_tasks.add_task(_train_categorizer_task, files)
    return {"message": "Training started in background", "files_count": len(files)}


def _train_categorizer_task(files: List[FileData]):
    """Background task for training categorizer."""
    print(f"🚀 Training categorizer on {len(files)} files...")

    # Prepare training data
    X = []
    y = []

    for file_data in files:
        if file_data.category:
            X.append(extract_features(file_data)[0])
            y.append(file_data.category)

    if len(X) < 10:
        print("⚠️ Not enough training data (need at least 10 files)")
        return

    X = np.array(X)
    y = np.array(y)

    # Encode labels
    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)

    # Train model
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y_encoded)

    # Save model
    save_model("file_categorizer", model, encoder)
    print(f"✅ Categorizer trained on {len(X)} files, {len(encoder.classes_)} categories")


@app.post("/train/cleanup-predictor")
async def train_cleanup_predictor(
    analyses: List[DirectoryAnalysis],
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Train cleanup prediction model on historical analysis data.
    """
    background_tasks.add_task(_train_cleanup_predictor_task, analyses)
    return {"message": "Training started in background", "analyses_count": len(analyses)}


def _train_cleanup_predictor_task(analyses: List[DirectoryAnalysis]):
    """Background task for training cleanup predictor."""
    print(f"🚀 Training cleanup predictor on {len(analyses)} directory analyses...")
    # Placeholder - would implement actual training
    print("✅ Cleanup predictor training complete (mock)")


# Batch prediction (authenticated)
@app.post("/predict/categories-batch")
async def predict_categories_batch(files: List[FileData], current_user: User = Depends(get_current_user)):
    """
    Categorize multiple files in one request.
    """
    results = []
    for file_data in files:
        result = await predict_category(file_data)
        results.append(result)
    return {"predictions": results}


if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Starting AI Service on port {PORT}")
    uvicorn.run(app, host="127.0.0.1", port=PORT)
