@echo off
echo Compiling Simple File Scanner (C#)...
echo.

REM Check for C# compiler
where csc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo C# compiler not found in PATH.
    echo Attempting to use .NET framework compiler...
    
    REM Try .NET Framework compiler
    if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
        set CSC_PATH="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    ) else if exist "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
        set CSC_PATH="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
    ) else (
        echo ERROR: C# compiler not found. Please install .NET Framework or .NET SDK.
        pause
        exit /b 1
    )
) else (
    set CSC_PATH=csc
)

echo Using compiler: %CSC_PATH%
echo.

REM Compile the Simple File Scanner
echo Compiling SimpleFileScanner.cs...
%CSC_PATH% /target:exe /out:SimpleFileScanner.exe SimpleFileScanner.cs /reference:System.dll

if %ERRORLEVEL% neq 0 (
    echo Compilation failed!
    pause
    exit /b 1
)

echo.
echo Compilation successful!
echo.
echo Simple File Scanner is ready!
echo.
echo Usage:
echo   SimpleFileScanner.exe "C:\Users\Aomega Imaging"
echo.
echo Features:
echo   - Safe and reliable C# implementation
echo   - Built-in timeout protection (5 seconds per directory)
echo   - Limited to 1000 files to prevent hanging
echo   - Application origin tracing
echo   - Regeneration mechanism detection
echo   - Risk assessment and impact analysis
echo   - No dependencies required (uses .NET Framework)
echo.

pause
