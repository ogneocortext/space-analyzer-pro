import React, { FC, useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { AIContextProvider } from './contexts/AIContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { LandingPage } from './components/layout/LandingPage';
import { AppHeader } from './components/layout/AppHeader';
import { useAnalysisState } from './hooks/useAnalysisState';
import { useNavigationState } from './hooks/useNavigationState';
import { useBackendHealth } from './hooks/useBackendHealth';
import { useAnalysisProgress } from './hooks/useWebSocket';
import { usePerformanceOptimization } from './hooks/usePerformanceOptimization';
import { useAccessibility } from './hooks/useAccessibility';
import { useResponsiveDesign } from './hooks/useResponsiveDesign';
import './styles/index.css';

// Lazy load heavy components
const ViewRouter = lazy(() => import('./components/layout/ViewRouter').then(m => ({ default: m.ViewRouter })));

const App: FC = () => {
    // Get initial path from localStorage or use a sensible default
    const getInitialPath = () => {
        const savedPath = localStorage.getItem('space-analyzer-last-path');
        return savedPath || 'D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio';
    };

    // Custom hooks for state management
    const analysisState = useAnalysisState(getInitialPath());
    const navigationState = useNavigationState('dashboard');
    const { isBackendOnline } = useBackendHealth();
    
    // Recent paths from localStorage
    const [recentPaths, setRecentPaths] = useState<string[]>([]);
    const [showPathPicker, setShowPathPicker] = useState(false);
    const [useAI, setUseAI] = useState(true);
    
    useEffect(() => {
        const saved = localStorage.getItem('space-analyzer-recent-paths');
        if (saved) {
            setRecentPaths(JSON.parse(saved));
        }
    }, []);
    
    const addToRecentPaths = (path: string) => {
        const updated = [path, ...recentPaths.filter(p => p !== path)].slice(0, 5);
        setRecentPaths(updated);
        localStorage.setItem('space-analyzer-recent-paths', JSON.stringify(updated));
    };

    // Action handlers
    const handleExportReport = useCallback(() => {
        if (!analysisState.data) return;
        
        const report = {
            timestamp: new Date().toISOString(),
            path: analysisState.path,
            totalFiles: analysisState.data.totalFiles,
            totalSize: analysisState.data.totalSize,
            categories: analysisState.data.categories,
            aiInsights: analysisState.data.ai_insights
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `space-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [analysisState.data, analysisState.path]);

    const handleCleanupSuggestions = useCallback(() => {
        navigationState.navigateTo('dashboard');
    }, [navigationState]);

    // Helper function to get category colors
    const getCategoryColor = (category: string): string => {
        const colors: Record<string, string> = {
            'Documents': '#3b82f6',
            'Images': '#10b981',
            'Videos': '#f59e0b',
            'Audio': '#8b5cf6',
            'Archives': '#ef4444',
            'Code': '#06b6d4',
            'System': '#64748b',
            'Other': '#94a3b8'
        };
        return colors[category] || '#94a3b8';
    };

    // Performance and accessibility hooks
    usePerformanceOptimization({
        maxNodes: 1000,
        maxConnections: 5000,
        frameRateLimit: 60,
        enableVirtualization: true,
        enableCanvasOptimization: true,
        enableMemoization: true
    });

    useAccessibility();
    useResponsiveDesign();

    // Save path to localStorage when it changes
    const handlePathChange = useCallback((newPath: string) => {
        analysisState.setPath(newPath);
        localStorage.setItem('space-analyzer-last-path', newPath);
    }, [analysisState]);

    // Simplified data transformations
    const optimizedNeuralData = null;

    // Main render
    if (!analysisState.data) {
        return (
            <LandingPage
                path={analysisState.path}
                onPathChange={handlePathChange}
                onAnalyze={analysisState.handleAnalysis}
                isBackendOnline={isBackendOnline}
                isAnalysisRunning={analysisState.isAnalysisRunning}
                progress={analysisState.progress}
                status={analysisState.status}
                error={analysisState.error}
                useAI={useAI}
                onToggleAI={() => setUseAI(!useAI)}
                recentPaths={recentPaths}
                showPathPicker={showPathPicker}
                onTogglePathPicker={() => setShowPathPicker(!showPathPicker)}
                onSelectRecentPath={(path) => {
                    handlePathChange(path);
                    setShowPathPicker(false);
                }}
                analysisData={analysisState.data}
                scannedFiles={[]}
                progressData={{
                    files: analysisState.filesScanned || 0,
                    percentage: analysisState.progress || 0,
                    currentFile: analysisState.currentFile || '',
                    completed: !analysisState.isAnalysisRunning
                }}
                onNavigateToDashboard={() => navigationState.navigateTo('dashboard')}
                onNavigateToBrowser={() => navigationState.navigateTo('browser')}
                onExportReport={handleExportReport}
                onCleanupSuggestions={handleCleanupSuggestions}
                getCategoryColor={getCategoryColor}
            />
        );
    }

    return (
        <div className="flex h-screen bg-slate-900">
            {/* Sidebar */}
            <AppSidebar
                currentView={navigationState.currentView}
                isSidebarOpen={navigationState.isSidebarOpen}
                onNavigate={navigationState.navigateTo}
                onToggleSidebar={navigationState.toggleSidebar}
                onAnalyze={analysisState.handleAnalysis}
                isBackendOnline={isBackendOnline}
                isAnalysisRunning={analysisState.isAnalysisRunning}
                filesAnalyzed={analysisState.data?.files?.length}
                totalSize={analysisState.data?.totalSize}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                {/* Header */}
                <AppHeader
                    currentView={navigationState.currentView}
                    onToggleSidebar={navigationState.toggleSidebar}
                />

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-slate-900">
                    <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400">Loading...</div>}>
                        <ViewRouter
                            currentView={navigationState.currentView}
                            analysisData={analysisState.data}
                            optimizedNeuralData={optimizedNeuralData}
                            onNewAnalysis={analysisState.handleAnalysis}
                            isAnalyzing={analysisState.isAnalysisRunning}
                        />
                    </Suspense>
                </div>
            </main>
        </div>
    );
};

const AppWithProvider: FC = () => (
    <AIContextProvider>
        <App />
    </AIContextProvider>
);

export default AppWithProvider;
