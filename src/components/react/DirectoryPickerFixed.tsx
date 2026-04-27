import React, { useState, useRef, useEffect } from 'react';
import { 
  FolderOpen, 
  X, 
  Check, 
  AlertCircle, 
  HardDrive, 
  Folder, 
  Search, 
  ChevronRight,
  Home,
  Monitor,
  Smartphone,
  Globe,
  Terminal,
  Clock
} from 'lucide-react';
import styles from '../styles/components/DirectoryPicker.module.css';

interface DirectoryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'drive' | 'special';
  icon: React.ReactNode;
  description?: string;
  isAccessible?: boolean;
}

const DirectoryPicker: React.FC<DirectoryPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = ''
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [customPath, setCustomPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect platform on mount
  useEffect(() => {
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('win')) return 'windows';
      if (userAgent.includes('mac')) return 'macos';
      if (userAgent.includes('linux')) return 'linux';
      return 'windows'; // default fallback
    };
    setPlatform(detectPlatform());
  }, []);

  // Simplified - just use native file picker
  const handleOpenExplorer = async () => {
    try {
      setError('');
      // Try native file picker first
      await handleNativeFilePicker();
    } catch (error) {
      console.error('Error opening file picker:', error);
      setError('Failed to open file picker. Please enter path manually.');
    }
  };

  // Platform-specific directory configurations
  const getPlatformDirectories = (): DirectoryEntry[] => {
    switch (platform) {
      case 'windows':
        return [
          {
            name: 'Documents',
            path: 'C:\\Users\\%USERNAME%\\Documents',
            type: 'directory',
            icon: <Folder size={16} />,
            description: 'User documents folder',
            isAccessible: true
          },
          {
            name: 'Desktop',
            path: 'C:\\Users\\%USERNAME%\\Desktop',
            type: 'directory',
            icon: <Monitor size={16} />,
            description: 'Desktop folder',
            isAccessible: true
          },
          {
            name: 'Downloads',
            path: 'C:\\Users\\%USERNAME%\\Downloads',
            type: 'directory',
            icon: <FolderOpen size={16} />,
            description: 'Downloaded files',
            isAccessible: true
          },
          {
            name: 'Local Disk (C:)',
            path: 'C:\\',
            type: 'drive',
            icon: <HardDrive size={16} />,
            description: 'Primary system drive',
            isAccessible: true
          },
          {
            name: 'Projects (D:)',
            path: 'D:\\Projects',
            type: 'directory',
            icon: <Folder size={16} />,
            description: 'Projects directory on D drive',
            isAccessible: false // Check if exists
          },
          {
            name: 'Source Code',
            path: '.\\src',
            type: 'directory',
            icon: <Terminal size={16} />,
            description: 'Current source directory',
            isAccessible: true
          }
        ];
      case 'macos':
        return [
          {
            name: 'Documents',
            path: '/Users/%USERNAME%/Documents',
            type: 'directory',
            icon: <Folder size={16} />,
            description: 'User documents folder',
            isAccessible: true
          },
          {
            name: 'Desktop',
            path: '/Users/%USERNAME%/Desktop',
            type: 'directory',
            icon: <Monitor size={16} />,
            description: 'Desktop folder',
            isAccessible: true
          },
          {
            name: 'Downloads',
            path: '/Users/%USERNAME%/Downloads',
            type: 'directory',
            icon: <FolderOpen size={16} />,
            description: 'Downloaded files',
            isAccessible: true
          },
          {
            name: 'Applications',
            path: '/Applications',
            type: 'directory',
            icon: <Globe size={16} />,
            description: 'Installed applications',
            isAccessible: true
          },
          {
            name: 'Home Directory',
            path: '/Users/%USERNAME%',
            type: 'directory',
            icon: <Home size={16} />,
            description: 'User home directory',
            isAccessible: true
          }
        ];
      case 'linux':
        return [
          {
            name: 'Documents',
            path: '/home/%USERNAME%/Documents',
            type: 'directory',
            icon: <Folder size={16} />,
            description: 'User documents folder',
            isAccessible: true
          },
          {
            name: 'Desktop',
            path: '/home/%USERNAME%/Desktop',
            type: 'directory',
            icon: <Monitor size={16} />,
            description: 'Desktop folder',
            isAccessible: true
          },
          {
            name: 'Downloads',
            path: '/home/%USERNAME%/Downloads',
            type: 'directory',
            icon: <FolderOpen size={16} />,
            description: 'Downloaded files',
            isAccessible: true
          },
          {
            name: 'Home Directory',
            path: '/home/%USERNAME%',
            type: 'directory',
            icon: <Home size={16} />,
            description: 'User home directory',
            isAccessible: true
          },
          {
            name: 'Root Filesystem',
            path: '/',
            type: 'special',
            icon: <Globe size={16} />,
            description: 'Root filesystem',
            isAccessible: true
          }
        ];
      default:
        return [];
    }
  };

  const directories = getPlatformDirectories();

  const validatePath = (path: string): boolean => {
    if (!path || path.trim() === '') {
      setError('Please enter a valid path');
      return false;
    }

    // Basic path validation - more permissive
    const trimmedPath = path.trim();

    // Allow any non-empty string that doesn't contain obviously invalid characters
    const hasInvalidChars = /[<>|"?*\x00-\x1f]/.test(trimmedPath);
    const isTooShort = trimmedPath.length < 1;
    const isJustSpaces = /^\s*$/.test(trimmedPath);

    if (hasInvalidChars || isTooShort || isJustSpaces) {
      setError('Path contains invalid characters or is too short');
      return false;
    }

    // Platform-specific basic validation
    const platformCheck = (() => {
      switch (platform) {
        case 'windows':
          // Allow drive letters, UNC paths, relative paths, or simple folder names
          return /^[A-Za-z]:[\\/]?.*$/i.test(trimmedPath) ||  // C: or C:\ or C:\
                 /^\\\\[^\\]+\\.*/.test(trimmedPath) ||     // UNC paths \\server\
                 /^\.?[\\/]?.*/.test(trimmedPath) ||         // relative paths ./ ../ \
                 /^[a-zA-Z0-9_][a-zA-Z0-9_\s\-]*$/.test(trimmedPath); // simple names
        case 'macos':
        case 'linux':
          // Allow absolute paths, relative paths, or simple names
          return /^\/.*$/.test(trimmedPath) ||              // absolute paths
                 /^~.*$/.test(trimmedPath) ||               // home directory
                 /^\.?[\\/]?.*/.test(trimmedPath) ||        // relative paths
                 /^[a-zA-Z0-9_][a-zA-Z0-9_\s\-]*$/.test(trimmedPath); // simple names
        default:
          return true; // Allow anything for unknown platforms
      }
    })();

    if (!platformCheck) {
      const platformHint = (() => {
        switch (platform) {
          case 'windows':
            return 'Examples: C:\\Users\\Documents, Documents, .\\src, or \\\\server\\share';
          case 'macos':
            return 'Examples: /Users/username/Documents, ~/Documents, Documents, or ./src';
          case 'linux':
            return 'Examples: /home/username/Documents, ~/Documents, Documents, or ./src';
          default:
            return 'Enter a valid path for your system';
        }
      })();
      setError(`Invalid path format. ${platformHint}`);
      return false;
    }

    return true;
  };

  const handleDirectorySelect = async (directoryEntry: DirectoryEntry) => {
    if (!directoryEntry.isAccessible) {
      setError('This directory is not accessible on this system');
      return;
    }

    setCurrentPath(directoryEntry.path);
    setCustomPath(directoryEntry.path);
    setError('');
  };

  const handleCustomPathChange = (value: string) => {
    setCustomPath(value);
    setError('');
  };

  const handleNativeFilePicker = async () => {
    try {
      setLoading(true);
      setError('');

      // Use modern File System Access API if available
      if ('showDirectoryPicker' in window) {
        const directoryHandle = await (window as any).showDirectoryPicker({
          mode: 'read'
        });
        
        // Try to get the path from the handle
        const path = await getDirectoryPath(directoryHandle);
        setCurrentPath(path);
        setCustomPath(path);
        console.log('Selected directory via File System Access API:', path);
      } else {
        // Ultimate fallback - use input element
        const input = document.createElement('input');
        input.type = 'file';
        // @ts-ignore - webkitdirectory property
        input.webkitdirectory = true;
        // @ts-ignore - directory property
        input.directory = true;
        // @ts-ignore - mozdirectory property
        input.mozdirectory = true;
        
        input.addEventListener('change', (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const path = file.webkitRelativePath || file.name;
            setCurrentPath(path);
            setCustomPath(path);
            console.log('Selected directory via input element:', path);
          }
        });
        
        input.click();
      }
    } catch (error) {
      console.error('Failed to open native file picker:', error);
      setError('Failed to open file picker. Please enter path manually.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract path from directory handle
  const getDirectoryPath = async (directoryHandle: any): Promise<string> => {
    try {
      // For modern browsers, try to get the path
      if (directoryHandle.name) {
        return directoryHandle.name;
      }
      
      // For File System Access API, try to resolve the path
      if (directoryHandle.resolve) {
        const pathParts = [];
        let currentHandle = directoryHandle;
        
        while (currentHandle && currentHandle.name !== '/') {
          pathParts.unshift(currentHandle.name);
          if (currentHandle.parent) {
            currentHandle = await currentHandle.parent();
          } else {
            break;
          }
        }
        
        return '/' + pathParts.join('/');
      }
      
      return directoryHandle.name || 'Unknown';
    } catch (error) {
      console.warn('Could not resolve directory path:', error);
      return directoryHandle.name || 'Unknown';
    }
  };

  const handleSelect = async () => {
    const pathToUse = customPath || currentPath;
    
    if (!validatePath(pathToUse)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Simulate path validation (in real app, this would call backend)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onSelect(pathToUse);
      onClose();
      console.log('Directory selected for analysis:', pathToUse);
    } catch (err) {
      console.error('Directory selection failed:', err);
      setError('Failed to access directory. Please check path and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPath = (path: string): string => {
    // Replace environment variables with user-friendly names
    return path
      .replace(/%USERNAME%/g, platform === 'windows' ? 'User' : 'username')
      .replace(/C:\\\\/g, 'C:\\')
      .replace(/\\\\/g, '\\');
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerIcon}>
              <FolderOpen size={24} />
            </div>
            <div className={styles.headerText}>
              <h2 className={styles.title}>Select Directory for Analysis</h2>
              <p className={styles.subtitle}>
                Choose a directory to analyze with AI-powered insights
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close directory picker"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.content}>
            {/* Quick Access Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Search size={16} className={styles.sectionIcon} />
                Quick Access
              </h3>
              <div className={styles.directoryGrid}>
                {directories.map((directory) => (
                  <button
                    key={directory.path}
                    onClick={() => handleDirectorySelect(directory)}
                    disabled={!directory.isAccessible}
                    className={`${styles.directoryButton} ${
                      !directory.isAccessible ? styles.disabled : ''
                    } ${
                      (customPath || currentPath) === directory.path ? styles.selected : ''
                    }`}
                    title={directory.description}
                  >
                    <div className={styles.directoryIcon}>
                      {directory.icon}
                    </div>
                    <div className={styles.directoryInfo}>
                      <div className={styles.directoryName}>
                        {directory.name}
                      </div>
                      <div className={styles.directoryPath}>
                        {formatPath(directory.path)}
                      </div>
                    </div>
                    {!directory.isAccessible && (
                      <div className={styles.accessibilityWarning}>
                        <AlertCircle size={12} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Windows File Explorer Integration */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Monitor size={16} className={styles.sectionIcon} />
                Windows File Explorer Integration
              </h3>
              <div className={styles.explorerSection}>
                <div className={styles.explorerInfo}>
                  <div className={styles.explorerIcon}>
                    <Monitor size={14} className={styles.platformIcon} />
                  </div>
                  <div className={styles.explorerText}>
                    <div className={styles.explorerTitle}>Windows File Explorer</div>
                    <div className={styles.explorerDescription}>
                      <button
                        onClick={handleOpenExplorer}
                        className={styles.explorerButton}
                      >
                        <Monitor size={16} />
                        Open File Picker
                      </button>
                      <p style={{ fontSize: '12px', margin: '8px 0 0 0', color: '#64748b' }}>
                        Use the modern file picker to select a directory
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Path Input */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Terminal size={16} className={styles.sectionIcon} />
                Custom Path
              </h3>
              <div className={styles.customPathSection}>
                <div className={styles.inputGroup}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={customPath}
                    onChange={(e) => handleCustomPathChange(e.target.value)}
                    placeholder={
                      platform === 'windows' 
                        ? 'C:\\Users\\YourName\\Documents'
                        : platform === 'macos'
                        ? '/Users/username/Documents'
                        : '/home/username/Documents'
                    }
                    className={`${styles.pathInput} ${
                      error ? styles.inputError : ''
                    }`}
                    aria-label="Custom directory path"
                  />
                  <button
                    onClick={handleNativeFilePicker}
                    disabled={loading}
                    className={styles.browseButton}
                    title="Open native file picker"
                  >
                    {loading ? (
                      <div className={styles.spinner} />
                    ) : (
                      <FolderOpen size={16} />
                    )}
                  </button>
                </div>
                
                {/* Path Examples */}
                <div className={styles.pathExamples}>
                  <div className={styles.examplesTitle}>Example paths:</div>
                  <div className={styles.examplesGrid}>
                    {platform === 'windows' && (
                      <>
                        <div className={styles.example}>
                          <code>C:\Users\Public\Documents</code>
                        </div>
                        <div className={styles.example}>
                          <code>D:\Projects</code>
                        </div>
                        <div className={styles.example}>
                          <code>.\src</code>
                        </div>
                      </>
                    )}
                    {platform === 'macos' && (
                      <>
                        <div className={styles.example}>
                          <code>/Users/username/Documents</code>
                        </div>
                        <div className={styles.example}>
                          <code>~/Documents</code>
                        </div>
                        <div className={styles.example}>
                          <code>/Applications</code>
                        </div>
                      </>
                    )}
                    {platform === 'linux' && (
                      <>
                        <div className={styles.example}>
                          <code>/home/username/Documents</code>
                        </div>
                        <div className={styles.example}>
                          <code>~/Documents</code>
                        </div>
                        <div className={styles.example}>
                          <code>/</code>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className={styles.errorSection}>
                <div className={styles.errorIcon}>
                  <AlertCircle size={16} />
                </div>
                <div className={styles.errorMessage}>
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.platformInfo}>
              <Monitor size={14} className={styles.platformIcon} />
              <span className={styles.platformText}>
                {platform === 'windows' ? 'Windows' : platform === 'macos' ? 'macOS' : 'Linux'}
              </span>
            </div>
            <div className={styles.footerActions}>
              <button
                onClick={onClose}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                disabled={loading || (!customPath && !currentPath)}
                className={styles.selectButton}
              >
                {loading ? (
                  <>
                    <div className={styles.buttonSpinner} />
                    Selecting...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Select Directory
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectoryPicker;