@echo off
echo Building Space Analyzer Native GUI...
cd /d "E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\native-gui"

echo Building release executable...
cargo build --release --target x86_64-pc-windows-gnu

echo Copying executable to project root...
copy "target\x86_64-pc-windows-gnu\release\space-analyzer.exe" "space-analyzer-native.exe"

echo Build complete!
echo Executable location: E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\space-analyzer-native.exe
echo.
echo To run: space-analyzer-native.exe
pause