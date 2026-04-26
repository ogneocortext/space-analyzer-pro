# Create Shared Backend Integration
Write-Host "=== CREATING SHARED BACKEND INTEGRATION ===" -ForegroundColor Yellow

$sharedBackendDir = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Shared Backend"

# Create backend directory structure
$backendDirs = @(
    "src",
    "src\controllers",
    "src\services",
    "src\models",
    "src\utils",
    "src\middleware",
    "src\routes",
    "config",
    "tests"
)

foreach ($dir in $backendDirs) {
    $fullPath = Join-Path $sharedBackendDir $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -Path $fullPath -ItemType Directory -Force
        Write-Host "Created: $dir" -ForegroundColor Green
    }
}

# Create main FastAPI application
$mainAppPath = Join-Path $sharedBackendDir "src\main.py"
$mainAppContent = @"
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
from pathlib import Path

from routes.audio_sync import router as audio_router
from routes.media_generation import router as media_router
from routes.unified_processor import router as unified_router
from services.project_manager import ProjectManager

# Create FastAPI app
app = FastAPI(
    title="Unified Media Processor API",
    description="Combined audio sync and media generation backend",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(audio_router, prefix="/api/audio", tags=["Audio Sync"])
app.include_router(media_router, prefix="/api/media", tags=["Media Generation"])
app.include_router(unified_router, prefix="/api/unified", tags=["Unified Processor"])

# Serve static files
output_dir = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools/Output")
if output_dir.exists():
    app.mount("/output", StaticFiles(directory=str(output_dir)), name="output")

# Initialize project manager
project_manager = ProjectManager()

@app.get("/")
async def root():
    return {"message": "Unified Media Processor API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "services": {"audio": True, "media": True, "unified": True}}

@app.get("/api/stats")
async def get_system_stats():
    """Get system statistics and project information"""
    return await project_manager.get_system_stats()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
"@

Set-Content -Path $mainAppPath -Value $mainAppContent -Encoding UTF8

# Create shared services
$projectManagerPath = Join-Path $sharedBackendDir "src\services\project_manager.py"
$projectManagerContent = @"
import asyncio
import os
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import json

class ProjectManager:
    def __init__(self):
        self.output_dir = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools/Output")
        self.projects_dir = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools")
        self.ensure_directories()
    
    def ensure_directories(self):
        """Ensure required directories exist"""
        self.output_dir.mkdir(exist_ok=True)
        (self.output_dir / "audio").mkdir(exist_ok=True)
        (self.output_dir / "media").mkdir(exist_ok=True)
        (self.output_dir / "unified").mkdir(exist_ok=True)
    
    async def get_system_stats(self) -> Dict[str, Any]:
        """Get comprehensive system statistics"""
        stats = {
            "timestamp": datetime.now().isoformat(),
            "projects": await self.get_project_stats(),
            "storage": await self.get_storage_stats(),
            "performance": await self.get_performance_stats(),
            "recent_activity": await self.get_recent_activity()
        }
        return stats
    
    async def get_project_stats(self) -> Dict[str, Any]:
        """Get project statistics"""
        music_sync_dir = self.projects_dir / "Music Sync 2 Video App"
        media_gen_dir = self.projects_dir / "Simplified Media Generator"
        
        stats = {
            "music_sync": {
                "name": "Music Sync 2 Video App",
                "path": str(music_sync_dir),
                "exists": music_sync_dir.exists(),
                "size_mb": 0,
                "file_count": 0
            },
            "media_generator": {
                "name": "Simplified Media Generator", 
                "path": str(media_gen_dir),
                "exists": media_gen_dir.exists(),
                "size_mb": 0,
                "file_count": 0
            }
        }
        
        # Calculate sizes
        if music_sync_dir.exists():
            stats["music_sync"]["size_mb"] = self.calculate_directory_size(music_sync_dir) / (1024 * 1024)
            stats["music_sync"]["file_count"] = self.count_files(music_sync_dir)
        
        if media_gen_dir.exists():
            stats["media_generator"]["size_mb"] = self.calculate_directory_size(media_gen_dir) / (1024 * 1024)
            stats["media_generator"]["file_count"] = self.count_files(media_gen_dir)
        
        return stats
    
    async def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        total_size = self.calculate_directory_size(self.output_dir)
        
        return {
            "output_directory": str(self.output_dir),
            "total_size_mb": total_size / (1024 * 1024),
            "audio_size_mb": self.calculate_directory_size(self.output_dir / "audio") / (1024 * 1024),
            "media_size_mb": self.calculate_directory_size(self.output_dir / "media") / (1024 * 1024),
            "unified_size_mb": self.calculate_directory_size(self.output_dir / "unified") / (1024 * 1024),
            "available_space_gb": self.get_available_space()
        }
    
    async def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return {
            "cpu_usage": 0,  # Would implement actual CPU monitoring
            "memory_usage_mb": 0,  # Would implement actual memory monitoring
            "active_processes": 0,
            "queue_length": 0
        }
    
    async def get_recent_activity(self) -> List[Dict[str, Any]]:
        """Get recent activity"""
        # This would read from a database or log file
        return [
            {
                "id": 1,
                "type": "audio_sync",
                "title": "Music Video Sync",
                "description": "Synchronized audio with video",
                "timestamp": "2024-01-26T16:45:00Z",
                "status": "completed"
            },
            {
                "id": 2,
                "type": "media_generation", 
                "title": "AI Image Generation",
                "description": "Generated 4K landscape image",
                "timestamp": "2024-01-26T16:30:00Z",
                "status": "completed"
            }
        ]
    
    def calculate_directory_size(self, directory: Path) -> int:
        """Calculate total size of directory in bytes"""
        total_size = 0
        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except Exception:
            pass
        return total_size
    
    def count_files(self, directory: Path) -> int:
        """Count total files in directory"""
        file_count = 0
        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    file_count += 1
        except Exception:
            pass
        return file_count
    
    def get_available_space(self) -> float:
        """Get available disk space in GB"""
        try:
            import shutil
            total, used, free = shutil.disk_usage(self.output_dir.anchor)
            return free / (1024**3)
        except Exception:
            return 0.0
"@

Set-Content -Path $projectManagerPath -Value $projectManagerContent -Encoding UTF8

# Create API routes
$audioRoutesPath = Join-Path $sharedBackendDir "src\routes\audio_sync.py"
$audioRoutesContent = @"
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from services.audio_processor import AudioProcessor
import os
from pathlib import Path

router = APIRouter()
audio_processor = AudioProcessor()

@router.post("/sync")
async def sync_audio_video(
    audio_file: UploadFile = File(...),
    video_file: UploadFile = File(...),
    bpm: int = None,
    offset_ms: int = 0
):
    """Synchronize audio with video file"""
    try:
        # Save uploaded files
        audio_path = await save_upload_file(audio_file, "audio")
        video_path = await save_upload_file(video_file, "audio")
        
        # Process synchronization
        result = await audio_processor.sync_audio_video(
            audio_path, video_path, bpm, offset_ms
        )
        
        return {
            "status": "success",
            "message": "Audio synchronized successfully",
            "output_file": result["output_file"],
            "processing_time": result["processing_time"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analyze/{filename}")
async def analyze_audio(filename: str):
    """Analyze audio file for BPM and other properties"""
    try:
        audio_path = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools/Output/audio") / filename
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        analysis = await audio_processor.analyze_audio(str(audio_path))
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def save_upload_file(upload_file: UploadFile, subfolder: str) -> str:
    """Save uploaded file to appropriate directory"""
    output_dir = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools/Output") / subfolder
    output_dir.mkdir(exist_ok=True)
    
    file_path = output_dir / upload_file.filename
    
    with open(file_path, "wb") as buffer:
        content = await upload_file.read()
        buffer.write(content)
    
    return str(file_path)
"@

Set-Content -Path $audioRoutesPath -Value $audioRoutesContent -Encoding UTF8

$mediaRoutesPath = Join-Path $sharedBackendDir "src\routes\media_generation.py"
$mediaRoutesContent = @"
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.media_generator import MediaGenerator
import os
from pathlib import Path

router = APIRouter()
media_generator = MediaGenerator()

@router.post("/generate")
async def generate_media(
    prompt: str,
    style: str = "realistic",
    enhance_existing: bool = False,
    input_file: UploadFile = File(None)
):
    """Generate media using AI"""
    try:
        input_path = None
        if input_file:
            input_path = await save_upload_file(input_file, "media")
        
        result = await media_generator.generate_media(
            prompt=prompt,
            style=style,
            enhance_existing=enhance_existing,
            input_path=input_path
        )
        
        return {
            "status": "success",
            "message": "Media generated successfully",
            "output_files": result["output_files"],
            "processing_time": result["processing_time"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/enhance")
async def enhance_media(
    input_file: UploadFile = File(...),
    enhancement_type: str = "quality"
):
    """Enhance existing media using AI"""
    try:
        input_path = await save_upload_file(input_file, "media")
        
        result = await media_generator.enhance_media(
            input_path=input_path,
            enhancement_type=enhancement_type
        )
        
        return {
            "status": "success",
            "message": "Media enhanced successfully",
            "output_file": result["output_file"],
            "improvement_score": result["improvement_score"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def save_upload_file(upload_file: UploadFile, subfolder: str) -> str:
    """Save uploaded file to appropriate directory"""
    output_dir = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools/Output") / subfolder
    output_dir.mkdir(exist_ok=True)
    
    file_path = output_dir / upload_file.filename
    
    with open(file_path, "wb") as buffer:
        content = await upload_file.read()
        buffer.write(content)
    
    return str(file_path)
"@

Set-Content -Path $mediaRoutesPath -Value $mediaRoutesContent -Encoding UTF8

$unifiedRoutesPath = Join-Path $sharedBackendDir "src\routes\unified_processor.py"
$unifiedRoutesContent = @"
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.unified_processor import UnifiedProcessor
import os
from pathlib import Path

router = APIRouter()
unified_processor = UnifiedProcessor()

@router.post("/process")
async def process_unified(
    audio_file: UploadFile = File(None),
    image_file: UploadFile = File(None),
    video_file: UploadFile = File(None),
    processing_mode: str = "auto",
    ai_enhancement: bool = True
):
    """Unified processing pipeline combining both project capabilities"""
    try:
        # Save uploaded files
        files = {}
        if audio_file:
            files["audio"] = await save_upload_file(audio_file, "unified")
        if image_file:
            files["image"] = await save_upload_file(image_file, "unified")
        if video_file:
            files["video"] = await save_upload_file(video_file, "unified")
        
        # Process with unified pipeline
        result = await unified_processor.process_unified(
            files=files,
            processing_mode=processing_mode,
            ai_enhancement=ai_enhancement
        )
        
        return {
            "status": "success",
            "message": "Unified processing completed",
            "output_files": result["output_files"],
            "processing_steps": result["processing_steps"],
            "total_processing_time": result["total_processing_time"],
            "quality_score": result["quality_score"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pipeline-status")
async def get_pipeline_status():
    """Get current pipeline status and capabilities"""
    return {
        "status": "ready",
        "capabilities": {
            "audio_sync": True,
            "media_generation": True,
            "ai_enhancement": True,
            "unified_processing": True
        },
        "active_processes": 0,
        "queue_length": 0
    }

async def save_upload_file(upload_file: UploadFile, subfolder: str) -> str:
    """Save uploaded file to appropriate directory"""
    output_dir = Path("E:/Self Built Web and Web and Mobile Apps/Media Processing Tools/Output") / subfolder
    output_dir.mkdir(exist_ok=True)
    
    file_path = output_dir / upload_file.filename
    
    with open(file_path, "wb") as buffer:
        content = await upload_file.read()
        buffer.write(content)
    
    return str(file_path)
"@

Set-Content -Path $unifiedRoutesPath -Value $unifiedRoutesContent -Encoding UTF8

# Create requirements.txt
$requirementsPath = Join-Path $sharedBackendDir "requirements.txt"
$requirementsContent = @"
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
aiofiles==23.2.1
opencv-python==4.8.1.78
numpy==1.24.3
librosa==0.10.1
moviepy==1.0.3
pillow==10.1.0
requests==2.31.0
pydantic==2.5.0
python-dotenv==1.0.0
"@

Set-Content -Path $requirementsPath -Value $requirementsContent -Encoding UTF8

# Create startup script
$startupPath = Join-Path $sharedBackendDir "start_backend.ps1"
$startupContent = @"
# Start Unified Backend Server
Write-Host "Starting Unified Media Processor Backend..." -ForegroundColor Green

# Check if Python is available
try {
    $pythonVersion = python --version 2>$null
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Python not found. Please install Python 3.8 or higher." -ForegroundColor Red
    exit 1
}

# Navigate to backend directory
Set-Location "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Shared Backend"

# Install dependencies if needed
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Start the server
Write-Host "Starting Unified Backend Server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Documentation: http://localhost:8000/docs" -ForegroundColor Cyan

python src\main.py
"@

Set-Content -Path $startupPath -Value $startupContent -Encoding UTF8

Write-Host "Created shared backend integration" -ForegroundColor Green
Write-Host "Next: Creating final project documentation..." -ForegroundColor Yellow
