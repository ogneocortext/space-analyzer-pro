import React, { FC } from 'react';
import EnhancedDashboard from '../dashboard/EnhancedDashboard';
import NeuralView from '../NeuralView';
import EnhancedAIChat from '../EnhancedAIChat';
import TreeMapView from '../TreeMapView';
import { ExportPanel } from '../ExportPanel';
import FileBrowser from '../file-browser/EnhancedFileBrowser';
import { Timeline } from '../Timeline';
import { SystemTab } from '../SystemTab';
import { Enhanced3DVisualization } from '../Enhanced3DVisualization';
import ActionablePrediction from '../ActionablePrediction';
import { SelfLearningDashboard } from '../SelfLearningDashboard';
import { CodeAnalysisDisplay } from '../CodeAnalysisDisplay';
import { DuplicatesTab } from '../DuplicatesTab';
import { DependencyImpactAnalyzer } from '../DependencyImpactAnalyzer';

interface ViewRouterProps {
    currentView: string;
    analysisData: any;
    optimizedNeuralData: any;
    onNewAnalysis: () => void;
    isAnalyzing: boolean;
}

export const ViewRouter: FC<ViewRouterProps> = ({
    currentView,
    analysisData,
    optimizedNeuralData,
    onNewAnalysis,
    isAnalyzing
}) => {
    const renderDashboard = () => (
        <div className="p-6 h-full overflow-auto">
            <EnhancedDashboard
                // @ts-ignore - data type
                data={analysisData}
                onNewAnalysis={onNewAnalysis}
                isAnalyzing={isAnalyzing}
            />
        </div>
    );

    switch (currentView) {
        case 'dashboard':
            return renderDashboard();
        case 'neural':
            return (
                <div className="p-6 h-full flex flex-col">
                    <NeuralView
                        data={optimizedNeuralData}
                        // @ts-ignore - files property
                        files={analysisData?.files ?? []}
                        // @ts-ignore - categories property
                        categories={analysisData?.categories}
                    />
                </div>
            );
        case 'chat':
            return (
                <div className="p-6 h-full flex flex-col">
                    <EnhancedAIChat />
                </div>
            );
        case 'treemap':
            return (
                <div className="p-6 h-full flex flex-col">
                    <TreeMapView
                        data={{
                            categories: analysisData?.categories ?? {},
                            files: analysisData?.files ?? []
                        }}
                    />
                </div>
            );
        case 'export':
            return (
                <div className="p-6 h-full flex flex-col">
                    <ExportPanel
                        analysisData={analysisData}
                        files={analysisData?.files ?? []}
                        categories={analysisData?.categories}
                    />
                </div>
            );
        case 'browser':
            return (
                <div className="p-6 h-full flex flex-col">
                    {/* @ts-ignore - files type mismatch */}
                    <FileBrowser files={analysisData?.files ?? []} />
                </div>
            );
        case 'timeline':
            return (
                <div className="p-6 h-full flex flex-col">
                    <Timeline analysisData={analysisData} />
                </div>
            );
        case 'system':
            return (
                <div className="p-6 h-full flex flex-col">
                    <SystemTab />
                </div>
            );
        case '3d':
            return (
                <div className="p-6 h-full flex flex-col">
                    {/* @ts-ignore - data type */}
                    <Enhanced3DVisualization
                        data={{
                            nodes: (analysisData?.files ?? []).slice(0, 50).map((file: any) => ({
                                id: file.path,
                                name: file.name,
                                path: file.path,
                                type: 'file',
                                size: file.size,
                                color: '#3b82f6',
                                metadata: {
                                    path: file.path,
                                    lines: 0,
                                    complexity: 1,
                                    issues: 0,
                                    dependencies: 0
                                }
                            })),
                            links: []
                        }}
                    />
                </div>
            );
        case 'predictions':
            return (
                <div className="p-6 h-full flex flex-col">
                    {/* @ts-ignore - props type */}
                    <ActionablePrediction
                        insights={[]}
                        onAction={(action, target, files) => console.log(action, target, files)}
                        files={analysisData?.files ?? []}
                        categories={analysisData?.categories || {}}
                    />
                </div>
            );
        case 'learning':
            return (
                <div className="p-6 h-full flex flex-col">
                    {/* @ts-ignore - service prop */}
                    <SelfLearningDashboard service={null} />
                </div>
            );
        case 'codeanalysis':
            return (
                <div className="p-6 h-full flex flex-col">
                    {/* @ts-ignore - props type */}
                    <CodeAnalysisDisplay
                        healthMetrics={null}
                        dependencyAnalysis={null}
                    />
                </div>
            );
        case 'duplicates':
            return (
                <div className="p-6 h-full flex flex-col">
                    {/* @ts-ignore - files type */}
                    <DuplicatesTab files={analysisData?.files ?? []} />
                </div>
            );
        case 'dependencies':
            return (
                <div className="p-6 h-full flex flex-col">
                    <DependencyImpactAnalyzer
                        analysis={null}
                        onExecuteAction={(action) => console.log(action)}
                    />
                </div>
            );
        default:
            return renderDashboard();
    }
};
