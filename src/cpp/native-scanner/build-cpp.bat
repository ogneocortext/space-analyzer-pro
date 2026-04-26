@echo off
setlocal enabledelayedexpansion

echo Setting up Visual Studio 2026 environment...
call "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"

echo Using downloaded Node.js headers...
set NODE_INCLUDE=D:\NodeJS-Headers\node-v25.9.0\include\node

echo Node.js headers: %NODE_INCLUDE%

echo Getting node-addon-api path...
for /f "delims=" %%i in ('node -p "require('node-addon-api').include"') do set ADDON_API=%%i
set ADDON_API=%ADDON_API:"=%
echo node-addon-api: %ADDON_API%

echo Creating build directory...
if exist build rmdir /s /q build
mkdir build

echo Compiling native_scanner.cpp...
cl.exe /EHsc /std:c++20 /O2 /GL /arch:AVX2 /fp:fast /Gw /LD /I"%NODE_INCLUDE%" /I"%ADDON_API%" /DNAPI_VERSION=4 /DNAPI_DISABLE_CPP_EXCEPTIONS /D_HAS_EXCEPTIONS=0 /DNOMINMAX /DWIN32_LEAN_AND_MEAN src\native_scanner.cpp /Fe:build\native_scanner.dll /link /LTCG /OPT:REF /OPT:ICF /DLL /DEF:src\native_scanner.def

if errorlevel 1 (
    echo Compilation failed with error %errorlevel%
    exit /b 1
)

echo Renaming DLL to .node...
if exist build\native_scanner.dll (
    move /Y build\native_scanner.dll build\native_scanner.node
    echo Build successful: build\native_scanner.node
    copy /Y build\native_scanner.node scanner.node
    echo Copied to scanner.node
) else (
    echo Build failed: native_scanner.dll not found
    exit /b 1
)

echo Done.
