/**
 * AI Suggestions Composable - Generates proactive suggestions based on analysis data
 * Extracted from EnhancedAIChat.vue for better separation of concerns
 */

import { ref, computed, watch } from 'vue';
import { useDebugLogger } from '../utils/DebugUtils';
import { formatFileSize } from '../utils/FileUtils';
import type { AnalysisData } from '../services/AIChatService';

const logger = useDebugLogger('useAISuggestions');

export interface AISuggestion {
  id: string;
  type: string;
  icon: string;
  title: string;
  description: string;
  action: string;
  prompt: string;
  priority: 'low' | 'medium' | 'high';
  category: 'storage' | 'performance' | 'organization' | 'security';
  estimatedImpact?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface UseAISuggestionsOptions {
  analysisData?: AnalysisData;
  maxSuggestions?: number;
  enableProactiveSuggestions?: boolean;
}

/**
 * AI Suggestions Composable
 */
export function useAISuggestions(options: UseAISuggestionsOptions = {}) {
  // State
  const suggestions = ref<AISuggestion[]>([]);
  const isLoading = ref(false);
  const lastAnalysisData = ref<AnalysisData | null>(null);
  
  // Configuration
  const maxSuggestions = options.maxSuggestions || 8;
  const enableProactiveSuggestions = options.enableProactiveSuggestions !== false;

  // Computed properties
  const hasSuggestions = computed(() => suggestions.value.length > 0);
  const suggestionCount = computed(() => suggestions.value.length);
  
  const suggestionsByCategory = computed(() => {
    const categorized: Record<string, AISuggestion[]> = {};
    
    suggestions.value.forEach(suggestion => {
      if (!categorized[suggestion.category]) {
        categorized[suggestion.category] = [];
      }
      categorized[suggestion.category].push(suggestion);
    });
    
    return categorized;
  });
  
  const highPrioritySuggestions = computed(() => 
    suggestions.value.filter(s => s.priority === 'high')
  );
  
  const storageSuggestions = computed(() => 
    suggestions.value.filter(s => s.category === 'storage')
  );
  
  const performanceSuggestions = computed(() => 
    suggestions.value.filter(s => s.category === 'performance')
  );

  // Methods
  const generateSuggestions = (analysisData: AnalysisData) => {
    logger.info('Generating AI suggestions', { 
      totalSize: analysisData.totalSize, 
      fileCount: analysisData.files?.length 
    });
    
    isLoading.value = true;
    lastAnalysisData.value = analysisData;
    
    try {
      const newSuggestions: AISuggestion[] = [];
      
      // Large files analysis
      const largeFilesSuggestion = generateLargeFilesSuggestion(analysisData);
      if (largeFilesSuggestion) newSuggestions.push(largeFilesSuggestion);
      
      // Old files analysis
      const oldFilesSuggestion = generateOldFilesSuggestion(analysisData);
      if (oldFilesSuggestion) newSuggestions.push(oldFilesSuggestion);
      
      // Code project analysis
      const codeProjectSuggestion = generateCodeProjectSuggestion(analysisData);
      if (codeProjectSuggestion) newSuggestions.push(codeProjectSuggestion);
      
      // Duplicate files analysis
      const duplicateFilesSuggestion = generateDuplicateFilesSuggestion(analysisData);
      if (duplicateFilesSuggestion) newSuggestions.push(duplicateFilesSuggestion);
      
      // Storage optimization
      const storageOptimizationSuggestion = generateStorageOptimizationSuggestion(analysisData);
      if (storageOptimizationSuggestion) newSuggestions.push(storageOptimizationSuggestion);
      
      // Performance optimization
      const performanceSuggestion = generatePerformanceSuggestion(analysisData);
      if (performanceSuggestion) newSuggestions.push(performanceSuggestion);
      
      // Organization suggestions
      const organizationSuggestion = generateOrganizationSuggestion(analysisData);
      if (organizationSuggestion) newSuggestions.push(organizationSuggestion);
      
      // Security suggestions
      const securitySuggestion = generateSecuritySuggestion(analysisData);
      if (securitySuggestion) newSuggestions.push(securitySuggestion);
      
      // Sort by priority and limit
      suggestions.value = newSuggestions
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, maxSuggestions);
      
      logger.info('AI suggestions generated', { 
        count: suggestions.value.length,
        categories: [...new Set(suggestions.value.map(s => s.category))]
      });
      
    } catch (error) {
      logger.error('Failed to generate suggestions', error);
    } finally {
      isLoading.value = false;
    }
  };

  const generateLargeFilesSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    const largeFiles = files.filter(f => f.size > 100 * 1024 * 1024); // > 100MB
    
    if (largeFiles.length === 0) return null;
    
    const totalLargeSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
    
    return {
      id: 'large-files',
      type: 'large_files',
      icon: '📁',
      title: `${largeFiles.length} Large Files Found`,
      description: `Files over 100MB taking up ${formatFileSize(totalLargeSize)} of space`,
      action: 'Analyze large files',
      prompt: 'Analyze these large files and suggest optimization strategies.',
      priority: totalLargeSize > 1024 * 1024 * 1024 ? 'high' : 'medium', // > 1GB = high priority
      category: 'storage',
      estimatedImpact: `Could free up ${formatFileSize(totalLargeSize * 0.3)}`,
      difficulty: 'medium',
    };
  };

  const generateOldFilesSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    
    const oldFiles = files.filter(f => {
      if (!f.modified) return false;
      const modifiedTime = new Date(f.modified).getTime();
      return modifiedTime < oneYearAgo;
    });
    
    if (oldFiles.length === 0 || oldFiles.length < files.length * 0.2) return null; // Less than 20% old files
    
    return {
      id: 'old-files',
      type: 'archival_candidates',
      icon: '📦',
      title: 'Archive Candidates',
      description: `${oldFiles.length} files not modified in over a year`,
      action: 'Review archival options',
      prompt: 'Review old files and suggest archiving strategies.',
      priority: 'medium',
      category: 'organization',
      estimatedImpact: `Could free up ${formatFileSize(oldFiles.reduce((sum, f) => sum + f.size, 0) * 0.5)}`,
      difficulty: 'easy',
    };
  };

  const generateCodeProjectSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    const codeExtensions = ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];
    
    const codeFiles = files.filter(f => 
      codeExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
    );
    
    if (codeFiles.length === 0) return null;
    
    const totalCodeSize = codeFiles.reduce((sum, f) => sum + f.size, 0);
    const languages = [...new Set(codeFiles.map(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ext?.toUpperCase();
    }))];
    
    return {
      id: 'code-project',
      type: 'code_analysis',
      icon: '💻',
      title: 'Code Project Detected',
      description: `${codeFiles.length} code files (${languages.join(', ')})`,
      action: 'Analyze code structure',
      prompt: 'Analyze this code project and suggest optimization strategies.',
      priority: 'medium',
      category: 'performance',
      estimatedImpact: 'Improved code organization and performance',
      difficulty: 'medium',
    };
  };

  const generateDuplicateFilesSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    
    // Simple duplicate detection by name and size
    const fileGroups: Record<string, typeof files> = {};
    
    files.forEach(file => {
      const key = `${file.name}_${file.size}`;
      if (!fileGroups[key]) {
        fileGroups[key] = [];
      }
      fileGroups[key].push(file);
    });
    
    const duplicateGroups = Object.values(fileGroups).filter(group => group.length > 1);
    
    if (duplicateGroups.length === 0) return null;
    
    const totalDuplicateSize = duplicateGroups.reduce((sum, group) => {
      return sum + (group.length - 1) * group[0].size; // Size of duplicates (excluding one copy)
    }, 0);
    
    return {
      id: 'duplicate-files',
      type: 'duplicates',
      icon: '🔄',
      title: 'Duplicate Files Found',
      description: `${duplicateGroups.length} groups of duplicate files`,
      action: 'Remove duplicates',
      prompt: 'Analyze duplicate files and suggest removal strategies.',
      priority: totalDuplicateSize > 500 * 1024 * 1024 ? 'high' : 'medium', // > 500MB = high priority
      category: 'storage',
      estimatedImpact: `Could free up ${formatFileSize(totalDuplicateSize)}`,
      difficulty: 'easy',
    };
  };

  const generateStorageOptimizationSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const totalSize = analysisData.totalSize || 0;
    const fileCount = analysisData.files?.length || 0;
    
    if (totalSize < 1024 * 1024 * 1024) return null; // Less than 1GB
    
    const efficiency = fileCount > 0 ? totalSize / fileCount : 0;
    const needsOptimization = efficiency > 10 * 1024 * 1024; // Average file > 10MB
    
    return {
      id: 'storage-optimization',
      type: 'optimization',
      icon: '⚡',
      title: 'Storage Optimization',
      description: `Optimize ${formatFileSize(totalSize)} across ${fileCount} files`,
      action: 'Optimize storage',
      prompt: 'Suggest storage optimization strategies for this dataset.',
      priority: needsOptimization ? 'high' : 'medium',
      category: 'storage',
      estimatedImpact: `Could save ${formatFileSize(totalSize * 0.2)}`,
      difficulty: 'medium',
    };
  };

  const generatePerformanceSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    const totalSize = analysisData.totalSize || 0;
    
    // Check for performance issues
    const deepDirectories = files.filter(f => f.name.includes('/') || f.name.includes('\\')).length;
    const manySmallFiles = files.filter(f => f.size < 1024).length;
    
    if (deepDirectories < files.length * 0.1 && manySmallFiles < files.length * 0.3) return null;
    
    return {
      id: 'performance',
      type: 'performance',
      icon: '🚀',
      title: 'Performance Optimization',
      description: 'Improve file access and scanning performance',
      action: 'Optimize performance',
      prompt: 'Suggest performance improvements for file operations.',
      priority: 'medium',
      category: 'performance',
      estimatedImpact: 'Faster file operations and scanning',
      difficulty: 'medium',
    };
  };

  const generateOrganizationSuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    
    // Check for disorganized file structure
    const extensions = [...new Set(files.map(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ext || 'no-extension';
    }))];
    
    if (extensions.length < 5) return null; // Well organized
    
    return {
      id: 'organization',
      type: 'organization',
      icon: '🗂️',
      title: 'File Organization',
      description: `${extensions.length} different file types detected`,
      action: 'Organize files',
      prompt: 'Suggest file organization strategies.',
      priority: 'low',
      category: 'organization',
      estimatedImpact: 'Better file management and navigation',
      difficulty: 'easy',
    };
  };

  const generateSecuritySuggestion = (analysisData: AnalysisData): AISuggestion | null => {
    const files = analysisData.files || [];
    
    // Check for potentially sensitive files
    const sensitiveExtensions = ['.key', '.pem', '.p12', '.pfx', '.password', '.secret'];
    const sensitiveFiles = files.filter(f => 
      sensitiveExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
    );
    
    if (sensitiveFiles.length === 0) return null;
    
    return {
      id: 'security',
      type: 'security',
      icon: '🔒',
      title: 'Security Review',
      description: `${sensitiveFiles.length} potentially sensitive files found`,
      action: 'Review security',
      prompt: 'Review sensitive files and suggest security measures.',
      priority: 'high',
      category: 'security',
      estimatedImpact: 'Improved data security',
      difficulty: 'easy',
    };
  };

  const refreshSuggestions = () => {
    if (lastAnalysisData.value) {
      generateSuggestions(lastAnalysisData.value);
    }
  };

  const clearSuggestions = () => {
    suggestions.value = [];
    logger.info('Suggestions cleared');
  };

  const getSuggestionById = (id: string): AISuggestion | undefined => {
    return suggestions.value.find(s => s.id === id);
  };

  const getSuggestionsByCategory = (category: string): AISuggestion[] => {
    return suggestions.value.filter(s => s.category === category);
  };

  const getSuggestionsByPriority = (priority: 'low' | 'medium' | 'high'): AISuggestion[] => {
    return suggestions.value.filter(s => s.priority === priority);
  };

  // Watch for analysis data changes
  watch(() => options.analysisData, (newData) => {
    if (newData && enableProactiveSuggestions) {
      generateSuggestions(newData);
    }
  }, { immediate: true, deep: true });

  // Initialize
  if (options.analysisData && enableProactiveSuggestions) {
    generateSuggestions(options.analysisData);
  }

  return {
    // State
    suggestions,
    isLoading,
    lastAnalysisData,
    
    // Computed
    hasSuggestions,
    suggestionCount,
    suggestionsByCategory,
    highPrioritySuggestions,
    storageSuggestions,
    performanceSuggestions,
    
    // Methods
    generateSuggestions,
    refreshSuggestions,
    clearSuggestions,
    getSuggestionById,
    getSuggestionsByCategory,
    getSuggestionsByPriority,
  };
}