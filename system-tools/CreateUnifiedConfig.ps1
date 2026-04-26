# Create Unified Frontend Configuration
Write-Host "=== CREATING UNIFIED FRONTEND CONFIGURATION ===" -ForegroundColor Yellow

$unifiedDir = "E:\Self Built Web and Mobile Apps\Media Processing Tools\Unified Frontend"

# Ensure all directories exist
$requiredDirs = @(
    "src\components",
    "src\components\Audio",
    "src\components\Image", 
    "src\components\AI",
    "src\components\Common",
    "src\pages",
    "src\services",
    "src\services\api",
    "src\services\audio",
    "src\services\video",
    "src\services\image",
    "src\services\ai",
    "src\styles",
    "public"
)

foreach ($dir in $requiredDirs) {
    $fullPath = Join-Path $unifiedDir $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -Path $fullPath -ItemType Directory -Force
    }
}

# Create Vite configuration
$viteConfigPath = Join-Path $unifiedDir "vite.config.ts"
$viteConfigContent = @"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
"@

Set-Content -Path $viteConfigPath -Value $viteConfigContent -Encoding UTF8

# Create TypeScript configuration
$tsConfigPath = Join-Path $unifiedDir "tsconfig.json"
$tsConfigContent = @"
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
"@

Set-Content -Path $tsConfigPath -Value $tsConfigContent -Encoding UTF8

# Create Tailwind configuration
$tailwindConfigPath = Join-Path $unifiedDir "tailwind.config.js"
$tailwindConfigContent = @"
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
"@

Set-Content -Path $tailwindConfigPath -Value $tailwindConfigContent -Encoding UTF8

# Create PostCSS configuration
$postcssConfigPath = Join-Path $unifiedDir "postcss.config.js"
$postcssConfigContent = @"
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"@

Set-Content -Path $postcssConfigPath -Value $postcssConfigContent -Encoding UTF8

# Create global styles
$globalStylesPath = Join-Path $unifiedDir "src\styles\globals.css"
$globalStylesContent = @"
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background;
  }
  
  .btn-primary {
    @apply btn bg-primary-600 text-white hover:bg-primary-700;
  }
  
  .btn-secondary {
    @apply btn bg-secondary-600 text-white hover:bg-secondary-700;
  }
  
  .btn-outline {
    @apply btn border border-input bg-background hover:bg-accent hover:text-accent-foreground;
  }
  
  .card {
    @apply rounded-lg border bg-card text-card-foreground shadow-sm;
  }
  
  .input {
    @apply flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
"@

Set-Content -Path $globalStylesPath -Value $globalStylesContent -Encoding UTF8

# Create index.html
$indexPath = Join-Path $unifiedDir "index.html"
$indexContent = @"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Unified Media Processor</title>
    <meta name="description" content="Unified media processing platform combining music sync and AI media generation" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"@

Set-Content -Path $indexPath -Value $indexContent -Encoding UTF8

# Create main.tsx
$mainPath = Join-Path $unifiedDir "src\main.tsx"
$mainContent = @"
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
"@

Set-Content -Path $mainPath -Value $mainContent -Encoding UTF8

# Create missing page components
$audioSyncPath = Join-Path $unifiedDir "src\pages\AudioSync.tsx"
$audioSyncContent = @"
import React from 'react';
import { AudioProcessor } from '../components/Audio/AudioProcessor';

export const AudioSync: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audio Sync</h1>
        <p className="text-gray-600">Synchronize music with video content using advanced algorithms</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AudioProcessor />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sync Mode
              </label>
              <select className="w-full input">
                <option>Automatic Beat Detection</option>
                <option>Manual BPM Input</option>
                <option>Audio Analysis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <select className="w-full input">
                <option>MP4 (H.264)</option>
                <option>MOV (ProRes)</option>
                <option>AVI (Uncompressed)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
"@

Set-Content -Path $audioSyncPath -Value $audioSyncContent -Encoding UTF8

$mediaGeneratorPath = Join-Path $unifiedDir "src\pages\MediaGenerator.tsx"
$mediaGeneratorContent = @"
import React from 'react';
import { ImageProcessor } from '../components/Image/ImageProcessor';

export const MediaGenerator: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Generator</h1>
        <p className="text-gray-600">Generate and enhance media using AI-powered tools</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImageProcessor />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generation History</h3>
          <div className="space-y-3">
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Landscape_4K.png</span>
                <span className="text-xs text-gray-500">2 hours ago</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">AI Generated - 4K resolution</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Portrait_HD.jpg</span>
                <span className="text-xs text-gray-500">5 hours ago</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Enhanced - AI Upscaled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
"@

Set-Content -Path $mediaGeneratorPath -Value $mediaGeneratorContent -Encoding UTF8

$projectSettingsPath = Join-Path $unifiedDir "src\pages\ProjectSettings.tsx"
$projectSettingsContent = @"
import React from 'react';
import { Settings, HardDrive, Zap, Globe } from 'lucide-react';

export const ProjectSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your unified media processing environment</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <HardDrive className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Storage Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Output Directory
              </label>
              <input
                type="text"
                defaultValue="E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Output"
                className="w-full input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cache Size Limit
              </label>
              <select className="w-full input">
                <option>1 GB</option>
                <option>2 GB</option>
                <option>5 GB</option>
                <option>10 GB</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Zap className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Performance Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processing Threads
              </label>
              <input
                type="range"
                min="1"
                max="16"
                defaultValue="4"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GPU Acceleration
              </label>
              <select className="w-full input">
                <option>Enabled</option>
                <option>Disabled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Globe className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">API Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backend URL
              </label>
              <input
                type="text"
                defaultValue="http://localhost:8000"
                className="w-full input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                placeholder="Enter your API key"
                className="w-full input"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
"@

Set-Content -Path $projectSettingsPath -Value $projectSettingsContent -Encoding UTF8

Write-Host "Created unified frontend configuration" -ForegroundColor Green
Write-Host "Next: Creating shared backend integration..." -ForegroundColor Yellow
