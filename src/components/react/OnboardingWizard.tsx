import React, { useState, useEffect, FC, ReactNode, ComponentType } from 'react';
import {
    BrainCircuit,
    FileSearch,
    BarChart3,
    MessageSquare,
    ChevronRight,
    ChevronLeft,
    Play,
    CheckCircle,
    X,
    Folder,
    Zap,
    Users,
    ArrowRight,
    SkipForward
} from 'lucide-react';

interface OnboardingWizardProps {
    onComplete: () => void;
    onSkip: () => void;
    isBackendOnline: boolean;
}

interface OnboardingStep {
    title: string;
    description: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    content: ReactNode;
    action?: {
        label: string;
        onClick: () => void;
        disabled?: boolean;
    };
}

const OnboardingWizard: FC<OnboardingWizardProps> = ({ onComplete, onSkip, isBackendOnline }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    // Track if user has completed onboarding before
    useEffect(() => {
        const hasCompletedOnboarding = localStorage.getItem('spaceAnalyzer_onboarding_completed');
        if (hasCompletedOnboarding) {
            onSkip(); // Skip onboarding if already completed
        }
    }, [onSkip]);

    const steps: OnboardingStep[] = [
        {
            title: "Welcome to Space Analyzer Pro",
            description: "Your AI-powered file system intelligence companion",
            icon: BrainCircuit,
            content: (
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
                            <BrainCircuit size={64} className="relative text-blue-500" />
                        </div>
                    </div>
                    <div className="space-y-3 text-slate-300">
                        <p className="text-lg">Discover insights about your file system with advanced AI analysis and beautiful visualizations.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <FileSearch className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                                <h3 className="font-semibold text-white mb-1">Smart Analysis</h3>
                                <p className="text-sm">AI-powered file system scanning with intelligent categorization</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <BarChart3 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                                <h3 className="font-semibold text-white mb-1">Rich Visualizations</h3>
                                <p className="text-sm">Treemaps, neural networks, and interactive dashboards</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <MessageSquare className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                                <h3 className="font-semibold text-white mb-1">AI Assistant</h3>
                                <p className="text-sm">Chat with AI for insights and file management suggestions</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "System Setup",
            description: "Let's make sure everything is ready",
            icon: Zap,
            content: (
                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${isBackendOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div>
                                <h3 className="font-semibold text-white">Backend Connection</h3>
                                <p className="text-sm text-slate-300">
                                    {isBackendOnline
                                        ? "✅ Connected to Space Analyzer backend server"
                                        : "⚠️ Backend server not detected. Please start the server first."
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <div>
                                <h3 className="font-semibold text-white">Web Interface</h3>
                                <p className="text-sm text-slate-300">✅ React frontend is running and ready</p>
                            </div>
                        </div>
                    </div>

                    {!isBackendOnline && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-400 mb-2">To get started:</h4>
                            <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                                <li>Make sure the backend server is running on port 8090</li>
                                <li>Check that Ollama is installed and running (optional)</li>
                                <li>Refresh this page if the connection status doesn't update</li>
                            </ol>
                        </div>
                    )}
                </div>
            ),
            action: {
                label: isBackendOnline ? "Continue" : "Try Again",
                onClick: () => {
                    if (isBackendOnline) {
                        setCompletedSteps(prev => new Set([...prev, currentStep]));
                        setCurrentStep(prev => prev + 1);
                    }
                },
                disabled: !isBackendOnline
            }
        },
        {
            title: "Your First Analysis",
            description: "Let's analyze your first directory",
            icon: Folder,
            content: (
                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h3 className="font-semibold text-white mb-3">Getting Started with Analysis</h3>
                        <div className="space-y-3 text-sm text-slate-300">
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-blue-400 font-semibold text-xs">1</span>
                                </div>
                                <div>
                                    <p className="font-medium text-white">Choose a Directory</p>
                                    <p>Enter the path to a folder you want to analyze, or use "." for the current directory</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-blue-400 font-semibold text-xs">2</span>
                                </div>
                                <div>
                                    <p className="font-medium text-white">Start Analysis</p>
                                    <p>Click "Start Analysis" and watch the progress indicators</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-blue-400 font-semibold text-xs">3</span>
                                </div>
                                <div>
                                    <p className="font-medium text-white">Explore Results</p>
                                    <p>Use the dashboard, visualizations, and AI chat to explore your data</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-400 mb-2">💡 Pro Tips:</h4>
                        <ul className="text-sm text-slate-300 space-y-1">
                            <li>• Start with a small directory to see quick results</li>
                            <li>• Use the AI Chat to ask questions about your files</li>
                            <li>• Try different visualization modes to understand your data</li>
                            <li>• Export your analysis results for sharing or backup</li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            title: "Exploring Features",
            description: "Discover what Space Analyzer can do",
            icon: Users,
            content: (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <div className="flex items-center space-x-3 mb-3">
                                <BarChart3 className="w-6 h-6 text-blue-400" />
                                <h3 className="font-semibold text-white">Dashboard</h3>
                            </div>
                            <p className="text-sm text-slate-300">View metrics, charts, and AI insights about your file system</p>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <div className="flex items-center space-x-3 mb-3">
                                <BrainCircuit className="w-6 h-6 text-purple-400" />
                                <h3 className="font-semibold text-white">Neural View</h3>
                            </div>
                            <p className="text-sm text-slate-300">Interactive neural network visualization of file relationships</p>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <div className="flex items-center space-x-3 mb-3">
                                <MessageSquare className="w-6 h-6 text-green-400" />
                                <h3 className="font-semibold text-white">AI Chat</h3>
                            </div>
                            <p className="text-sm text-slate-300">Ask questions and get AI-powered insights about your files</p>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <div className="flex items-center space-x-3 mb-3">
                                <BarChart3 className="w-6 h-6 text-orange-400" />
                                <h3 className="font-semibold text-white">Visualizations</h3>
                            </div>
                            <p className="text-sm text-slate-300">Treemaps, heatmaps, and interactive file system views</p>
                        </div>
                    </div>

                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-400 mb-2">🚀 Advanced Features:</h4>
                        <ul className="text-sm text-slate-300 space-y-1">
                            <li>• Real-time analysis progress with WebSocket updates</li>
                            <li>• File management operations (move, copy, delete, rename)</li>
                            <li>• Export to CSV, JSON, and visual formats</li>
                            <li>• Incremental analysis for faster rescans</li>
                            <li>• Self-learning AI that improves over time</li>
                        </ul>
                    </div>
                </div>
            )
        }
    ];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCompletedSteps(prev => new Set([...prev, currentStep]));
            setCurrentStep(prev => prev + 1);
        } else {
            // Complete onboarding
            localStorage.setItem('spaceAnalyzer_onboarding_completed', 'true');
            onComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        localStorage.setItem('spaceAnalyzer_onboarding_completed', 'true');
        onSkip();
    };

    const currentStepData = steps[currentStep];

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <currentStepData.icon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{currentStepData.title}</h2>
                            <p className="text-sm text-slate-400">{currentStepData.description}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-slate-400 hover:text-white transition-colors"
                        aria-label="Skip onboarding"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-3 bg-slate-900/50">
                    <div className="flex items-center space-x-2">
                        {steps.map((_, index) => (
                            <div
                                key={index}
                                className={`flex-1 h-2 rounded-full transition-colors ${
                                    index <= currentStep
                                        ? 'bg-blue-500'
                                        : 'bg-slate-600'
                                }`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                        <span>Step {currentStep + 1} of {steps.length}</span>
                        <span>{Math.round(((currentStep + 1) / steps.length) * 100)}% Complete</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-96">
                    {currentStepData.content}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-900/50">
                    <button
                        onClick={handlePrevious}
                        disabled={currentStep === 0}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                        <span>Previous</span>
                    </button>

                    <div className="flex space-x-3">
                        {currentStepData.action ? (
                            <button
                                onClick={currentStepData.action.onClick}
                                disabled={currentStepData.action.disabled}
                                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                            >
                                <span>{currentStepData.action.label}</span>
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                            >
                                <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;