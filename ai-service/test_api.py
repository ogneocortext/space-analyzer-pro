#!/usr/bin/env python3
"""
Test script for AI Service API endpoints
"""

import httpx
import sys

BASE_URL = "http://localhost:5000"


def test_health():
    """Test health endpoint"""
    response = httpx.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✅ Health check passed")


def test_predict_category():
    """Test file categorization"""
    payload = {
        "path": "/docs/report.pdf",
        "name": "report.pdf",
        "size": 2048000,
        "extension": ".pdf",
        "modified_time": 1704067200
    }
    response = httpx.post(f"{BASE_URL}/predict/category", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_category" in data
    assert "confidence" in data
    print(f"✅ Category prediction: {data['predicted_category']} ({data['confidence']:.2f})")


def test_models_status():
    """Test models status endpoint"""
    response = httpx.get(f"{BASE_URL}/models/status")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Models status: {len(data)} models registered")


def test_predict_cleanup():
    """Test cleanup recommendations"""
    payload = {
        "directory_path": "/downloads",
        "total_files": 1000,
        "total_size": 5000000000,
        "file_types": {".zip": 50, ".pdf": 200, ".tmp": 100},
        "age_distribution": {"<30d": 100, "30-90d": 300, "90-365d": 400, ">365d": 200},
        "largest_files": [
            {
                "path": "/downloads/old.zip",
                "name": "old.zip",
                "size": 1000000000,
                "extension": ".zip",
                "modified_time": 1609459200
            }
        ]
    }
    response = httpx.post(f"{BASE_URL}/predict/cleanup", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    print(f"✅ Cleanup predictions: {len(data)} recommendations")


def run_all_tests():
    """Run all tests"""
    print("🧪 Testing AI Service API...\n")
    
    tests = [
        test_health,
        test_predict_category,
        test_models_status,
        test_predict_cleanup,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"❌ {test.__name__} failed: {e}")
            failed += 1
    
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    
    if failed > 0:
        sys.exit(1)
    else:
        print("🎉 All tests passed!")


if __name__ == "__main__":
    run_all_tests()
