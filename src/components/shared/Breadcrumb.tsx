import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import styles from '../../styles/components/Breadcrumb.module.css';

interface BreadcrumbItem {
  label: string;
  path?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
  className?: string;
}

/**
 * Breadcrumb Navigation Component
 * Shows hierarchical navigation path with clickable items
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  onNavigate,
  className = ''
}) => {
  const handleItemClick = (item: BreadcrumbItem) => {
    if (item.path && onNavigate && !item.current) {
      onNavigate(item.path);
    }
  };

  return (
    <nav aria-label="Breadcrumb" className={`${styles.breadcrumb} ${className}`}>
      <ol className={styles.breadcrumbList}>
        {/* Home item */}
        <li className={styles.breadcrumbItem}>
          <button
            onClick={() => onNavigate?.('dashboard')}
            className={`${styles.breadcrumbLink} ${styles.homeLink}`}
            aria-label="Go to Dashboard"
          >
            <Home size={16} />
            <span className={styles.visuallyHidden}>Home</span>
          </button>
        </li>

        {/* Separator */}
        <li className={styles.breadcrumbSeparator} aria-hidden="true">
          <ChevronRight size={14} />
        </li>

        {/* Breadcrumb items */}
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <li className={styles.breadcrumbItem}>
              {item.current ? (
                <span
                  className={`${styles.breadcrumbLink} ${styles.currentPage}`}
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <button
                  onClick={() => handleItemClick(item)}
                  className={styles.breadcrumbLink}
                  disabled={!item.path || !onNavigate}
                >
                  {item.label}
                </button>
              )}
            </li>

            {/* Separator (not for last item) */}
            {index < items.length - 1 && (
              <li className={styles.breadcrumbSeparator} aria-hidden="true">
                <ChevronRight size={14} />
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};

/**
 * Generate breadcrumb items based on current page
 */
export const generateBreadcrumbs = (currentPage: string): BreadcrumbItem[] => {
  const pageMap: Record<string, BreadcrumbItem[]> = {
    dashboard: [
      { label: 'Dashboard', current: true }
    ],
    'file-browser': [
      { label: 'File Browser', current: true }
    ],
    analysis: [
      { label: 'Analysis', current: true }
    ],
    'ai-features': [
      { label: 'AI Features', current: true }
    ],
    'smart-analysis': [
      { label: 'AI Features', path: 'ai-features' },
      { label: 'Smart Analysis', current: true }
    ],
    neural: [
      { label: 'AI Features', path: 'ai-features' },
      { label: 'Neural View', current: true }
    ],
    chat: [
      { label: 'AI Features', path: 'ai-features' },
      { label: 'AI Chat', current: true }
    ],
    predictive: [
      { label: 'AI Features', path: 'ai-features' },
      { label: 'Predictive Analytics', current: true }
    ],
    timetravel: [
      { label: 'AI Features', path: 'ai-features' },
      { label: 'Time Travel', current: true }
    ],
    temperature: [
      { label: 'AI Features', path: 'ai-features' },
      { label: 'File Temperature', current: true }
    ],
    visualization: [
      { label: 'Visualization', current: true }
    ],
    treemap: [
      { label: 'Visualization', path: 'visualization' },
      { label: 'Treemap View', current: true }
    ],
    duplicates: [
      { label: 'Duplicates', current: true }
    ],
    optimization: [
      { label: 'Optimization', current: true }
    ],
    automation: [
      { label: 'Automation', current: true }
    ],
    monitoring: [
      { label: 'Monitoring', current: true }
    ],
    security: [
      { label: 'Security', current: true }
    ],
    export: [
      { label: 'Export', current: true }
    ],
    development: [
      { label: 'Development', current: true }
    ],
    integrations: [
      { label: 'Integrations', current: true }
    ],
    settings: [
      { label: 'Settings', current: true }
    ]
  };

  return pageMap[currentPage] || [{ label: currentPage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()), current: true }];
};

export default Breadcrumb;