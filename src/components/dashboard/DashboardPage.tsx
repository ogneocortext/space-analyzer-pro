import React from 'react';
import SpaceAnalyzerDashboard from '../SpaceAnalyzerDashboard';
// @ts-ignore - formatUtils module
import { formatFileSize } from '../utils/formatUtils';
import styles from '../../styles/components/DashboardPage.module.css';

interface AnalysisData {
    totalFiles: number;
    totalSize: number;
    directories: number;
    largestFiles: Array<{
        name: string;
        size: number;
    }>;
    categories: Record<string, {
        size: number;
        count: number;
    }>;
    ai_insights: {
        storage_warnings: string[];
        optimization_suggestions: string[];
        potential_duplicates: number;
    };
    directoryPath: string;
}

interface DashboardPageProps {
    analysisData: AnalysisData;
    onNavigate: (page: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
    analysisData,
    onNavigate
}) => {
    return (
        <div className={styles.dashboardPage}>
            <SpaceAnalyzerDashboard
                // @ts-ignore - missing files property
                analysisResults={analysisData}
                onNavigate={onNavigate}
            />
        </div>
    );
};

export default DashboardPage;