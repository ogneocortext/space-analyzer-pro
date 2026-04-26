import React, { FC } from 'react';
import {
    LayoutDashboard,
    BrainCircuit,
    MessageSquare,
    BarChart3,
    FolderSearch,
    Download,
    Clock,
    Monitor,
    Box,
    Zap,
    GraduationCap,
    Code,
    Copy,
    GitBranch
} from 'lucide-react';

interface AppSidebarProps {
    currentView?: string;
    isSidebarOpen?: boolean;
    isCollapsed?: boolean;
    onNavigate?: (view: string) => void;
    onToggleSidebar?: () => void;
    onToggle?: () => void;
    onAnalyze?: () => void;
    isBackendOnline?: boolean;
    isAnalysisRunning?: boolean;
    filesAnalyzed?: number;
    totalSize?: number;
    theme?: any;
    preferences?: any;
}

export const AppSidebar: FC<AppSidebarProps> = ({
    currentView = 'dashboard',
    isSidebarOpen = true,
    isCollapsed = false,
    onNavigate = () => {},
    onToggleSidebar = () => {},
    onToggle = () => {},
    onAnalyze = () => {},
    isBackendOnline = true,
    isAnalysisRunning = false,
    filesAnalyzed = 0,
    totalSize = 0,
    theme,
    preferences
}) => {
    return (
        <div className={`bg-slate-800 border-r border-slate-700 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300`}>
            {/* Logo Section */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-700">
                <div className="w-8 h-8 bg-gradient-to-br from-[#00B4D8] to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                    <BrainCircuit className="w-5 h-5 text-white" />
                </div>
                <div>
                    <span className="text-lg text-white font-bold">Space Analyzer</span>
                    <p className="text-xs text-slate-400">AI-Powered Analysis</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4">
                <h3 className="text-xs text-slate-300 mb-3 font-semibold">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                        onClick={onAnalyze}
                        disabled={!isBackendOnline || isAnalysisRunning}
                        className="flex flex-col items-center gap-2 p-3 bg-slate-700/50 border border-slate-600 rounded-xl hover:bg-[#00B4D8]/20 hover:border-[#00B4D8] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isBackendOnline ? 'Start New Analysis' : 'Backend Offline'}
                    >
                        <LayoutDashboard size={16} className="text-[#00B4D8]" />
                        <span className="text-xs text-white">Analyze</span>
                    </button>
                    <button
                        onClick={() => onNavigate('browser')}
                        disabled={filesAnalyzed === undefined || filesAnalyzed === 0}
                        className="flex flex-col items-center gap-2 p-3 bg-slate-700/50 border border-slate-600 rounded-xl hover:bg-emerald-500/20 hover:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={filesAnalyzed ? 'Browse Files' : 'Run analysis first'}
                    >
                        <FolderSearch size={16} className="text-emerald-400" />
                        <span className="text-xs text-white">Browse</span>
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 px-4">
                <h3 className="text-xs text-slate-300 mb-3 font-semibold">Navigation</h3>
                <button
                    onClick={() => onNavigate('dashboard')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <LayoutDashboard size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Dashboard</div>
                        <div className="text-xs text-slate-400">Overview & insights</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('neural')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'neural' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <BrainCircuit size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Neural Analysis</div>
                        <div className="text-xs text-slate-400">AI-powered insights</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('chat')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'chat' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <MessageSquare size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">AI Chat</div>
                        <div className="text-xs text-slate-400">Ask questions</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('treemap')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'treemap' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <BarChart3 size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Visualizations</div>
                        <div className="text-xs text-slate-400">Charts & graphs</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('export')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'export' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Download size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Export</div>
                        <div className="text-xs text-slate-400">Save results</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('browser')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'browser' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <FolderSearch size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">File Browser</div>
                        <div className="text-xs text-slate-400">Explore files</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('timeline')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'timeline' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Clock size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Timeline</div>
                        <div className="text-xs text-slate-400">Historical trends</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('system')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'system' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Monitor size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">System Analytics</div>
                        <div className="text-xs text-slate-400">Resource monitoring</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('3d')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === '3d' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Box size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">3D Visualization</div>
                        <div className="text-xs text-slate-400">3D graph view</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('predictions')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'predictions' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Zap size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Smart Predictions</div>
                        <div className="text-xs text-slate-400">AI recommendations</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('learning')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'learning' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <GraduationCap size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Self-Learning</div>
                        <div className="text-xs text-slate-400">ML dashboard</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('codeanalysis')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'codeanalysis' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Code size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Code Analysis</div>
                        <div className="text-xs text-slate-400">Dependency health</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('duplicates')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'duplicates' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <Copy size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Duplicates</div>
                        <div className="text-xs text-slate-400">Find duplicate files</div>
                    </div>
                </button>
                <button
                    onClick={() => onNavigate('dependencies')}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentView === 'dependencies' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                    <GitBranch size={20} />
                    <div className="flex-1 text-left">
                        <div className="font-medium">Dependencies</div>
                        <div className="text-xs text-slate-400">Module analysis</div>
                    </div>
                </button>
            </nav>

            {/* System Status */}
            <div className="mt-auto p-4 border-t border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs text-slate-300 font-semibold">System Status</h3>
                    <div className={`flex items-center gap-2`}>
                        <div className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-emerald-400' : 'bg-orange-400'} animate-pulse`}></div>
                        <span className={`text-xs ${isBackendOnline ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {isBackendOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
                
                {filesAnalyzed !== undefined && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Files Analyzed</span>
                            <span className="text-white font-medium">{filesAnalyzed}</span>
                        </div>
                        {totalSize !== undefined && (
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Total Size</span>
                                <span className="text-white font-medium">
                                    {totalSize ? `${(totalSize / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
