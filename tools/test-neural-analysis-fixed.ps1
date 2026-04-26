# PowerShell script to test neural analysis - Fixed port
$directoryPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"
$body = @{
    directoryPath = $directoryPath
    options = @{}
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Testing Neural Analysis against: $directoryPath"
    Write-Host "Sending request to backend server on port 8080..."
    
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/analyze" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 300
    
    Write-Host "Analysis started successfully!"
    Write-Host "Analysis ID: $($response.analysisId)"
    Write-Host "Checking results..."
    
    # Wait for analysis to complete
    Start-Sleep -Seconds 15
    
    $results = Invoke-RestMethod -Uri "http://localhost:8080/api/results/$($response.analysisId)" -Method Get -TimeoutSec 60
    
    Write-Host "Analysis Results:"
    Write-Host "Total Files: $($results.totalFiles)"
    Write-Host "Total Size: $([math]::Round($results.totalSize / 1MB, 2)) MB"
    
    if ($results.categories) {
        Write-Host "Categories Found: $($results.categories.PSObject.Properties.Name.Count)"
        Write-Host "Category breakdown:"
        foreach ($category in $results.categories.PSObject.Properties) {
            Write-Host "  - $($category.Name): $($category.Value.count) files ($([math]::Round($category.Value.size / 1MB, 2)) MB)"
        }
    }
    
    # Show some sample files for neural processing
    if ($results.files) {
        $sampleFiles = $results.files | Select-Object -First 10
        Write-Host "Sample files for neural processing:"
        foreach ($file in $sampleFiles) {
            $sizeKB = [math]::Round($file.size / 1KB, 2)
            Write-Host "  - $($file.name) ($sizeKB KB) - Category: $($file.category)"
        }
    }
    
    Write-Host ""
    Write-Host "Neural analysis test completed successfully!"
    Write-Host "Now you can:"
    Write-Host "1. Open browser: http://localhost:5175/"
    Write-Host "2. Navigate to the Neural View tab"
    Write-Host "3. See the neural network visualization of this directory"
    
} catch {
    Write-Host "Error during analysis: $($_.Exception.Message)"
    Write-Host "Make sure the backend server is running on port 8080"
}
