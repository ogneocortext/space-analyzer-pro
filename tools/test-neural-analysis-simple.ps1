# Simple PowerShell script to test neural analysis
$directoryPath = "D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio"
$body = @{
    directoryPath = $directoryPath
    options = @{}
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Testing Neural Analysis against: $directoryPath"
    Write-Host "Sending request to backend server..."
    
    $response = Invoke-RestMethod -Uri "http://localhost:8091/api/analyze" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 300
    
    Write-Host "Analysis started successfully!"
    Write-Host "Analysis ID: $($response.analysisId)"
    Write-Host "Checking results..."
    
    # Wait a bit and then check results
    Start-Sleep -Seconds 10
    
    $results = Invoke-RestMethod -Uri "http://localhost:8091/api/results/$($response.analysisId)" -Method Get -TimeoutSec 60
    
    Write-Host "Analysis Results:"
    Write-Host "Total Files: $($results.totalFiles)"
    Write-Host "Total Size: $([math]::Round($results.totalSize / 1MB, 2)) MB"
    
    if ($results.categories) {
        Write-Host "Categories Found: $($results.categories.PSObject.Properties.Name.Count)"
    }
    
    # Show some sample files for neural processing
    if ($results.files) {
        $sampleFiles = $results.files | Select-Object -First 5
        Write-Host "Sample files for neural processing:"
        foreach ($file in $sampleFiles) {
            Write-Host "  - $($file.name) ($([math]::Round($file.size / 1KB, 2)) KB)"
        }
    }
    
    Write-Host "Neural analysis test completed!"
    Write-Host "Test the neural view in browser at: http://localhost:5175/"
    
} catch {
    Write-Host "Error during analysis: $($_.Exception.Message)"
    Write-Host "Make sure the backend server is running on port 8091"
}
