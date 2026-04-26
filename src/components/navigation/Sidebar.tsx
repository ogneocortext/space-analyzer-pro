import React, { useState } from 'react';
import Tooltip from '../shared/Tooltip';
import {
    LayoutDashboard,
    BrainCircuit,
    MessageSquare,
    BarChart3,
    Settings,
    Folder,
    Play,
    Activity,
    AlertTriangle,
    Menu,
    Zap,
    TrendingUp,
    Database,
    Shield,
    Search,
    Download,
    Upload,
    FileText,
    Globe,
    Cpu,
    Eye,
    GitBranch,
    Package,
    BookOpen,
    Code,
    Target,
    Layers,
    Network,
    PieChart,
    LineChart,
    ScatterChart,
    Filter,
    Sliders,
    Bell,
    User,
    Lock,
    Unlock,
    RefreshCw,
    Save,
    Trash2,
    Copy,
    Edit3,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info,
    HelpCircle,
    Brain,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    ChevronUp,
    Maximize2,
    Minimize2,
    MoreVertical,
    MoreHorizontal,
    Grid,
    List,
    Calendar,
    Clock,
    Map,
    Compass,
    Navigation,
    Home,
    Users,
    Mail,
    Phone,
    Video,
    Image,
    Music,
    Archive,
    HardDrive,
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
    // Cd
} from 'lucide-react';
import { ROUTE_GROUPS } from '../../config/routes';
import styles from '../../styles/components/Sidebar.module.css';

interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    tooltip?: string;
}

interface NavSection {
    id: string;
    label: string;
    items: NavItem[];
    collapsible?: boolean;
}

interface SidebarProps {
    currentPage: string;
    onNavigate: (page: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    currentPage,
    onNavigate,
    isCollapsed = false,
    onToggleCollapse
}) => {
    const [collapsedSections, setCollapsedSections] = useState<{[key: string]: boolean}>({
        // Make AI, visualization, tools, and system sections collapsed by default
        ai: true,
        visualization: true,
        tools: true,
        system: true
    });
    const [searchQuery, setSearchQuery] = useState('');

    const toggleSection = (sectionId: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    // Icon mapping for routes
    const iconMap: Record<string, React.ComponentType<any>> = {
        'LayoutDashboard': LayoutDashboard,
        'BrainCircuit': BrainCircuit,
        'MessageSquare': MessageSquare,
        'BarChart3': BarChart3,
        'Settings': Settings,
        'Folder': Folder,
        'Play': Play,
        'Activity': Activity,
        'AlertTriangle': AlertTriangle,
        'Zap': Zap,
        'TrendingUp': TrendingUp,
        'Database': Database,
        'Shield': Shield,
        'Search': Search,
        'Download': Download,
        'Globe': Globe,
        'Cpu': Cpu,
        'Eye': Eye,
        'Code': Code,
        'Brain': Brain,
        'Network': Network,
        'Calendar': Calendar,
        'PieChart': PieChart,
        'Layers': Layers,
        'Copy': Copy
    };

    // Filter items based on search query
    const filterItems = (items: any[]) => {
        if (!searchQuery.trim()) return items;
        return items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tooltip?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    // Convert route groups to nav sections with simplified structure
    const navSections: NavSection[] = [
        {
            id: 'core',
            label: 'Core',
            items: filterItems(ROUTE_GROUPS.core.map(route => ({
                id: route.id,
                label: route.title,
                icon: iconMap[route.icon] || LayoutDashboard,
                tooltip: route.description
            })))
        },
        {
            id: 'ai',
            label: 'AI',
            collapsible: true,
            items: filterItems(ROUTE_GROUPS.ai.map(route => ({
                id: route.id,
                label: route.title,
                icon: iconMap[route.icon] || BrainCircuit,
                tooltip: route.description
            })))
        },
        {
            id: 'visualization',
            label: 'Visualize',
            collapsible: true,
            items: filterItems(ROUTE_GROUPS.visualization.map(route => ({
                id: route.id,
                label: route.title,
                icon: iconMap[route.icon] || PieChart,
                tooltip: route.description
            })))
        },
        {
            id: 'tools',
            label: 'Tools',
            collapsible: true,
            items: filterItems(ROUTE_GROUPS.tools.map(route => ({
                id: route.id,
                label: route.title,
                icon: iconMap[route.icon] || Copy,
                tooltip: route.description
            })))
        },
        {
            id: 'system',
            label: 'System',
            collapsible: true,
            items: filterItems(ROUTE_GROUPS.system.map(route => ({
                id: route.id,
                label: route.title,
                icon: iconMap[route.icon] || Activity,
                tooltip: route.description
            })))
        }
    ];

    return (
        <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
            <div className={styles.sidebarHeader}>
                <h1 className={styles.appTitle}>Space Analyzer</h1>
                <span className={styles.appSubtitle}>Pro Edition</span>
                {onToggleCollapse && (
                    <button
                        className={styles.collapseBtn}
                        onClick={onToggleCollapse}
                        aria-label="Toggle sidebar"
                    >
                        <Menu size={20} />
                    </button>
                )}
            </div>

            {/* Search Input - Only show when not collapsed */}
            {!isCollapsed && (
                <div className={styles.searchContainer}>
                    <div className={styles.searchInput}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search navigation..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchField}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className={styles.clearSearch}
                                aria-label="Clear search"
                            >
                                <XCircle size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <nav className={styles.sidebarNav}>
                {navSections.map((section) => (
                    <div key={section.id} className={styles.navSection}>
                        {/* Section Header */}
                        {section.collapsible && !isCollapsed ? (
                            <button
                                className={styles.sectionHeader}
                                onClick={() => toggleSection(section.id)}
                                aria-expanded={!collapsedSections[section.id]}
                            >
                                <span className={styles.sectionLabel}>{section.label}</span>
                                {collapsedSections[section.id] ?
                                    <ChevronRight size={14} /> :
                                    <ChevronDown size={14} />
                                }
                            </button>
                        ) : !isCollapsed && (
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionLabel}>{section.label}</span>
                            </div>
                        )}

                        {/* Section Items */}
                        {(!section.collapsible || !collapsedSections[section.id] || isCollapsed) && (
                            <div className={styles.sectionItems}>
                                {section.items.map((item) => (
                                    <Tooltip
                                        key={item.id}
                                        content={item.tooltip || item.label}
                                        position="right"
                                        delay={500}
                                        disabled={isCollapsed}
                                    >
                                        <button
                                            className={`${styles.navItem} ${currentPage === item.id ? styles.active : ''}`}
                                            onClick={() => onNavigate(item.id)}
                                            title={isCollapsed ? item.tooltip || item.label : undefined}
                                            aria-label={item.tooltip || item.label}
                                        >
                                            <item.icon size={18} />
                                            {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                                            {currentPage === item.id && !isCollapsed && (
                                                <div className={styles.activeIndicator}></div>
                                            )}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>
        </div>
    );
};

export default Sidebar;