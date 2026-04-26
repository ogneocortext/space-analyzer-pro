import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Download, RefreshCw, X, ChevronDown } from 'lucide-react';
import styles from './EnhancedDataGrid.module.css';

interface Column {
  key: string;
  title: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface EnhancedDataGridProps {
  data: any[];
  columns: Column[];
  title?: string;
  subtitle?: string;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  expandable?: boolean;
  loading?: boolean;
  onRowClick?: (row: any) => void;
  onExport?: (data: any[]) => void;
  onRefresh?: () => void;
  emptyState?: React.ReactNode;
}

const EnhancedDataGrid: React.FC<EnhancedDataGridProps> = ({
  data,
  columns,
  title,
  subtitle,
  searchable = true,
  filterable = true,
  sortable = true,
  expandable = true,
  loading = false,
  onRowClick,
  onExport,
  onRefresh,
  emptyState
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value && String(value).toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }

    // Apply filters
    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(row => values.includes(String(row[key])));
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, selectedFilters, sortConfig, columns]);

  const handleSort = useCallback((key: string) => {
    if (!sortable) return;
    
    setSortConfig(prev => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  }, [sortable]);

  const handleRowExpand = useCallback((rowId: string | number) => {
    if (!expandable) return;
    
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  }, [expandable]);

  const handleFilterChange = useCallback((columnKey: string, value: string) => {
    setSelectedFilters(prev => {
      const currentFilters = prev[columnKey] || [];
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter(v => v !== value)
        : [...currentFilters, value];
      
      return {
        ...prev,
        [columnKey]: newFilters
      };
    });
  }, []);

  const getUniqueValues = useCallback((columnKey: string) => {
    const values = data.map(row => String(row[columnKey])).filter(Boolean);
    return Array.from(new Set(values)).sort();
  }, [data]);

  const formatValue = useCallback((value: any, column: Column, row: any) => {
    if (column.render) {
      return column.render(value, row);
    }
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    return String(value);
  }, []);

  if (loading) {
    return (
      <div className={styles.dataGridContainer}>
        <div className={styles.loadingState}>
          <RefreshCw className={styles.loadingSpinner} />
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dataGridContainer}>
      {/* Header */}
      {(title || searchable || filterable) && (
        <div className={styles.gridHeader}>
          <div className={styles.headerLeft}>
            {title && (
              <div className={styles.titleSection}>
                <h3 className={styles.gridTitle}>{title}</h3>
                {subtitle && <p className={styles.gridSubtitle}>{subtitle}</p>}
              </div>
            )}
          </div>
          
          <div className={styles.headerRight}>
            {searchable && (
              <div className={styles.searchContainer}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className={styles.clearButton}
                  >
                    <X className={styles.clearIcon} />
                  </button>
                )}
              </div>
            )}
            
            {filterable && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`${styles.filterButton} ${showFilters ? styles.active : ''}`}
              >
                <Filter className={styles.filterIcon} />
                Filters
                {Object.values(selectedFilters).some(filters => filters.length > 0) && (
                  <span className={styles.filterBadge}>
                    {Object.values(selectedFilters).reduce((sum, filters) => sum + filters.length, 0)}
                  </span>
                )}
              </button>
            )}
            
            {onExport && (
              <button
                onClick={() => onExport(processedData)}
                className={styles.exportButton}
              >
                <Download className={styles.exportIcon} />
                Export
              </button>
            )}
            
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={styles.refreshButton}
              >
                <RefreshCw className={styles.refreshIcon} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && filterable && (
          <motion.div
            className={styles.filtersPanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className={styles.filtersContent}>
              {columns.map(column => {
                const uniqueValues = getUniqueValues(column.key);
                if (uniqueValues.length === 0) return null;
                
                return (
                  <div key={column.key} className={styles.filterColumn}>
                    <h4 className={styles.filterColumnTitle}>{column.title}</h4>
                    <div className={styles.filterOptions}>
                      {uniqueValues.map(value => (
                        <label key={value} className={styles.filterOption}>
                          <input
                            type="checkbox"
                            checked={selectedFilters[column.key]?.includes(value) || false}
                            onChange={() => handleFilterChange(column.key, value)}
                            className={styles.filterCheckbox}
                          />
                          <span className={styles.filterLabel}>{value}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table */}
      <div className={styles.tableContainer}>
        {processedData.length === 0 ? (
          <div className={styles.emptyState}>
            {emptyState || (
              <div className={styles.defaultEmptyState}>
                <div className={styles.emptyIcon}>
                  <Search className={styles.emptySearchIcon} />
                </div>
                <h4>No data found</h4>
                <p>Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        ) : (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                    className={`${styles.tableHeader} ${sortable && column.sortable ? styles.sortable : ''}`}
                    onClick={() => sortable && column.sortable && handleSort(column.key)}
                  >
                    <div className={styles.headerContent}>
                      <span>{column.title}</span>
                      {sortable && column.sortable && (
                        <div className={styles.sortIndicator}>
                          <ChevronDown 
                            className={`${styles.sortIcon} ${
                              sortConfig?.key === column.key 
                                ? sortConfig.direction === 'desc' ? styles.desc : styles.asc
                                : ''
                            }`} 
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                {expandable && <th className={styles.expandColumn} />}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {processedData.map((row, index) => {
                  const rowId = row.id || index;
                  const isExpanded = expandedRows.has(rowId);
                  
                  return (
                    <React.Fragment key={rowId}>
                      <motion.tr
                        className={`${styles.tableRow} ${onRowClick ? styles.clickable : ''}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => onRowClick?.(row)}
                      >
                        {columns.map(column => (
                          <td key={column.key} className={styles.tableCell}>
                            {formatValue(row[column.key], column, row)}
                          </td>
                        ))}
                        {expandable && (
                          <td className={styles.expandCell}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowExpand(rowId);
                              }}
                              className={styles.expandButton}
                              aria-expanded={isExpanded}
                              aria-label={`Expand row ${index + 1}`}
                            >
                              <ChevronDown className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`} />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                      
                      {expandable && isExpanded && (
                        <motion.tr
                          className={styles.expandedRow}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <td colSpan={columns.length + 1} className={styles.expandedCell}>
                            <div className={styles.expandedContent}>
                              <h4 className={styles.expandedTitle}>Detailed Information</h4>
                              <div className={styles.expandedDetails}>
                                {columns.map(column => (
                                  <div key={column.key} className={styles.detailRow}>
                                    <span className={styles.detailLabel}>{column.title}:</span>
                                    <span className={styles.detailValue}>
                                      {formatValue(row[column.key], column, row)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className={styles.gridFooter}>
        <div className={styles.footerLeft}>
          <span className={styles.recordCount}>
            {processedData.length} of {data.length} records
          </span>
        </div>
        <div className={styles.footerRight}>
          {Object.values(selectedFilters).some(filters => filters.length > 0) && (
            <button
              onClick={() => setSelectedFilters({})}
              className={styles.clearFiltersButton}
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedDataGrid;
