import React from "react";
// @ts-ignore - react-router-dom may not be installed
import { Routes, Route } from "react-router-dom";
import SpaceAnalyzerDashboard from "../components/SpaceAnalyzerDashboard";
import NeuralView from "../components/NeuralView";
import EnhancedAIChat from "../components/EnhancedAIChat";
import TreeMapView from "../components/TreeMapView";
import ExportPanel from "../components/ExportPanel";
import FileBrowser from "../components/file-browser/EnhancedFileBrowser";
import Timeline from "../components/Timeline";
import Enhanced3DVisualization from "../components/Enhanced3DVisualization";
import PredictiveAnalyticsPage from "../components/PredictiveAnalyticsPage";
import SelfLearningDashboard from "../components/SelfLearningDashboard";
import { RealCodeAnalysis } from "../components/RealCodeAnalysis";
import { RealDuplicates } from "../components/RealDuplicates";
import { SystemAnalytics } from "../components/SystemAnalytics";
import { RealDependencies } from "../components/RealDependencies";
import { useAnalysisStore } from "../store";

const NeuralViewWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <NeuralView dependencyGraph={analysisResult?.dependencyGraph} />;
};

const TreeMapViewWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  const data = analysisResult
    ? {
        categories: analysisResult.categories || {},
        files: analysisResult.files || [],
      }
    : { categories: {}, files: [] };
  return <TreeMapView data={data} />;
};

const ExportPanelWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <ExportPanel analysisData={analysisResult} files={analysisResult?.files || []} />;
};

const FileBrowserWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  if (!analysisResult || !analysisResult.files || analysisResult.files.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No File Data</h2>
          <p className="text-slate-400">Run an analysis to see the file browser</p>
        </div>
      </div>
    );
  }
  const files = analysisResult.files.map((file, index) => ({
    id: file.path || index.toString(),
    name: file.name,
    // Convert Windows backslashes to forward slashes for consistent path handling
    path: file.path?.replace(/\\/g, "/") || "",
    size: file.size,
    type: "file" as const,
    category: file.category,
    extension: file.extension,
    modified: new Date(),
  }));
  return <FileBrowser files={files} />;
};

const DashboardWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  if (!analysisResult) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Analysis Data</h2>
          <p className="text-slate-400">Run an analysis to see the dashboard</p>
        </div>
      </div>
    );
  }
  return <SpaceAnalyzerDashboard analysisResults={analysisResult} onNavigate={() => {}} />;
};

const TimelineWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <Timeline analysisData={analysisResult} />;
};

const SystemAnalyticsWrapper = () => {
  return <SystemAnalytics />;
};

const ThreeDWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  // Convert dependency graph to 3D format
  const graphData = analysisResult?.dependencyGraph
    ? {
        nodes: analysisResult.dependencyGraph.nodes.map((node, index) => ({
          id: node.id,
          name: node.name,
          path: node.path,
          type: "file" as const,
          size: node.size,
          color: node.type === "directory" ? "#00B4D8" : "#8B5CF6",
          metadata: {
            path: node.path,
            lines: 0,
            complexity: 0,
            issues: 0,
            dependencies: 0,
          },
        })),
        links: analysisResult.dependencyGraph.edges.map((edge) => ({
          source: edge.from,
          target: edge.to,
          type: "import" as const,
          strength: 1,
          color: "#6366f1",
        })),
      }
    : { nodes: [], links: [] };
  return <Enhanced3DVisualization data={graphData} />;
};

const PredictionsWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <PredictiveAnalyticsPage analysisData={analysisResult} isLoading={false} />;
};

const LearningWrapper = () => {
  return <SelfLearningDashboard service={null} />;
};

const CodeAnalysisWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <RealCodeAnalysis analysisData={analysisResult} />;
};

const DuplicatesWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <RealDuplicates files={analysisResult?.files || []} />;
};

const DependenciesWrapper = () => {
  const analysisResult = useAnalysisStore((state) => state.analysisResult);
  return <RealDependencies analysisData={analysisResult} />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<DashboardWrapper />} />
      <Route path="/dashboard" element={<DashboardWrapper />} />
      <Route path="/neural" element={<NeuralViewWrapper />} />
      <Route path="/chat" element={<EnhancedAIChat />} />
      <Route path="/treemap" element={<TreeMapViewWrapper />} />
      <Route path="/export" element={<ExportPanelWrapper />} />
      <Route path="/browser" element={<FileBrowserWrapper />} />
      <Route path="/timeline" element={<TimelineWrapper />} />
      <Route path="/system" element={<SystemAnalyticsWrapper />} />
      <Route path="/3d" element={<ThreeDWrapper />} />
      <Route path="/predictions" element={<PredictionsWrapper />} />
      <Route path="/learning" element={<LearningWrapper />} />
      <Route path="/codeanalysis" element={<CodeAnalysisWrapper />} />
      <Route path="/duplicates" element={<DuplicatesWrapper />} />
      <Route path="/dependencies" element={<DependenciesWrapper />} />
    </Routes>
  );
};
