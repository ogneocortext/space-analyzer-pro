import React, { FC, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Layers, Grid, Activity, Search, Download, Settings2 } from 'lucide-react';

interface NeuralControlsProps {
  onToggleMode: (mode: 'network' | 'heatmap' | 'graph') => void;
  onSimulationControl: (action: 'toggle' | 'reset') => void;
  onToggleConnections: (enabled: boolean) => void;
  onToggleLabels: (enabled: boolean) => void;
  onSearch?: (query: string) => void;
  onExport?: (format: 'png' | 'svg' | 'json') => void;
  onSettings?: () => void;
  activeMode: 'network' | 'heatmap' | 'graph';
  simulationState: 'running' | 'paused';
  connectionsEnabled: boolean;
  labelsEnabled: boolean;
  searchQuery?: string;
}

const NeuralControls: FC<NeuralControlsProps> = ({
  onToggleMode,
  onSimulationControl,
  onToggleConnections,
  onToggleLabels,
  onSearch,
  onExport,
  onSettings,
  activeMode,
  simulationState,
  connectionsEnabled,
  labelsEnabled,
  searchQuery = ''
}) => {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement) return;

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault();
          onSimulationControl('toggle');
          break;
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onSimulationControl('reset');
          }
          break;
        case '1':
          event.preventDefault();
          onToggleMode('network');
          break;
        case '2':
          event.preventDefault();
          onToggleMode('heatmap');
          break;
        case '3':
          event.preventDefault();
          onToggleMode('graph');
          break;
        case 'c':
          event.preventDefault();
          onToggleConnections(!connectionsEnabled);
          break;
        case 'l':
          event.preventDefault();
          onToggleLabels(!labelsEnabled);
          break;
        case 'f':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Focus search input if available
            const searchInput = document.querySelector('.neural-search-input') as HTMLInputElement;
            searchInput?.focus();
          }
          break;
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onExport?.('png');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMode, onSimulationControl, onToggleConnections, onToggleLabels, onExport, connectionsEnabled, labelsEnabled]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch?.(e.target.value);
  }, [onSearch]);
  return (
    <div className="neural-controls-container">
      {/* Group 1: Visualization Modes */}
      <div className="control-group">
        <span className="group-label">VISUALIZATION MODE</span>
        <div className="button-group">
          <button
            className={`cyber-btn ${activeMode === 'network' ? 'active' : ''}`}
            onClick={() => onToggleMode('network')}
            aria-label="Network view (1)"
            title="Network view (1)"
          >
            <Activity size={16} /> NETWORK
          </button>
          <button
            className={`cyber-btn ${activeMode === 'heatmap' ? 'active' : ''}`}
            onClick={() => onToggleMode('heatmap')}
            aria-label="Heatmap view (2)"
            title="Heatmap view (2)"
          >
            <Layers size={16} /> HEATMAP
          </button>
          <button
            className={`cyber-btn ${activeMode === 'graph' ? 'active' : ''}`}
            onClick={() => onToggleMode('graph')}
            aria-label="Graph view (3)"
            title="Graph view (3)"
          >
            <Grid size={16} /> GRAPH
          </button>
        </div>
      </div>

      {/* Group 2: Simulation Physics */}
      <div className="control-group">
        <span className="group-label">SIMULATION</span>
        <div className="icon-group">
          <button
            className="cyber-icon-btn"
            onClick={() => onSimulationControl('toggle')}
            aria-label={simulationState === 'running' ? 'Pause simulation (Space)' : 'Play simulation (Space)'}
            title={simulationState === 'running' ? 'Pause simulation (Space)' : 'Play simulation (Space)'}
          >
            {simulationState === 'running' ? <Pause /> : <Play />}
          </button>
          <button
            className="cyber-icon-btn"
            onClick={() => onSimulationControl('reset')}
            aria-label="Reset simulation (Ctrl+R)"
            title="Reset simulation (Ctrl+R)"
          >
            <RotateCcw />
          </button>
        </div>
      </div>

      {/* Group 3: Overlays */}
      <div className="control-group">
        <span className="group-label">OVERLAYS</span>
        <div className="toggle-row">
            <label className="cyber-toggle">
                <input
                  type="checkbox"
                  checked={connectionsEnabled}
                  onChange={(e) => onToggleConnections(e.target.checked)}
                />
                <span className="toggle-text" title="Toggle connections (C)">CONNECTIONS</span>
            </label>
            <label className="cyber-toggle">
                <input
                  type="checkbox"
                  checked={labelsEnabled}
                  onChange={(e) => onToggleLabels(e.target.checked)}
                />
                <span className="toggle-text" title="Toggle labels (L)">LABELS</span>
            </label>
        </div>
      </div>

      {/* Group 4: Tools */}
      <div className="control-group">
        <span className="group-label">TOOLS</span>
        <div className="icon-group">
          {onSearch && (
            <div className="search-container">
              <input
                type="text"
                className="neural-search-input"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={handleSearchChange}
                aria-label="Search neural nodes (Ctrl+F)"
                title="Search neural nodes (Ctrl+F)"
              />
              <Search size={14} />
            </div>
          )}
          {onExport && (
            <button
              className="cyber-icon-btn"
              onClick={() => onExport('png')}
              aria-label="Export visualization (Ctrl+S)"
              title="Export visualization (Ctrl+S)"
            >
              <Download size={16} />
            </button>
          )}
          {onSettings && (
            <button
              className="cyber-icon-btn"
              onClick={onSettings}
              aria-label="Neural settings"
              title="Neural settings"
            >
              <Settings2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NeuralControls;