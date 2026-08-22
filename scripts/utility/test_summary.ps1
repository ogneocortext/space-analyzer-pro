param(
    [string]$Filter = "",
    [switch]$OnlyFailures,
    [switch]$ListTests
)

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
        # Strip the hash suffix for readability: "file_deduplicator" from "file_deduplicator-8217ca918aef82bc"
        $fullName = $Matches[1]
        $crateName = $fullName -replace '-[0-9a-f]{16}$', ''
        $currentCrate = $crateName
        $currentTests = @()
    }

    # Match per-test result: "test <full::path> ... ok" or "... FAILED" or "... ignored"
    if ($line -match '^test (\S+) \.\.\. (ok|FAILED|ignored)\s*$') {
        $currentTests += [PSCustomObject]@{
            Name   = $Matches[1]
            Result = $Matches[2]
        }
    }

    if ($line -match 'test result: (ok|FAILED)\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored') {
        $totalPassed += [int]$Matches[2]
        $totalFailed += [int]$Matches[3]
        $totalIgnored += [int]$Matches[4]
    }

    if ($line -match 'error\[E\d+\]|error: could not compile') {
        $compileErrors += $line.Trim()
    }
}

# Flush last crate
if ($currentCrate -and $currentTests.Count -gt 0) {
    $crates += [PSCustomObject]@{ Name = $currentCrate; Tests = $currentTests }
}

# Crates with no tests (compile-only\.exe) — show them as 0 so the user sees everything was exercised
foreach ($line in $raw) {
    if ($line -match 'Running .* \(target[\\/]debug[\\/]deps[\\/](\w+-\w+)\.exe\)') {
        $fullName = $Matches[1]
        $crateName = $fullName -replace '-[0-9a-f]{16}$', ''
        if ($crates.Name -notcontains $crateName) {
            $crates += [PSCustomObject]@{ Name = $crateName; Tests = @() }
        }
    }
}

Write-Host ""
Write-Host "=== Workspace Test Results ==="
Write-Host ""

foreach ($crate in $crates) {
    $passed = ($crate.Tests | Where-Object { $_.Result -eq 'ok' }).Count
    $failed = ($crate.Tests | Where-Object { $_.Result -eq 'FAILED' }).Count
    $skipped = ($crate.Tests | Where-Object { $_.Result -eq 'ignored' }).Count

    if ($OnlyFailures -and $failed -eq 0) { continue }
    if ($crate.Tests.Count -eq 0) {
        Write-Host ("[----] {0,-40} (compile-only, no tests)" -f $crate.Name) -ForegroundColor Gray
        continue
    }

    $marker = if ($failed -gt 0) { "FAIL" } else { "ok  " }
    Write-Host ("[{0}] {1,-40} {2} passed, {3} failed, {4} skipped" -f $marker, $crate.Name, $passed, $failed, $skipped)

    $displayTests = if ($OnlyFailures) {
        $crate.Tests | Where-Object { $_.Result -ne 'ok' }
    } elseif ($ListTests) {
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
        Write-Host ("       {0}  {1}" -f $icon, $t.Name) -ForegroundColor $color
    }
    Write-Host ""
}

Write-Host ("-" * 74)
Write-Host ("TOTAL: {0} passed, {1} failed, {2} skipped across {3} crates" -f $totalPassed, $totalFailed, $totalIgnored, $crates.Count)

if ($totalFailed -gt 0 -or $compileErrors.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Compile Errors ===" -ForegroundColor Red
    foreach ($e in $compileErrors) { Write-Host $e -ForegroundColor Red }
    exit 1
} else {
    Write-Host "All tests passed." -ForegroundColor Green
    exit 0
}

