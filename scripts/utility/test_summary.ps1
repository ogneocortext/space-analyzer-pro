param(
    [string]$Filter = "",
    [switch]$OnlyFailures,
    [switch]$ListTests,
    [switch]$Verbose
)

$startTime = Get-Date

# Run tests and capture output
$raw = & cargo test --workspace $Filter 2>&1

$crates = @()
$currentCrate = ""
$currentTests = @()
$totalPassed = 0
$totalFailed = 0
$totalIgnored = 0
$compileErrors = @()

foreach ($line in $raw) {
    # Match: "Running unittests src\lib.rs (target\deps\<hash>.exe)" or bin/test targets
    if ($line -match 'Running .* \(target[\\/]debug[\\/]deps[\\/](\w+-\w+)\.exe\)') {
        if ($currentCrate -and $currentTests.Count -gt 0) {
            $crates += [PSCustomObject]@{
                Name   = $currentCrate
                Tests  = $currentTests
            }
        }
        $fullName = $Matches[1]
        $crateName = $fullName -replace '-[0-9a-f]{16}$', ''
        $currentCrate = $crateName
        $currentTests = @()
    }

    # Match per-test result
    if ($line -match '^test (\S+) \.\.\. (ok|FAILED|ignored)\s*$') {
        $currentTests += [PSCustomObject]@{
            Name   = $Matches[1]
            Result = $Matches[2]
        }
    }

    # Match test result summary line
    if ($line -match 'test result: (ok|FAILED)\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored') {
        $totalPassed += [int]$Matches[2]
        $totalFailed += [int]$Matches[3]
        $totalIgnored += [int]$Matches[4]
    }

    # Capture compile errors
    if ($line -match 'error\[E\d+\]|error: could not compile') {
        $compileErrors += $line.Trim()
    }
}

# Flush last crate
if ($currentCrate -and $currentTests.Count -gt 0) {
    $crates += [PSCustomObject]@{ Name = $currentCrate; Tests = $currentTests }
}

# Crates with no tests (compile-only)
foreach ($line in $raw) {
    if ($line -match 'Running .* \(target[\\/]debug[\\/]deps[\\/](\w+-\w+)\.exe\)') {
        $fullName = $Matches[1]
        $crateName = $fullName -replace '-[0-9a-f]{16}$', ''
        if ($crates.Name -notcontains $crateName) {
            $crates += [PSCustomObject]@{ Name = $crateName; Tests = @() }
        }
    }
}

$duration = (Get-Date) - $startTime

# === Output ===
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WORKSPACE TEST RESULTS" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $([math]::Round($duration.TotalSeconds,1))s" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($crate in $crates) {
    $passed = ($crate.Tests | Where-Object { $_.Result -eq 'ok' }).Count
    $failed = ($crate.Tests | Where-Object { $_.Result -eq 'FAILED' }).Count
    $skipped = ($crate.Tests | Where-Object { $_.Result -eq 'ignored' }).Count

    if ($OnlyFailures -and $failed -eq 0) { continue }
    if ($crate.Tests.Count -eq 0) {
        Write-Host "  [----] $($crate.Name.PadRight(38)) compile-only, no tests" -ForegroundColor DarkGray
        continue
    }

    $statusIcon = if ($failed -gt 0) { "[FAIL]" } else { "[ ok ]" }
    $statusColor = if ($failed -gt 0) { "Red" } else { "Green" }
    Write-Host "  $statusIcon $($crate.Name.PadRight(38)) $($passed) passed, $($failed) failed, $($skipped) skipped" -ForegroundColor $statusColor

    # Show individual tests
    $displayTests = if ($OnlyFailures) {
        $crate.Tests | Where-Object { $_.Result -ne 'ok' }
    } elseif ($ListTests -or $Verbose) {
        $crate.Tests
    } else {
        $crate.Tests | Where-Object { $_.Result -ne 'ok' }
    }

    foreach ($t in $displayTests) {
        $icon = switch ($t.Result) {
            "ok"      { "[ PASS]" }
            "FAILED"  { "[ FAIL]" }
            "ignored" { "[ SKIP]" }
        }
        $color = switch ($t.Result) {
            "ok"      { "Green" }
            "FAILED"  { "Red" }
            "ignored" { "DarkYellow" }
        }
        # Shorten test name for readability
        $shortName = $t.Name -replace '^.*?(::tests::|::)', ''
        Write-Host "         $icon  $shortName" -ForegroundColor $color
    }
    Write-Host ""
}

Write-Host "  $( '-' * 50)" -ForegroundColor DarkGray
Write-Host ""

$totalTests = $totalPassed + $totalFailed + $totalIgnored
$statusLine = "  TOTAL: $($totalPassed) passed, $($totalFailed) failed, $($totalIgnored) skipped"
$statusLine += " ($($totalTests) tests across $($crates.Count) crates)"

if ($totalFailed -gt 0 -or $compileErrors.Count -gt 0) {
    Write-Host $statusLine -ForegroundColor Red
    Write-Host ""
    Write-Host "  === COMPILE ERRORS ===" -ForegroundColor Red
    foreach ($e in $compileErrors) { Write-Host "  $e" -ForegroundColor Red }
    Write-Host ""
    exit 1
} else {
    Write-Host $statusLine -ForegroundColor Green
    Write-Host ""
    Write-Host "  All tests passed!" -ForegroundColor Green
    Write-Host ""
    exit 0
}
