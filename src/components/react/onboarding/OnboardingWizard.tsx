import React, { useState, useEffect } from 'react';
import {
    X,
    ChevronRight,
    ChevronLeft,
    Play,
    Search,
    BarChart3,
    BrainCircuit,
    CheckCircle,
    Sparkles,
    BookOpen,
    Rocket,
    Target,
    Users,
    Settings
} from 'lucide-react';
import styles from '../../styles/components/OnboardingWizard.module.css';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    content: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface OnboardingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    currentPage?: string;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
    currentPage = 'dashboard'
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: 'Welcome to Space Analyzer Pro',
            description: 'Your intelligent file analysis companion',
            content: (
                <div className={styles.welcomeContent}>
                    <div className={styles.heroIcon}>
                        <Sparkles size={48} />
                    </div>
                    <div className={styles.welcomeText}>
                        <h3>Discover the power of AI-driven file analysis</h3>
                        <p>
                            Space Analyzer Pro combines advanced algorithms with artificial intelligence
                            to give you unprecedented insights into your file system.
                        </p>
                        <div className={styles.featuresGrid}>
                            <div className={styles.feature}>
                                <BrainCircuit size={20} />
                                <span>AI-Powered Analysis</span>
                            </div>
                            <div className={styles.feature}>
                                <BarChart3 size={20} />
                                <span>Visual Insights</span>
                            </div>
                            <div className={styles.feature}>
                                <Target size={20} />
                                <span>Smart Recommendations</span>
                            </div>
                            <div className={styles.feature}>
                                <Rocket size={20} />
                                <span>Automated Optimization</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'analysis',
            title: 'Start Your First Analysis',
            description: 'Analyze your file system to unlock insights',
            content: (
                <div className={styles.stepContent}>
                    <div className={styles.stepIcon}>
                        <Search size={32} />
                    </div>
                    <div className={styles.stepText}>
                        <h4>Get Started with Analysis</h4>
                        <p>
                            Click the "Start Analysis" button to begin scanning your files.
                            Our AI will analyze your entire file system and provide detailed insights.
                        </p>
                        <div className={styles.tips}>
                            <div className={styles.tip}>
                                <CheckCircle size={16} />
                                <span>Analysis is fast and secure</span>
                            </div>
                            <div className={styles.tip}>
                                <CheckCircle size={16} />
                                <span>Results are cached for quick access</span>
                            </div>
                            <div className={styles.tip}>
                                <CheckCircle size={16} />
                                <span>All processing happens locally</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            action: {
                label: 'Start Analysis',
                onClick: () => {
                    // This will be handled by parent component
                    onComplete();
                }
            }
        },
        {
            id: 'features',
            title: 'Explore Key Features',
            description: 'Discover what makes Space Analyzer Pro special',
            content: (
                <div className={styles.featuresOverview}>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>
                            <BrainCircuit size={24} />
                        </div>
                        <h5>AI Features</h5>
                        <p>Get intelligent recommendations and pattern recognition</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>
                            <BarChart3 size={24} />
                        </div>
                        <h5>Data Visualization</h5>
                        <p>Beautiful charts and graphs powered by AI</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>
                            <Target size={24} />
                        </div>
                        <h5>Smart Tools</h5>
                        <p>Automated cleanup and optimization tools</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>
                            <Settings size={24} />
                        </div>
                        <h5>Advanced Settings</h5>
                        <p>Customize your experience and preferences</p>
                    </div>
                </div>
            )
        },
        {
            id: 'navigation',
            title: 'Navigation & Organization',
            description: 'Learn how to navigate the application',
            content: (
                <div className={styles.navigationGuide}>
                    <div className={styles.navSection}>
                        <h5>Organized Sidebar</h5>
                        <p>
                            Features are grouped into logical sections:
                            Core Features, AI-Powered tools, Visualization, Tools, System, and Configuration.
                        </p>
                        <div className={styles.navGroups}>
                            <span className={styles.navGroup}>Core Features</span>
                            <span className={styles.navGroup}>AI-Powered</span>
                            <span className={styles.navGroup}>Visualization</span>
                            <span className={styles.navGroup}>Tools</span>
                            <span className={styles.navGroup}>System</span>
                            <span className={styles.navGroup}>Configuration</span>
                        </div>
                    </div>
                    <div className={styles.navSection}>
                        <h5>Quick Actions</h5>
                        <p>Use keyboard shortcuts and the command palette (Ctrl+K) for quick navigation.</p>
                    </div>
                </div>
            )
        },
        {
            id: 'complete',
            title: 'You\'re All Set!',
            description: 'Start exploring your file system insights',
            content: (
                <div className={styles.completionContent}>
                    <div className={styles.successIcon}>
                        <CheckCircle size={48} />
                    </div>
                    <div className={styles.completionText}>
                        <h4>Ready to explore!</h4>
                        <p>
                            You've completed the onboarding tour. Start analyzing your files
                            to unlock powerful insights and recommendations.
                        </p>
                        <div className={styles.nextSteps}>
                            <h5>Next Steps:</h5>
                            <ul>
                                <li>Run your first file analysis</li>
                                <li>Explore AI-powered features</li>
                                <li>Try the interactive visualizations</li>
                                <li>Set up automated monitoring</li>
                            </ul>
                        </div>
                        <div className={styles.dontShowAgain}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={dontShowAgain}
                                    onChange={(e) => setDontShowAgain(e.target.checked)}
                                    className={styles.checkbox}
                                />
                                <span className={styles.checkboxText}>
                                    Don't show this onboarding again
                                </span>
                            </label>
                            <p className={styles.checkboxHint}>
                                You can always restart the tour from Help ’ Tour in the main menu.
                            </p>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCompletedSteps(prev => new Set([...prev, currentStep]));
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        setCompletedSteps(prev => new Set([...prev, ...Array(steps.length).keys()]));
        onComplete();
        onClose();
    };

    const handleSkip = () => {
        onComplete();
        onClose();
    };

    // Reset step when wizard opens
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
            setCompletedSteps(new Set());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const currentStepData = steps[currentStep];

    return (
        <div className={styles.overlay}>
            <div className={styles.wizard}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.progress}>
                        <div className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                            />
                        </div>
                        <span className={styles.stepCounter}>
                            {currentStep + 1} of {steps.length}
                        </span>
                    </div>
                    <button
                        className={styles.closeButton}
                        onClick={handleSkip}
                        aria-label="Skip onboarding"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={styles.body}>
                    <div className={styles.stepHeader}>
                        <h2>{currentStepData.title}</h2>
                        <p>{currentStepData.description}</p>
                    </div>

                    <div className={styles.stepContent}>
                        {currentStepData.content}
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.footerLeft}>
                        {currentStep > 0 && (
                            <button
                                className={styles.secondaryButton}
                                onClick={handlePrevious}
                            >
                                <ChevronLeft size={16} />
                                Previous
                            </button>
                        )}
                    </div>

                    <div className={styles.stepIndicators}>
                        {steps.map((_, index) => (
                            <div
                                key={index}
                                className={`${styles.indicator} ${
                                    index === currentStep ? styles.active :
                                    completedSteps.has(index) ? styles.completed : ''
                                }`}
                            />
                        ))}
                    </div>

                    <div className={styles.footerRight}>
                        {currentStep < steps.length - 1 ? (
                            <button
                                className={styles.primaryButton}
                                onClick={handleNext}
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                className={styles.primaryButton}
                                onClick={handleComplete}
                            >
                                Get Started
                                <Rocket size={16} />
                            </button>
                        )}

                        {currentStepData.action && (
                            <button
                                className={styles.actionButton}
                                onClick={currentStepData.action.onClick}
                            >
                                {currentStepData.action.label}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;