@echo off
echo Building Space Hog Analyzer (C#)...

REM Try to find a modern C# compiler first
where csc >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo Using C# compiler from PATH
    csc /target:exe /out:SpaceHogAnalyzer.exe SpaceHogAnalyzer.cs
    if %ERRORLEVEL% == 0 (
        echo Compilation successful!
        echo.
        echo Space Hog Analyzer is ready!
        echo.
        echo Usage:
        echo   SpaceHogAnalyzer.exe "C:\Users\Aomega Imaging"
        echo.
        echo Features:
        echo   - Identifies the largest space-consuming files
        echo   - Shows Top 10, 20, 50, and 100 space hogs
        echo   - Groups by file type, application, and risk level
        echo   - Provides actionable cleanup recommendations
        echo   - Fast Windows API enumeration
        echo   - Risk assessment and recovery options
        echo   - No dependencies required (uses .NET Framework)
        echo.
    ) else (
        echo Compilation failed!
    )
    goto :end
)

REM Try to use .NET Framework compiler
echo C# compiler not found in PATH.
echo Attempting to use .NET framework compiler...

set "DOTNET_COMPILER=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%DOTNET_COMPILER%" (
    set "DOTNET_COMPILER=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if exist "%DOTNET_COMPILER%" (
    echo Using compiler: "%DOTNET_COMPILER%"
    "%DOTNET_COMPILER%" /target:exe /out:SpaceHogAnalyzer.exe SpaceHogAnalyzer.cs
    if %ERRORLEVEL% == 0 (
        echo Compilation successful!
        echo.
        echo Space Hog Analyzer is ready!
        echo.
        echo Usage:
        echo   SpaceHogAnalyzer.exe "C:\Users\Aomega Imaging"
        echo.
        echo Features:
        echo   - Identifies the largest space-consuming files
        echo   - Shows Top 10, 20, 50, and 100 space hogs
        echo   - Groups by file type, application, and risk level
        echo   - Provides actionable cleanup recommendations
        echo   - Fast Windows API enumeration
        echo   - Risk assessment and recovery options
        echo   - No dependencies required (uses .NET Framework)
        echo.
    ) else (
        echo Compilation failed!
    )
) else (
    echo .NET Framework compiler not found!
    echo Please install .NET Framework or add C# compiler to PATH.
)

:end
pause
