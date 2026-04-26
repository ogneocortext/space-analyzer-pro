const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple screenshot using Windows built-in tools
function takeWindowsScreenshot(outputPath) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = outputPath || path.join(__dirname, `screenshot-${timestamp}.png`);
    
    console.log(`📸 Taking screenshot: ${screenshotPath}`);
    
    // Use PowerShell to capture screenshot
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height; $graphics = [System.Drawing.Graphics]::FromImage($bmp); $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size); $bmp.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $bmp.Dispose()`;
    
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Screenshot failed:', error.message);
        reject(error);
      } else {
        console.log(`✅ Screenshot saved: ${screenshotPath}`);
        resolve(screenshotPath);
      }
    });
  });
}

// Alternative: Use built-in Windows tools
function takeSimpleScreenshot(outputPath) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = outputPath || path.join(__dirname, `screenshot-${timestamp}.png`);
    
    console.log(`📸 Taking simple screenshot: ${screenshotPath}`);
    
    // Try different methods
    const methods = [
      `screencapture -x "${screenshotPath}"`,
      `snippingtool /clip`,
      `explorer shell:::{3080F90D-D7AD-11D9-BD37-505550503028} /s`
    ];
    
    let methodIndex = 0;
    
    const tryMethod = () => {
      if (methodIndex >= methods.length) {
        console.log('⚠️ No screenshot method available');
        console.log('Please manually take a screenshot and save it as:');
        console.log(screenshotPath);
        resolve(screenshotPath);
        return;
      }
      
      const cmd = methods[methodIndex];
      console.log(`Trying method ${methodIndex + 1}: ${cmd}`);
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.log(`Method ${methodIndex + 1} failed`);
          methodIndex++;
          tryMethod();
        } else {
          console.log(`✅ Screenshot captured using method ${methodIndex + 1}`);
          resolve(screenshotPath);
        }
      });
    };
    
    tryMethod();
  });
}

// Main function
if (require.main === module) {
  takeWindowsScreenshot().then(path => {
    console.log(`Screenshot ready: ${path}`);
    console.log('Now run: node frontend-visual-analyzer.cjs analyze "' + path + '"');
  }).catch(error => {
    console.log('Trying alternative method...');
    takeSimpleScreenshot().then(path => {
      console.log(`Screenshot ready: ${path}`);
      console.log('Now run: node frontend-visual-analyzer.cjs analyze "' + path + '"');
    });
  });
}

module.exports = { takeWindowsScreenshot, takeSimpleScreenshot };
