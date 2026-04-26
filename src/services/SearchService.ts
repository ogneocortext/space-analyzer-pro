import { bridge } from './AnalysisBridge';

export interface SearchResult {
  name: string;
  path: string;
  size: number;
  category: string;
  extension: string;
  modified: string;
  _searchScore?: number;
  _matchType?: string;
}

export interface SearchOptions {
  includeSemantic?: boolean;
  limit?: number;
  batchSize?: number;
}

export class SearchService {
  /**
   * Search for files using the advanced search API
   */
  async searchFiles(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${bridge.baseUrl}/search/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          files: [], // Files will be populated by the AI chat system
          options: {
            includeSemantic: options.includeSemantic || false,
            limit: options.limit || 20,
            batchSize: options.batchSize || 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Search service error:', error);
      return [];
    }
  }

  /**
   * Search for files with AI context awareness
   */
  async searchWithAIContext(query: string, files: any[], options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      // Ensure files are properly formatted
      const formattedFiles = files.map(file => ({
        name: file.name || file.path?.split(/[/\\]/).pop() || 'unknown',
        path: file.path || file.fullPath || '',
        size: file.size || 0,
        category: file.category || 'unknown',
        extension: file.extension || file.name?.split('.').pop() || '',
        modified: file.modified || file.modified_ts || new Date().toISOString()
      }));

      const response = await fetch(`${bridge.baseUrl}/search/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          files: formattedFiles,
          options: {
            includeSemantic: options.includeSemantic || true,
            limit: options.limit || 20,
            batchSize: options.batchSize || 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('AI context search error:', error);
      return [];
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(query: string, files: any[]): Promise<string[]> {
    // Simple suggestion logic based on file names and categories
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    // Category-based suggestions
    if (files.length > 0) {
      const categories = [...new Set(files.map(f => f.category))];
      const matchingCategories = categories.filter(cat => 
        cat.toLowerCase().includes(queryLower)
      );
      
      matchingCategories.forEach(cat => {
        suggestions.push(`Show me all ${cat} files`);
        suggestions.push(`What's in the ${cat} category?`);
      });
    }

    // Extension-based suggestions
    const extensions = [...new Set(files.map(f => f.extension))];
    const matchingExtensions = extensions.filter(ext => 
      ext.toLowerCase().includes(queryLower)
    );
    
    matchingExtensions.forEach(ext => {
      suggestions.push(`Find all ${ext} files`);
    });

    // Size-based suggestions
    if (queryLower.includes('large') || queryLower.includes('big')) {
      suggestions.push('Show me the largest files');
      suggestions.push('Find files larger than 100MB');
    }

    if (queryLower.includes('small') || queryLower.includes('tiny')) {
      suggestions.push('Show me the smallest files');
      suggestions.push('Find files smaller than 1KB');
    }

    // Date-based suggestions
    if (queryLower.includes('recent') || queryLower.includes('new')) {
      suggestions.push('Show recently modified files');
      suggestions.push('Find files from last week');
    }

    if (queryLower.includes('old') || queryLower.includes('previous')) {
      suggestions.push('Show oldest files');
      suggestions.push('Find files older than 1 year');
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Format search results for display
   */
  formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No files found matching your search criteria.';
    }

    let response = `Found ${results.length} file(s):\n\n`;
    
    results.slice(0, 10).forEach((file, index) => {
      response += `${index + 1}. **${file.name}**\n`;
      response += `   📁 Path: ${file.path}\n`;
      response += `   📊 Size: ${this.formatFileSize(file.size)}\n`;
      response += `   📂 Category: ${file.category}\n`;
      response += `   📅 Modified: ${new Date(file.modified).toLocaleDateString()}\n`;
      response += `   🔍 Match: ${file._matchType}\n`;
      response += `   ⭐ Score: ${file._searchScore}\n\n`;
    });

    if (results.length > 10) {
      response += `... and ${results.length - 10} more files.\n`;
    }

    return response;
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const searchService = new SearchService();
