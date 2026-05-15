@echo off
echo Packaging Space Analyzer Native GUI...

REM Check if build exists
if not exist "build\release\space-analyzer-gui.exe" (
    echo Error: Build not found. Please run build.bat first.
    pause
    exit /b 1
)

REM Create package directory
if not exist "dist" mkdir "dist"
if exist "dist\space-analyzer-gui" rmdir /s /q "dist\space-analyzer-gui"

REM Copy executable and assets
echo Copying files for packaging...
xcopy "build\release" "dist\space-analyzer-gui" /E /I /Y

REM Create installer script
echo Creating installer script...
(
echo @echo off
echo echo Installing Space Analyzer Pro...
echo echo.
echo if not exist "%%PROGRAMFILES%%\Space Analyzer Pro" mkdir "%%PROGRAMFILES%%\Space Analyzer Pro"
echo copy "dist\space-analyzer-gui\*.*" "%%PROGRAMFILES%%\Space Analyzer Pro\" /Y
echo echo Creating desktop shortcut...
echo if not exist "%%USERPROFILE%%\Desktop" mkdir "%%USERPROFILE%%\Desktop"
echo echo Set WshShell = CreateObject^("WScript.Shell"^) ^> "%%TEMP%%\create_shortcut.vbs"
echo Set oShell = CreateObject^("Shell.Application"^) ^>> "%%TEMP%%\create_shortcut.vbs"
echo Set oLink = oShell.CreateShortcut^("%%USERPROFILE%%\Desktop\Space Analyzer Pro.lnk"^) ^>> "%%TEMP%%\create_shortcut.vbs"
echo oLink.TargetPath = "%%PROGRAMFILES%%\Space Analyzer Pro\space-analyzer-gui.exe" ^>> "%%TEMP%%\create_shortcut.vbs"
echo oLink.WorkingDirectory = "%%PROGRAMFILES%%\Space Analyzer Pro" ^>> "%%TEMP%%\create_shortcut.vbs"
echo oLink.Save ^>> "%%TEMP%%\create_shortcut.vbs"
echo cscript //nologo "%%TEMP%%\create_shortcut.vbs" ^>> "%%TEMP%%\create_shortcut.vbs"
echo del "%%TEMP%%\create_shortcut.vbs" ^>> "%%TEMP%%\create_shortcut.vbs"
echo echo Installation completed!
echo echo.
echo echo Space Analyzer Pro has been installed successfully.
echo echo You can now run it from the Start Menu or desktop shortcut.
echo pause
) > "dist\install.bat"

REM Create uninstaller script
echo Creating uninstaller script...
(
echo @echo off
echo echo Uninstalling Space Analyzer Pro...
echo echo.
echo if exist "%%PROGRAMFILES%%\Space Analyzer Pro" (
echo     echo Removing application files...
echo     rmdir /s /q "%%PROGRAMFILES%%\Space Analyzer Pro"
echo )
echo if exist "%%USERPROFILE%%\Desktop\Space Analyzer Pro.lnk" (
echo     echo Removing desktop shortcut...
echo     del "%%USERPROFILE%%\Desktop\Space Analyzer Pro.lnk"
echo )
echo echo Space Analyzer Pro has been uninstalled successfully.
echo pause
) > "dist\uninstall.bat"

REM Create ZIP package
echo Creating ZIP package...
cd dist
powershell -command "Compress-Archive -Path 'space-analyzer-gui' -DestinationPath 'space-analyzer-gui-v2.14.0-windows.zip' -Force"
cd ..

echo.
echo Package created successfully!
echo.
echo Package location: dist\space-analyzer-gui-v2.14.0-windows.zip
echo.
echo To install:
echo 1. Extract the ZIP file
echo 2. Run install.bat as administrator
echo.
pause