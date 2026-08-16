@echo off
call "D:\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
cd /d "E:\Self Built Web and Mobile Apps\Space Analyzer\native\scanner"
cargo build --release --target-dir "E:\rust-builds\scanner-target"
pause
