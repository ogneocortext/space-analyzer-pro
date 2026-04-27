import React from "react";
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Layers,
  Folder,
  Search,
  Copy,
  Zap,
  Play,
  Download,
  Activity,
  Shield,
  Code,
  Globe,
  Settings,
  Network,
  Eye,
  FileText,
  Database,
  CheckCircle,
  Star,
  BookOpen,
  Lightbulb,
  Rocket,
  Target,
  Cpu,
  HardDrive,
  Users,
  Mail,
  Phone,
  Video,
  Image,
  Music,
  Archive,
  Cloud,
  Wifi,
  Battery,
  Volume2,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Server,
  Router,
  // Ethernet,
  Usb,
  // SdCard,
  // Hdd,
  // Ssd,
  // Dvd,
  // Cd,
  Grid,
  List,
  Calendar,
  Clock,
  Map,
  Compass,
  Navigation,
  Home,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  Trash2,
  Edit3,
  XCircle,
  AlertCircle,
  Info,
  HelpCircle,
  Circle,
  Triangle,
  Square,
  Hexagon,
  Star as StarIcon,
} from "lucide-react";
import styles from "../../styles/components/EmptyState.module.css";

interface EmptyStateProps {
  pageType: string;
  onAction?: () => void;
  actionLabel?: string;
  isLoading?: boolean;
}

// Custom SVG Illustrations for Empty States
const NeuralNetworkIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Nodes */}
    <circle cx="50" cy="40" r="8" fill="currentColor" opacity="0.6" />
    <circle cx="100" cy="30" r="10" fill="currentColor" opacity="0.8" />
    <circle cx="150" cy="50" r="8" fill="currentColor" opacity="0.6" />
    <circle cx="50" cy="80" r="6" fill="currentColor" opacity="0.5" />
    <circle cx="100" cy="90" r="8" fill="currentColor" opacity="0.7" />
    <circle cx="150" cy="70" r="6" fill="currentColor" opacity="0.5" />

    {/* Connections */}
    <path d="M58 40 L92 30" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    <path d="M108 30 L142 50" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    <path d="M58 80 L92 90" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    <path d="M108 90 L142 70" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    <path d="M100 38 L100 82" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    <path d="M58 40 L50 74" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    <path d="M142 50 L150 66" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
  </svg>
);

const TreemapIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main rectangles */}
    <rect x="20" y="20" width="60" height="40" fill="currentColor" opacity="0.7" />
    <rect x="20" y="65" width="35" height="35" fill="currentColor" opacity="0.5" />
    <rect x="60" y="65" width="20" height="20" fill="currentColor" opacity="0.6" />
    <rect x="85" y="20" width="45" height="25" fill="currentColor" opacity="0.8" />
    <rect x="85" y="50" width="30" height="50" fill="currentColor" opacity="0.6" />
    <rect x="120" y="20" width="30" height="30" fill="currentColor" opacity="0.5" />
    <rect x="155" y="20" width="25" height="80" fill="currentColor" opacity="0.7" />
    <rect x="120" y="55" width="30" height="45" fill="currentColor" opacity="0.4" />
  </svg>
);

const ChatIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Chat bubbles */}
    <path d="M30 60 L70 30 L70 90 Z" fill="currentColor" opacity="0.6" />
    <path d="M130 40 L170 10 L170 70 Z" fill="currentColor" opacity="0.7" />
    <circle cx="20" cy="60" r="8" fill="currentColor" opacity="0.5" />
    <circle cx="120" cy="40" r="10" fill="currentColor" opacity="0.8" />

    {/* Connecting lines */}
    <path
      d="M75 60 L115 40"
      stroke="currentColor"
      strokeWidth="2"
      opacity="0.4"
      strokeDasharray="5,5"
    />
  </svg>
);

const AIPatternsIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 200 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Pattern recognition elements */}
    <circle cx="60" cy="40" r="15" fill="currentColor" opacity="0.3" />
    <circle cx="100" cy="60" r="12" fill="currentColor" opacity="0.5" />
    <circle cx="140" cy="40" r="18" fill="currentColor" opacity="0.4" />
    <circle cx="80" cy="80" r="10" fill="currentColor" opacity="0.6" />
    <circle cx="120" cy="80" r="14" fill="currentColor" opacity="0.5" />

    {/* Connecting pattern lines */}
    <path d="M75 40 L88 60" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    <path d="M112 60 L128 40" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    <path d="M90 72 L110 72" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    <path d="M100 48 L100 72" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  </svg>
);

const EmptyState: React.FC<EmptyStateProps> = ({
  pageType,
  onAction,
  actionLabel,
  isLoading = false,
}) => {
  const getEmptyStateConfig = (pageType: string) => {
    const configs = {
      dashboard: {
        icon: LayoutDashboard,
        title: "Welcome to Space Analyzer Pro",
        description:
          "Get started by analyzing your file system to unlock powerful insights, AI-powered recommendations, and comprehensive storage analytics.",
        features: [
          "AI-powered file analysis and insights",
          "Neural network visualization of your data",
          "Predictive storage forecasting",
          "Smart duplicate detection and cleanup",
        ],
        tips: [
          "Start with a quick analysis of your current directory",
          "Explore AI features for intelligent recommendations",
          "Use the neural view to understand file relationships",
        ],
        actionLabel: "Start Analysis",
        gradient: "from-blue-500 to-purple-600",
      },
      "ai-features": {
        icon: BrainCircuit,
        title: "AI-Powered Analysis Awaits",
        description:
          "Our advanced AI algorithms will analyze your files and provide intelligent recommendations for optimization, duplicate detection, and predictive insights.",
        features: [
          "Pattern recognition across your file system",
          "Smart categorization and tagging",
          "Anomaly detection for unusual file patterns",
          "AI-powered cleanup recommendations",
        ],
        tips: [
          "Start with a full system scan for comprehensive results",
          "Use AI insights to identify storage optimization opportunities",
          "Combine AI recommendations with manual review for best results",
        ],
        actionLabel: "Start AI Analysis",
        gradient: "from-purple-500 to-pink-600",
      },
      neural: {
        icon: Network,
        title: "Visualize Your Data Connections",
        description:
          "See your file system as a neural network. Understand relationships, dependencies, and hierarchies through an interactive visualization.",
        features: [
          "Interactive node-based visualization",
          "Zoom and pan capabilities",
          "Color-coded file types",
          "Relationship mapping",
        ],
        tips: [
          "Connect visualization with AI analysis for deeper insights",
          "Use zoom controls to explore different detail levels",
          "Node sizes represent file/folder importance",
        ],
        actionLabel: "Generate Neural View",
        gradient: "from-green-500 to-teal-600",
      },
      chat: {
        icon: MessageSquare,
        title: "Chat with Your File System",
        description:
          "Ask questions about your files in natural language and get instant, intelligent answers.",
        features: [
          "Natural language queries",
          "Real-time file system insights",
          "Contextual recommendations",
          "Interactive file exploration",
        ],
        tips: [
          "Ask 'What are my largest files?'",
          "Try 'Find files I haven't used in 6 months'",
          "Ask 'Show me duplicate photos'",
          "Query 'Which folders are growing fastest?'",
        ],
        actionLabel: "Start Conversation",
        gradient: "from-indigo-500 to-blue-600",
      },
      visualization: {
        icon: BarChart3,
        title: "Interactive Storage Visualization",
        description:
          "Explore your disk usage through an intuitive treemap. See at a glance which files and folders consume the most space.",
        features: [
          "Proportional size representation",
          "Color-coded by file type or age",
          "Click to drill down into folders",
          "Hover for detailed information",
        ],
        tips: [
          "Larger rectangles represent bigger files/folders",
          "Use color coding to identify file types quickly",
          "Click on folders to explore subdirectories",
        ],
        actionLabel: "Create Visualization",
        gradient: "from-orange-500 to-red-600",
      },
      predictive: {
        icon: TrendingUp,
        title: "Predictive Storage Analytics",
        description:
          "Forecast future storage needs and get proactive recommendations before you run out of space.",
        features: [
          "Growth trend analysis",
          "Storage forecasting",
          "Capacity planning",
          "Early warning alerts",
        ],
        tips: [
          "Forecasts improve with historical usage data",
          "Set up automated capacity monitoring",
          "Use predictions for budget and planning decisions",
        ],
        actionLabel: "Generate Forecast",
        gradient: "from-cyan-500 to-blue-600",
      },
      treemap: {
        icon: Layers,
        title: "Hierarchical File Visualization",
        description:
          "Explore your file system through interactive treemaps that show size relationships and directory structures at a glance.",
        features: [
          "Hierarchical size visualization",
          "Interactive zooming and navigation",
          "Color-coded file type identification",
          "Detailed file information on hover",
        ],
        tips: [
          "Rectangle sizes represent file/directory sizes",
          "Colors indicate different file types",
          "Zoom in to explore subdirectories",
        ],
        actionLabel: "Generate Treemap",
        gradient: "from-emerald-500 to-green-600",
      },
      "file-browser": {
        icon: Folder,
        title: "Advanced File Browser",
        description:
          "Navigate and explore your file system with powerful search, filtering, and organization capabilities designed for large datasets.",
        features: [
          "Advanced search and filtering",
          "Virtual scrolling for performance",
          "Bulk operations and selections",
          "Detailed file metadata display",
        ],
        tips: [
          "Use the search bar for instant file location",
          "Filter by file type, size, or date",
          "Select multiple files for bulk actions",
        ],
        actionLabel: "Browse Files",
        gradient: "from-amber-500 to-orange-600",
      },
      analysis: {
        icon: Search,
        title: "Deep File Analysis",
        description:
          "Comprehensive analysis of your file system with detailed reports and actionable insights.",
        features: ["File type distribution", "Size analysis", "Age analysis", "Access patterns"],
        tips: [
          "Deep analysis provides foundation for all other features",
          "Results include detailed breakdowns and statistics",
          "Use analysis results to drive optimization decisions",
        ],
        actionLabel: "Run Full Analysis",
        gradient: "from-violet-500 to-purple-600",
      },
      duplicates: {
        icon: Copy,
        title: "Find and Remove Duplicates",
        description:
          "Identify duplicate files across your system and reclaim valuable storage space with smart duplicate detection.",
        features: [
          "Hash-based duplicate detection",
          "Similar file finding",
          "Batch deletion options",
          "Preview before deletion",
        ],
        tips: [
          "Scan your entire drive for comprehensive duplicate detection",
          "Review duplicate groups carefully before deletion",
          "Start with non-critical duplicates for safe cleanup",
        ],
        actionLabel: "Scan for Duplicates",
        gradient: "from-rose-500 to-pink-600",
      },
      optimization: {
        icon: Rocket,
        title: "Optimize Your Storage",
        description:
          "Get AI-powered recommendations to optimize your file storage and improve system performance.",
        features: [
          "Automated cleanup suggestions",
          "Compression opportunities",
          "Archive recommendations",
          "Organization tips",
        ],
        tips: [
          "AI analyzes your usage patterns for personalized recommendations",
          "Start with safe optimizations that can be easily reversed",
          "Monitor performance improvements after applying changes",
        ],
        actionLabel: "Analyze for Optimization",
        gradient: "from-yellow-500 to-orange-600",
      },
      automation: {
        icon: Play,
        title: "Automated File Management",
        description:
          "Set up intelligent automation rules for file organization, cleanup, backup, and maintenance tasks that run automatically.",
        features: [
          "Automated cleanup schedules",
          "Smart file organization rules",
          "Backup automation",
          "Maintenance task scheduling",
        ],
        tips: [
          "Start with simple rules and expand gradually",
          "Test automation rules on small directories first",
          "Monitor automated actions regularly",
        ],
        actionLabel: "Create Automation Rules",
        gradient: "from-slate-500 to-gray-600",
      },
      export: {
        icon: Download,
        title: "Flexible Data Export",
        description:
          "Export your analysis results, visualizations, and reports in multiple formats for sharing, archiving, or further analysis.",
        features: [
          "Multiple export formats (PDF, CSV, JSON, XML)",
          "Customizable report templates",
          "Bulk export capabilities",
          "Scheduled automated exports",
        ],
        tips: [
          "Choose formats based on your intended use",
          "PDF reports are great for presentations",
          "CSV/JSON formats work well for further analysis",
        ],
        actionLabel: "Export Data",
        gradient: "from-teal-500 to-cyan-600",
      },
      monitoring: {
        icon: Activity,
        title: "Real-Time System Monitoring",
        description:
          "Monitor your file system health, track changes, and receive alerts about important events and storage conditions.",
        features: [
          "Real-time file system monitoring",
          "Change detection and alerts",
          "Storage capacity monitoring",
          "Performance metrics tracking",
        ],
        tips: [
          "Set up alerts for critical storage thresholds",
          "Monitor frequently changing directories",
          "Use historical data for trend analysis",
        ],
        actionLabel: "Start Monitoring",
        gradient: "from-red-500 to-orange-600",
      },
      security: {
        icon: Shield,
        title: "Security Analysis & Protection",
        description:
          "Scan for security vulnerabilities, identify potentially harmful files, and receive recommendations for improving file system security.",
        features: [
          "Security vulnerability scanning",
          "Malware and threat detection",
          "Permission analysis",
          "Security recommendation engine",
        ],
        tips: [
          "Regular security scans are essential",
          "Review permissions on sensitive files",
          "Keep security definitions updated",
        ],
        actionLabel: "Run Security Scan",
        gradient: "from-red-600 to-red-800",
      },
      development: {
        icon: Code,
        title: "Developer Tools & APIs",
        description:
          "Access developer tools, APIs, debugging utilities, and advanced configuration options for power users and integrators.",
        features: [
          "RESTful API access",
          "Developer debugging tools",
          "Plugin and extension system",
          "Advanced configuration options",
        ],
        tips: [
          "API documentation is available in the help section",
          "Use debugging tools for troubleshooting",
          "Extensions can add powerful new features",
        ],
        actionLabel: "Explore Dev Tools",
        gradient: "from-gray-600 to-gray-800",
      },
      integrations: {
        icon: Globe,
        title: "Third-Party Integrations",
        description:
          "Connect with external services, cloud storage, backup systems, and other tools to extend your file analysis capabilities.",
        features: [
          "Cloud storage integration",
          "Backup service connections",
          "API-based third-party tools",
          "Custom integration development",
        ],
        tips: [
          "Start with popular services like Google Drive or Dropbox",
          "Configure integrations gradually",
          "Test connections before relying on them",
        ],
        actionLabel: "Configure Integrations",
        gradient: "from-blue-600 to-indigo-600",
      },
      settings: {
        icon: Settings,
        title: "Application Settings",
        description:
          "Customize your Space Analyzer Pro experience with themes, preferences, notifications, and advanced configuration options.",
        features: [
          "Theme customization (dark/light mode)",
          "Notification preferences",
          "Performance settings",
          "Data retention and privacy options",
        ],
        tips: [
          "Settings are automatically saved",
          "Some changes require application restart",
          "Export settings for backup or migration",
        ],
        actionLabel: "Open Settings",
        gradient: "from-gray-500 to-slate-600",
      },
    };

    return configs[pageType as keyof typeof configs] || configs.dashboard;
  };

  const config = getEmptyStateConfig(pageType);
  const IconComponent = config.icon;

  // Get illustration component for specific page types
  const getIllustration = () => {
    switch (pageType) {
      case "neural":
        return <NeuralNetworkIllustration className={styles.illustration} />;
      case "treemap":
      case "visualization":
        return <TreemapIllustration className={styles.illustration} />;
      case "chat":
        return <ChatIllustration className={styles.illustration} />;
      case "ai-features":
        return <AIPatternsIllustration className={styles.illustration} />;
      default:
        return null;
    }
  };

  const illustration = getIllustration();

  return (
    <div className={styles.emptyStateContainer}>
      <div className={styles.emptyStateCard}>
        {/* Illustration or Icon with gradient background */}
        {illustration ? (
          <div className={`${styles.illustrationContainer} bg-gradient-to-br ${config.gradient}`}>
            {illustration}
          </div>
        ) : (
          <div className={`${styles.iconContainer} bg-gradient-to-br ${config.gradient}`}>
            <IconComponent size={48} className={styles.mainIcon} />
          </div>
        )}

        {/* Title and description */}
        <div className={styles.content}>
          <h2 className={styles.title}>{config.title}</h2>
          <p className={styles.description}>{config.description}</p>

          {/* Features list */}
          <div className={styles.featuresSection}>
            <h3 className={styles.sectionTitle}>What you'll get:</h3>
            <ul className={styles.featuresList}>
              {config.features.map((feature, index) => (
                <li key={index} className={styles.featureItem}>
                  <CheckCircle size={16} className={styles.checkIcon} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tips section */}
          <div className={styles.tipsSection}>
            <h3 className={styles.sectionTitle}>
              <Lightbulb size={16} className={styles.tipsIcon} />
              Pro Tips:
            </h3>
            <ul className={styles.tipsList}>
              {config.tips.map((tip, index) => (
                <li key={index} className={styles.tipItem}>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action button */}
        {onAction && (
          <div className={styles.actionSection}>
            <button
              onClick={onAction}
              disabled={isLoading}
              className={`${styles.actionButton} bg-gradient-to-r ${config.gradient}`}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className={styles.loadingIcon} />
                  Processing...
                </>
              ) : (
                <>
                  <Rocket size={18} className={styles.rocketIcon} />
                  {actionLabel || config.actionLabel}
                </>
              )}
            </button>
          </div>
        )}

        {/* Preview/mock content hint */}
        <div className={styles.previewHint}>
          <Info size={14} className={styles.hintIcon} />
          <span>This page will show detailed information after running an analysis</span>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
