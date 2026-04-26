# Create Unified Frontend Experience
Write-Host "=== CREATING UNIFIED FRONTEND EXPERIENCE ===" -ForegroundColor Yellow

$unifiedDir = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Unified Frontend"
$project1 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Music Sync 2 Video App"
$project2 = "E:\Self Built Web and Web and Mobile Apps\Media Processing Tools\Simplified Media Generator"

Write-Host "Creating unified frontend structure..." -ForegroundColor White
Write-Host "This will combine the best features of both projects" -ForegroundColor Cyan

# Create unified frontend directory structure
$frontendDirs = @(
    "src",
    "src\components",
    "src\pages",
    "src\hooks",
    "src\utils",
    "src\services",
    "src\styles",
    "src\assets",
    "src\types",
    "public",
    "components\Audio",
    "components\Video",
    "components\Image",
    "components\AI",
    "components\Common",
    "services\api",
    "services\audio",
    "services\video",
    "services\image",
    "services\ai"
)

foreach ($dir in $frontendDirs) {
    $fullPath = Join-Path $unifiedDir $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -Path $fullPath -ItemType Directory -Force
        Write-Host "Created: $dir" -ForegroundColor Green
    }
}

# Create package.json for unified frontend
$packageJsonPath = Join-Path $unifiedDir "package.json"
$packageJsonContent = @"
{
  "name": "unified-media-processor",
  "version": "1.0.0",
  "description": "Unified media processing frontend combining music sync and media generation",
  "main": "src/index.tsx",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "typescript": "^4.9.3",
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "vite": "^4.1.0",
    "@vitejs/plugin-react": "^3.1.0",
    "tailwindcss": "^3.2.7",
    "autoprefixer": "^10.4.14",
    "postcss": "^8.4.21",
    "lucide-react": "^0.263.1",
    "framer-motion": "^10.0.1",
    "recharts": "^2.5.0",
    "react-dropzone": "^14.2.3",
    "react-hot-toast": "^2.4.0",
    "zustand": "^4.3.6",
    "axios": "^1.3.4",
    "date-fns": "^2.29.3"
  },
  "devDependencies": {
    "@types/node": "^18.14.6",
    "eslint": "^8.35.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.3.4",
    "@typescript-eslint/eslint-plugin": "^5.54.0",
    "@typescript-eslint/parser": "^5.54.0"
  }
}
"@

Set-Content -Path $packageJsonPath -Value $packageJsonContent -Encoding UTF8
Write-Host "Created unified package.json" -ForegroundColor Green

# Create main App component
$appComponentPath = Join-Path $unifiedDir "src\App.tsx"
$appComponentContent = @"
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { AudioSync } from './pages/AudioSync';
import { MediaGenerator } from './pages/MediaGenerator';
import { ProjectSettings } from './pages/ProjectSettings';
import { UnifiedProcessor } from './pages/UnifiedProcessor';
import './styles/globals.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/audio-sync" element={<AudioSync />} />
            <Route path="/media-generator" element={<MediaGenerator />} />
            <Route path="/unified-processor" element={<UnifiedProcessor />} />
            <Route path="/settings" element={<ProjectSettings />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;
"@

Set-Content -Path $appComponentPath -Value $appComponentContent -Encoding UTF8
Write-Host "Created main App component" -ForegroundColor Green

# Create Layout component
$layoutPath = Join-Path $unifiedDir "src\components\Layout.tsx"
$layoutContent = @"
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music, Image, Settings, Home, Zap, Activity } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Audio Sync', href: '/audio-sync', icon: Music },
    { name: 'Media Generator', href: '/media-generator', icon: Image },
    { name: 'Unified Processor', href: '/unified-processor', icon: Zap },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            Media Processor
          </h1>
          <p className="text-sm text-gray-600 mt-2">Unified Media Processing</p>
        </div>
        
        <nav className="mt-6">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={\`
                  flex items-center px-6 py-3 text-sm font-medium transition-colors
                  \${isActive 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                \`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {navigation.find(item => item.href === location.pathname)?.name || 'Media Processor'}
                </h2>
                <p className="text-sm text-gray-600">
                  {location.pathname === '/' && 'Overview of all media processing activities'}
                  {location.pathname === '/audio-sync' && 'Synchronize music with video content'}
                  {location.pathname === '/media-generator' && 'Generate and process media with AI'}
                  {location.pathname === '/unified-processor' && 'Combined audio-visual processing pipeline'}
                  {location.pathname === '/settings' && 'Configure project settings and preferences'}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>System Ready</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
"@

Set-Content -Path $layoutPath -Value $layoutContent -Encoding UTF8
Write-Host "Created Layout component" -ForegroundColor Green

# Create Dashboard page
$dashboardPath = Join-Path $unifiedDir "src\pages\Dashboard.tsx"
$dashboardContent = @"
import React from 'react';
import { Music, Image, Zap, TrendingUp, Clock, HardDrive } from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import { RecentActivity } from '../components/RecentActivity';
import { QuickActions } from '../components/QuickActions';

export const Dashboard: React.FC = () => {
  const stats = [
    {
      title: 'Audio Sync Projects',
      value: '12',
      change: '+2 this week',
      icon: Music,
      color: 'bg-blue-500',
    },
    {
      title: 'Generated Media',
      value: '248',
      change: '+45 this week',
      icon: Image,
      color: 'bg-green-500',
    },
    {
      title: 'Unified Processes',
      value: '8',
      change: '+3 this week',
      icon: Zap,
      color: 'bg-purple-500',
    },
    {
      title: 'Storage Used',
      value: '4.2 GB',
      change: '-0.8 GB optimized',
      icon: HardDrive,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome to your unified media processing center</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Quick Actions */}
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
          <div className="text-center text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-2" />
            <p>Performance chart will be rendered here</p>
            <p className="text-sm">Integration with recharts for data visualization</p>
          </div>
        </div>
      </div>
    </div>
  );
};
"@

Set-Content -Path $dashboardPath -Value $dashboardContent -Encoding UTF8
Write-Host "Created Dashboard page" -ForegroundColor Green

# Create Unified Processor page (combines both projects)
$unifiedProcessorPath = Join-Path $unifiedDir "src\pages\UnifiedProcessor.tsx"
$unifiedProcessorContent = @"
import React, { useState } from 'react';
import { Music, Image, Play, Download, Settings, Upload } from 'lucide-react';
import { AudioProcessor } from '../components/Audio/AudioProcessor';
import { ImageProcessor } from '../components/Image/ImageProcessor';
import { AIProcessor } from '../components/AI/AIProcessor';
import { ProcessTimeline } from '../components/ProcessTimeline';

type ProcessingMode = 'audio-sync' | 'media-generation' | 'unified';

export const UnifiedProcessor: React.FC = () => {
  const [mode, setMode] = useState<ProcessingMode>('unified');
  const [isProcessing, setIsProcessing] = useState(false);

  const modes = [
    {
      id: 'audio-sync' as ProcessingMode,
      name: 'Audio Sync',
      description: 'Synchronize music with video content',
      icon: Music,
      color: 'bg-blue-500',
    },
    {
      id: 'media-generation' as ProcessingMode,
      name: 'Media Generation',
      description: 'Generate media with AI assistance',
      icon: Image,
      color: 'bg-green-500',
    },
    {
      id: 'unified' as ProcessingMode,
      name: 'Unified Pipeline',
      description: 'Combined audio-visual processing',
      icon: Settings,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Unified Processor</h1>
        <p className="text-gray-600">Combined processing pipeline leveraging both project strengths</p>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((modeOption) => (
          <button
            key={modeOption.id}
            onClick={() => setMode(modeOption.id)}
            className={\`
              p-6 rounded-lg border-2 transition-all
              \${mode === modeOption.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
            \`}
          >
            <modeOption.icon className={\`w-8 h-8 mb-3 \${mode === modeOption.id ? 'text-blue-600' : 'text-gray-400'}\`} />
            <h3 className="font-semibold text-gray-900">{modeOption.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{modeOption.description}</p>
          </button>
        ))}
      </div>

      {/* Processing Interface */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {modes.find(m => m.id === mode)?.name} Processing
            </h2>
            <div className="flex items-center space-x-2">
              <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </button>
              <button 
                onClick={() => setIsProcessing(!isProcessing)}
                className={\`
                  flex items-center px-4 py-2 rounded-lg
                  \${isProcessing 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }
                \`}
              >
                {isProcessing ? (
                  <>
                    <Settings className="w-4 h-4 mr-2 animate-spin" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Processing
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Mode-specific content */}
          {mode === 'audio-sync' && <AudioProcessor />}
          {mode === 'media-generation' && <ImageProcessor />}
          {mode === 'unified' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AudioProcessor />
                <ImageProcessor />
              </div>
              <AIProcessor />
            </div>
          )}
        </div>
      </div>

      {/* Process Timeline */}
      <ProcessTimeline isProcessing={isProcessing} />

      {/* Results Section */}
      {isProcessing && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Output Files</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">synced_video.mp4</span>
                  <button className="text-blue-600 hover:text-blue-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">generated_image.png</span>
                  <button className="text-blue-600 hover:text-blue-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Processing Stats</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>2m 34s</span>
                </div>
                <div className="flex justify-between">
                  <span>Files Processed:</span>
                  <span>3</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality Score:</span>
                  <span>98%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
"@

Set-Content -Path $unifiedProcessorPath -Value $unifiedProcessorContent -Encoding UTF8
Write-Host "Created Unified Processor page" -ForegroundColor Green

Write-Host "`n=== UNIFIED FRONTEND STRUCTURE CREATED ===" -ForegroundColor Green
Write-Host "Next: Creating supporting components and configuration..." -ForegroundColor Yellow
