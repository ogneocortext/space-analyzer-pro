@echo off
echo Compiling Quick File Browser...
echo.

REM Check if C# compiler is available
where csc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo C# compiler not found. Attempting to locate...
    set CSC_PATH=
    
    REM Try to find .NET Framework C# compiler
    if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
        set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
    ) else if exist "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
        set CSC_PATH=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
    ) else (
        REM Try to find .NET Core/5+ C# compiler
        where dotnet >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo Using dotnet build...
            dotnet new console -n QuickFileBrowser --force
            copy QuickFileBrowser.cs QuickFileBrowser\Program.cs
            cd QuickFileBrowser
            dotnet build -c Release --nologo
            if exist "bin\Release\net8.0\QuickFileBrowser.exe" (
                copy "bin\Release\net8.0\QuickFileBrowser.exe" "..\QuickFileBrowser.exe"
                echo.
                echo SUCCESS: QuickFileBrowser.exe created!
                echo Location: %cd%\QuickFileBrowser.exe
                cd ..
                goto :end
            ) else (
                echo Failed to build with dotnet
                cd ..
                goto :error
            )
        ) else (
            echo ERROR: No C# compiler found. Please install .NET SDK or Visual Studio.
            goto :error
        )
    )
    
    if defined CSC_PATH (
        echo Using C# compiler: %CSC_PATH%
        %CSC_PATH% /target:winexe /out:QuickFileBrowser.exe QuickFileBrowser.cs /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo SUCCESS: QuickFileBrowser.exe created!
            echo Location: %cd%\QuickFileBrowser.exe
            goto :end
        ) else (
            echo ERROR: Compilation failed!
            goto :error
        )
    )
) else (
    echo C# compiler found, compiling...
    csc /target:winexe /out:QuickFileBrowser.exe QuickFileBrowser.cs /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo SUCCESS: QuickFileBrowser.exe created!
        echo Location: %cd%\QuickFileBrowser.exe
        goto :end
    ) else (
        echo ERROR: Compilation failed!
        goto :error
    )
)

:error
echo.
echo COMPILATION FAILED!
echo.
echo Possible solutions:
echo 1. Install .NET SDK from https://dotnet.microsoft.com/download
echo 2. Install Visual Studio with .NET development tools
echo 3. Use the PowerShell script version instead
echo.
pause
exit /b 1

:end
echo.
echo To run the tool:
echo   QuickFileBrowser.exe
echo.
echo Or double-click QuickFileBrowser.exe in File Explorer
echo.
pause
