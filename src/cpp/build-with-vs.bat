@echo off
echo Setting up Visual Studio environment...
call "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"

echo.
echo Configuring project with CMake...
if not exist build mkdir build
cd build

cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release

if %errorlevel% neq 0 (
    echo CMake configuration failed
    exit /b 1
)

echo.
echo Building project...
cmake --build . --config Release --parallel

if %errorlevel% neq 0 (
    echo Build failed
    exit /b 1
)

echo.
echo Build completed successfully!
echo Executable should be in: %cd%\Release\space-analyzer-cli.exe

cd ..