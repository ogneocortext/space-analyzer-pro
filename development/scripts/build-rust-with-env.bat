@echo off
echo Building Rust scanner with Visual Studio environment...

REM Set Visual Studio paths
SET "VSINSTALLDIR=D:\Microsoft Visual Studio\18\Community"
SET "VSCMD_VER=17.8"
SET "VSCMD_ARG_HELLO_CONFIG=Release"
SET "VSCMD_ARG_TGT_ARCH=x64"
SET "VSCMD_ARG_HOST_ARCH=x64"
SET "VSCMD_ARG_ENABLE_LATEST_CXX_STD=1"

REM Set library paths
SET "LIB=D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\lib\x64;C:\Program Files (x86)\Windows Kits\10\lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\lib\10.0.26100.0\ucrt\x64;%LIB%"

REM Set include paths
SET "INCLUDE=D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\include;C:\Program Files (x86)\Windows Kits\10\include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\include\10.0.26100.0\shared;%INCLUDE%"

REM Set path for tools
SET "PATH=D:\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64;D:\Microsoft Visual Studio\18\Community\Common7\IDE;%PATH%"

echo Building with NAPI...
cd /d "e:/Self Built Web and Mobile Apps/Space Analyzer/src/rust/simple-scanner"
napi build --release

echo Done!
