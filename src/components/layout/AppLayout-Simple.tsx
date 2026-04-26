import React, { useState } from 'react';
import { Menu, X, Home, BarChart3, BrainCircuit, Settings, FileText, FolderOpen } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
}

const AppLayoutSimple: React.FC<{
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  isLoading?: boolean;
}> = ({ children, currentPage, onNavigate, isLoading }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navigationItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={20} />,
      path: 'dashboard'
    },
    {
      id: 'file-browser',
      label: 'File Browser',
      icon: <FolderOpen size={20} />,
      path: 'file-browser'
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: <BarChart3 size={20} />,
      path: 'analysis'
    },
    {
      id: 'duplicates',
      label: 'Duplicates',
      icon: <FileText size={20} />,
      path: 'duplicates'
    },
    {
      id: 'neural',
      label: 'Neural View',
      icon: <BrainCircuit size={20} />,
      path: 'neural'
    },
    {
      id: 'treemap',
      label: 'TreeMap',
      icon: <BarChart3 size={20} />,
      path: 'treemap'
    },
    {
      id: 'ai-features',
      label: 'AI Features',
      icon: <BrainCircuit size={20} />,
      path: 'ai-features'
    },
    {
      id: 'ai-insights',
      label: 'AI Insights',
      icon: <BrainCircuit size={20} />,
      path: 'ai-insights'
    },
    {
      id: 'chat',
      label: 'AI Chat',
      icon: <BrainCircuit size={20} />,
      path: 'chat'
    },
    {
      id: 'smart-analysis',
      label: 'Smart Analysis',
      icon: <Settings size={20} />,
      path: 'smart-analysis'
    },
    {
      id: 'timetravel',
      label: 'Time Travel',
      icon: <BarChart3 size={20} />,
      path: 'timetravel'
    },
    {
      id: 'export',
      label: 'Export',
      icon: <FileText size={20} />,
      path: 'export'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={20} />,
      path: 'settings'
    }
  ];

  const categories = [
    {
      title: 'Analyze',
      items: navigationItems.filter(item => ['dashboard', 'file-browser', 'analysis', 'duplicates', 'smart-analysis'].includes(item.id))
    },
    {
      title: 'Visualize',
      items: navigationItems.filter(item => ['neural', 'treemap'].includes(item.id))
    },
    {
      title: 'AI Insights',
      items: navigationItems.filter(item => ['ai-features', 'ai-insights', 'chat'].includes(item.id))
    },
    {
      title: 'Tools',
      items: navigationItems.filter(item => ['timetravel', 'export'].includes(item.id))
    },
    {
      title: 'System',
      items: navigationItems.filter(item => ['settings'].includes(item.id))
    }
  ];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#020617',
      color: '#ffffff'
    }}>
      {/* Sidebar */}
      <div style={{
        width: isSidebarOpen ? '280px' : '70px',
        background: '#1e293b',
        borderRight: '1px solid #334155',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 'bold'
            }}>
              SA
            </div>
            <span style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#ffffff'
            }}>
              Space Analyzer
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 0'
        }}>
          {categories.map((category, categoryIndex) => (
            <div key={categoryIndex} style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {category.title}
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.path);
                      if (window.innerWidth < 768) {
                        setIsSidebarOpen(false);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: currentPage === item.id ? '#10b981' : 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: currentPage === item.id ? '#ffffff' : '#94a3b8',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>
                      {item.icon}
                    </span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Top Bar */}
        <div style={{
          background: '#0f172a',
          padding: '12px 20px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px'
            }}
          >
            <Menu size={20} />
          </button>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#ffffff',
              margin: 0
            }}>
              Space Analyzer Pro
            </h1>
            {isLoading && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #10b981',
                borderTop: '2px solid #10b981',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
          </div>

          <div style={{
            marginLeft: 'auto'
          }}>
            {/* Status indicators */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#10b981',
                borderRadius: '50%'
              }} />
              <span>Backend Connected</span>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#020617'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayoutSimple;
