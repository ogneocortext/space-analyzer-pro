#!/usr/bin/env python3
"""
Space Analyzer - GPU-Accelerated Vision Analysis Pipeline
Uses PyTorch CUDA on GTX 1070 Ti for:
1. Fast batch image preprocessing and feature extraction
2. Screenshot quality assessment (blur, brightness, contrast)
3. UI element detection via edge detection and layout analysis
4. Color palette analysis
5. Ollama-based vision model analysis (GPU-backed)

Author: Space Analyzer Team
CUDA: PyTorch 2.6.0 + cu124 on NVIDIA GeForce GTX 1070 Ti
"""

import os
import sys
import json
import time
import base64
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict

print("DEBUG: Starting imports")
# GPU-Accelerated Imports
import torch
print("DEBUG: Torch imported")
import torch.nn.functional as F
from torchvision import transforms, io
from PIL import Image
import numpy as np

print("DEBUG: Basic imports done")
# Configuration
try:
    import requests
    HAS_REQUESTS = True
    print("DEBUG: Requests imported")
except ImportError:
    HAS_REQUESTS = False
    print("DEBUG: Requests not available")

OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
GPU_NAME = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"

print(f"GPU Vision Analyzer")
print(f"   Device: {DEVICE} ({GPU_NAME})")
print(f"   PyTorch: {torch.__version__}")
if torch.cuda.is_available():
    print(f"   CUDA: {torch.version.cuda}")


@dataclass
class ImageQualityMetrics:
    brightness: float
    contrast: float
    blur_score: float
    sharpness: float
    has_text: bool
    colorfulness: float
    resolution: Tuple[int, int]
    file_size_kb: float


@dataclass
class LayoutAnalysis:
    edge_density: float
    horizontal_lines: int
    vertical_lines: int
    symmetry_score: float
    color_clusters: int
    dominant_colors: List[Tuple[int, int, int]]
    color_palette: Dict[str, float]


@dataclass
class VisionAnalysisResult:
    filename: str
    path: str
    quality: Dict
    layout: Dict
    ollama_analysis: str
    categories: List[str]
    issues: List[str]
    recommendations: List[str]
    processing_time_s: float
    gpu_memory_mb: float


class GPUImageAnalyzer:
    """GPU-accelerated image analysis pipeline."""

    def __init__(self):
        self.device = DEVICE
        self.ollama_model = "qwen3-vl:4b"

        # Sobel kernels for GPU edge detection
        self.sobel_x = torch.tensor([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
                                     dtype=torch.float32, device=self.device).view(1, 1, 3, 3)
        self.sobel_y = torch.tensor([[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
                                     dtype=torch.float32, device=self.device).view(1, 1, 3, 3)

        # Laplacian kernel for blur detection (GPU)
        self.laplacian = torch.tensor([[0, -1, 0], [-1, 4, -1], [0, -1, 0]],
                                       dtype=torch.float32, device=self.device).view(1, 1, 3, 3)

    def load_image_gpu(self, image_path: str) -> Tuple[torch.Tensor, Image.Image]:
        print(f"DEBUG: Loading image from {image_path}")
        pil_img = Image.open(image_path)
        print(f"DEBUG: PIL image mode={pil_img.mode}, size={pil_img.size}")
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
            print(f"DEBUG: Converted to RGB, mode={pil_img.mode}")
        print(f"DEBUG: Decoding image with torchvision.io")
        img_tensor = io.decode_image(image_path, mode="RGB").to(self.device)
        print(f"DEBUG: Image tensor shape={img_tensor.shape}")
        if img_tensor.dim() == 3:
            img_tensor = img_tensor.unsqueeze(0)
        print(f"DEBUG: Final tensor shape={img_tensor.shape}")
        result_tensor = img_tensor.float() / 255.0
        print(f"DEBUG: Normalized tensor range [{result_tensor.min().item():.3f}, {result_tensor.max().item():.3f}]")
        return result_tensor, pil_img

    def analyze_quality(self, pil_img: Image.Image, file_size: int) -> ImageQualityMetrics:
        gray = pil_img.convert("L")
        img_array = np.array(gray, dtype=np.float32)
        img_tensor = torch.from_numpy(img_array).to(self.device)

        brightness = float(img_tensor.mean())
        contrast = float(img_tensor.std())

        img_batch = img_tensor.unsqueeze(0).unsqueeze(0)
        lap_response = F.conv2d(img_batch, self.laplacian, padding=1)
        blur_score = float(lap_response.var())

        gx = F.conv2d(img_batch, self.sobel_x, padding=1)
        gy = F.conv2d(img_batch, self.sobel_y, padding=1)
        gradient_mag = torch.sqrt(gx**2 + gy**2)
        sharpness = float(torch.sigmoid(gradient_mag.mean() / 50.0))

        r, g, b = pil_img.split()
        rg = np.array(r, dtype=np.float32) - np.array(g, dtype=np.float32)
        yb = 0.5 * (np.array(r, dtype=np.float32) + np.array(g, dtype=np.float32)) - np.array(b, dtype=np.float32)
        colorfulness = float(np.sqrt(rg.std()**2 + yb.std()**2) + 0.3 * np.sqrt(rg.mean()**2 + yb.mean()**2))

        has_text = sharpness > 0.4 and contrast > 30

        return ImageQualityMetrics(
            brightness=round(brightness, 2),
            contrast=round(contrast, 2),
            blur_score=round(blur_score, 2),
            sharpness=round(sharpness, 4),
            has_text=has_text,
            colorfulness=round(colorfulness, 2),
            resolution=pil_img.size,
            file_size_kb=round(file_size / 1024, 1)
        )

    def analyze_layout(self, pil_img: Image.Image) -> LayoutAnalysis:
        gray = np.array(pil_img.convert("L"), dtype=np.float32)
        img_tensor = torch.from_numpy(gray).to(self.device).unsqueeze(0).unsqueeze(0)

        gx = F.conv2d(img_tensor, self.sobel_x, padding=1)
        gy = F.conv2d(img_tensor, self.sobel_y, padding=1)
        edge_density = float((torch.sqrt(gx**2 + gy**2) > 50).float().mean())
        h_edges = (torch.abs(gy) > 50).float().mean().item()
        v_edges = (torch.abs(gx) > 50).float().mean().item()

        h, w = img_tensor.shape[2:]
        left_half = img_tensor[:, :, :, :w//2]
        right_half = img_tensor[:, :, :, w//2:].flip(-1)
        min_w = min(left_half.shape[-1], right_half.shape[-1])
        symmetry_score = float(1.0 - F.mse_loss(left_half[:, :, :, :min_w], right_half[:, :, :, :min_w]))

        # Color clustering
        from sklearn.cluster import MiniBatchKMeans
        img_array = np.array(pil_img.resize((64, 64)))
        pixels = img_array.reshape(-1, 3)
        kmeans = MiniBatchKMeans(n_clusters=min(8, len(pixels)), random_state=42, batch_size=256)
        labels = kmeans.fit_predict(pixels)
        color_clusters = int(len(np.unique(labels)))

        unique_labels, counts = np.unique(labels, return_counts=True)
        top_indices = np.argsort(counts)[-5:][::-1]
        dominant_colors = []
        for idx in top_indices:
            color = kmeans.cluster_centers_[idx].astype(int)
            dominant_colors.append((int(color[0]), int(color[1]), int(color[2])))

        palette = {}
        for color, weight in zip(dominant_colors, counts[top_indices]):
            r, g, b = color
            if r > 200 and g > 200 and b > 200:
                cat = "white/light"
            elif r < 60 and g < 60 and b < 60:
                cat = "dark/black"
            elif r > 200 and g < 100 and b < 100:
                cat = "red"
            elif r < 100 and g > 150 and b < 100:
                cat = "green"
            elif r < 100 and g < 100 and b > 150:
                cat = "blue"
            elif r > 150 and g > 150 and b < 100:
                cat = "yellow"
            elif r > 150 and g < 100 and b > 150:
                cat = "magenta"
            else:
                cat = "mid-tone/gray"
            palette[cat] = round(float(weight / counts.sum()) * 100, 1)

        return LayoutAnalysis(
            edge_density=round(edge_density, 4),
            horizontal_lines=int(h_edges * 100),
            vertical_lines=int(v_edges * 100),
            symmetry_score=round(symmetry_score, 4),
            color_clusters=color_clusters,
            dominant_colors=dominant_colors,
            color_palette=palette
        )

    def analyze_via_ollama(self, image_path: str, category: str) -> str:
        print(f"DEBUG: Starting Ollama analysis for {image_path} with category {category}")
        if not HAS_REQUESTS:
            return "Ollama analysis unavailable (requests not installed)"

        try:
            with open(image_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")

            prompts = {
                "dashboard": """Analyze this Space Analyzer dashboard screenshot. Focus on:
1. Data visualization quality (charts, graphs, metrics)
2. Layout and information density
3. Color usage and readability
4. Any UI issues or inconsistencies
5. Overall UX assessment""",
                "files": """Analyze this Files/Scanner page screenshot. Focus on:
1. File listing clarity and organization
2. Table/column layout quality
3. Filter/search UI elements
4. Scan progress indicators
5. Data density vs readability balance""",
                "charts": """Analyze this Charts/Analytics screenshot. Focus on:
1. Chart rendering quality and accuracy
2. Label readability and axis scaling
3. Color scheme effectiveness
4. Interactive elements visibility
5. Data insight clarity""",
                "history": """Analyze this History/Timeline screenshot. Focus on:
1. Timeline visualization quality
2. Event listing clarity
3. Date/time navigation elements
4. Progress indicators
5. Information density management""",
                "settings": """Analyze this Settings page screenshot. Focus on:
1. Form layout and organization
2. Input field clarity
3. Section grouping and hierarchy
4. Button and action visibility
5. Overall settings UX quality""",
                "about": """Analyze this About page screenshot. Focus on:
1. Information layout and hierarchy
2. Branding and version display
3. Link and action visibility
4. Overall polish and professionalism"""
            }

            prompt = prompts.get(category, """Analyze this Space Analyzer application screenshot. Focus on:
1. Overall UI quality and consistency
2. Layout organization
3. Readability and accessibility
4. Any visual issues or bugs
5. Specific UX recommendations""")

            print(f"DEBUG: Ollama prompt length: {len(prompt)}")
            payload = {
                "model": self.ollama_model,
                "prompt": prompt,
                "images": [img_b64],
                "options": {"temperature": 0.1, "top_p": 0.9, "num_predict": 768},
                "stream": False
            }

            print(f"DEBUG: Sending request to Ollama at {OLLAMA_BASE_URL}/api/generate")
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
                timeout=300  # Increased timeout to 5 minutes
            )

            print(f"DEBUG: Ollama response status code: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                text = result.get("response", "")
                thinking = result.get("thinking", "")
                if text:
                    print(f"DEBUG: Ollama response text length: {len(text)}")
                    return text
                if thinking:
                    print(f"DEBUG: Ollama thinking length: {len(thinking)}")
                    return f"[Model reasoning]: {thinking[:500]}"
                return "No analysis generated (empty response)"
            else:
                print(f"DEBUG: Ollama error: {response.status_code} - {response.text[:200]}")
                return f"Error: {response.status_code} - {response.text[:200]}"

        except requests.exceptions.ConnectionError:
            print("DEBUG: Ollama server not available (connection error)")
            return "Ollama server not available (is it running?)"
        except Exception as e:
            print(f"DEBUG: Ollama analysis error: {str(e)}")
            return f"Analysis error: {str(e)[:200]}"

    def analyze_screenshot(self, image_path: str, category: str = "general") -> VisionAnalysisResult:
        print(f"DEBUG: Starting analysis of {image_path}")
        start_time = time.time()
        gpu_mem_before = torch.cuda.memory_allocated() if torch.cuda.is_available() else 0

        _, pil_img = self.load_image_gpu(image_path)
        file_size = os.path.getsize(image_path)

        quality = self.analyze_quality(pil_img, file_size)
        layout = self.analyze_layout(pil_img)
        ollama_result = self.analyze_via_ollama(image_path, category)

        issues = []
        recommendations = []

        if quality.blur_score < 100:
            issues.append("Screenshot appears blurry or low resolution")
            recommendations.append("Ensure full-resolution capture (disable scaling)")
        if quality.brightness < 50:
            issues.append("Dark image - may be hard to read")
            recommendations.append("Check dark mode contrast ratios")
        if quality.contrast < 30:
            issues.append("Low contrast - readability concern")
            recommendations.append("Improve text/background contrast")
        if layout.edge_density < 0.05:
            issues.append("Minimal visual structure detected")
            recommendations.append("Consider adding visual separators")
        if layout.symmetry_score > 0.9:
            issues.append("Perfectly symmetrical - check for rendering issues")
            recommendations.append("Verify dynamic content display")
        if quality.colorfulness < 20:
            issues.append("Desaturated - may need more visual variety")
            recommendations.append("Add accent colors for data visualization")

        gpu_mem_after = torch.cuda.memory_allocated() if torch.cuda.is_available() else 0

        return VisionAnalysisResult(
            filename=os.path.basename(image_path),
            path=image_path,
            quality=asdict(quality),
            layout=asdict(layout),
            ollama_analysis=ollama_result,
            categories=[category],
            issues=issues,
            recommendations=recommendations,
            processing_time_s=round(time.time() - start_time, 2),
            gpu_memory_mb=round((gpu_mem_after - gpu_mem_before) / 1024**2, 2) if torch.cuda.is_available() else 0
        )


def analyze_screenshots_batch(screenshot_dir: str, output_dir: str = None):
    analyzer = GPUImageAnalyzer()
    screenshot_path = Path(screenshot_dir)
    if not screenshot_path.exists():
        print(f"Directory not found: {screenshot_dir}")
        return

    category_map = {
        "dashboard": lambda n: "dashboard" in n or "launched" in n,
        "files": lambda n: any(x in n for x in ["file", "summary", "types", "audit", "organization", "cleanup"]),
        "charts": lambda n: "charts" in n or "chart" in n,
        "history": lambda n: "history" in n,
        "settings": lambda n: "settings" in n,
        "about": lambda n: "about" in n,
    }

    screenshots = sorted(screenshot_path.glob("*.png"))
    if not screenshots:
        screenshots = sorted(screenshot_path.glob("*.jpg")) + sorted(screenshot_path.glob("*.jpeg"))

    print(f"\nFound {len(screenshots)} screenshots to analyze")
    if torch.cuda.is_available():
        prop = torch.cuda.get_device_properties(0)
        print(f"GPU: {GPU_NAME} ({prop.total_memory / 1024**3:.1f} GB VRAM)\n")
    else:
        print(f"Running on CPU\n")

    results = {}
    total_time = 0.0

    for i, img_path in enumerate(screenshots, 1):
        fname = img_path.stem.lower()
        category = "general"
        for cat, matcher in category_map.items():
            if matcher(fname):
                category = cat
                break

        print(f"  [{i}/{len(screenshots)}] {img_path.name} ({category})...", end=" ", flush=True)
        result = analyzer.analyze_screenshot(str(img_path), category)
        total_time += result.processing_time_s

        if category not in results:
            results[category] = []
        results[category].append(asdict(result))
        print(f"done ({result.processing_time_s:.1f}s)")

    output = {
        "model": f"gpu-accelerated (PyTorch {torch.__version__} + cu124)",
        "gpu": GPU_NAME,
        "timestamp": datetime.now().isoformat(),
        "total_time_s": round(total_time, 2),
        "screenshots_analyzed": len(screenshots),
        "categories": results,
        "summary": _generate_summary(results)
    }

    if output_dir:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        out_file = out_path / f"gpu_vision_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(out_file, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nAnalysis saved to: {out_file}")

    print(f"\nBatch analysis complete in {output['total_time_s']:.1f}s")
    return output


def _generate_summary(results: Dict) -> str:
    lines = []
    total_issues = 0
    total_recs = 0
    for category, items in results.items():
        for item in items:
            total_issues += len(item["issues"])
            total_recs += len(item["recommendations"])

    lines.append(f"Screenshots analyzed: {sum(len(v) for v in results.values())}")
    lines.append(f"Categories found: {', '.join(results.keys())}")
    lines.append(f"Total issues detected: {total_issues}")
    lines.append(f"Total recommendations: {total_recs}")
    lines.append("\nPer-Category Quality:")
    for category, items in results.items():
        avg_sharpness = np.mean([i["quality"]["sharpness"] for i in items])
        avg_contrast = np.mean([i["quality"]["contrast"] for i in items])
        avg_colorfulness = np.mean([i["quality"]["colorfulness"] for i in items])
        lines.append(f"  {category}: sharpness={avg_sharpness:.3f}, contrast={avg_contrast:.1f}, colorfulness={avg_colorfulness:.1f}")
    return "\n".join(lines)


def run_benchmark():
    print("\n" + "=" * 60)
    print("GPU VISION BENCHMARK")
    print("=" * 60)

    test_img = Image.new("RGB", (1920, 1080), color=(73, 109, 137))
    test_img.save("_benchmark_test.png")
    analyzer = GPUImageAnalyzer()
    _ = analyzer.analyze_screenshot("_benchmark_test.png", "general")

    times = []
    for _ in range(5):
        start = time.time()
        _ = analyzer.analyze_screenshot("_benchmark_test.png", "general")
        times.append(time.time() - start)

    os.remove("_benchmark_test.png")
    print(f"\nResults (avg of 5 runs on 1920x1080 image):")
    print(f"   Mean time: {np.mean(times):.3f}s")
    print(f"   Min time:  {np.min(times):.3f}s")
    print(f"   Max time:  {np.max(times):.3f}s")
    if torch.cuda.is_available():
        print(f"   GPU Memory: {torch.cuda.max_memory_allocated() / 1024**3:.2f} GB peak")
    return times


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GPU-Accelerated Vision Analysis")
    parser.add_argument("screenshots", nargs="?", help="Path to screenshots directory")
    parser.add_argument("--output", "-o", default="macro_logs", help="Output directory")
    parser.add_argument("--benchmark", "-b", action="store_true", help="Run GPU benchmark")
    parser.add_argument("--single", "-s", help="Analyze a single screenshot")
    parser.add_argument("--category", "-c", default="general", help="Category for single analysis")

    args = parser.parse_args()

    if args.benchmark:
        run_benchmark()
    elif args.single:
        analyzer = GPUImageAnalyzer()
        result = analyzer.analyze_screenshot(args.single, args.category)
        print(json.dumps(asdict(result), indent=2))
    elif args.screenshots:
        analyze_screenshots_batch(args.screenshots, args.output)
    else:
        log_dirs = sorted(Path("macro_logs").glob("screenshots_*"))
        if log_dirs:
            latest = str(log_dirs[-1])
            print(f"No directory specified, using latest: {latest}")
            analyze_screenshots_batch(latest, "macro_logs")
        else:
            parser.print_help()