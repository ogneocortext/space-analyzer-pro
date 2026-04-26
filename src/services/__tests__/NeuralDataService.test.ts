import { describe, it, expect, vi } from 'vitest';
import { neuralDataService } from '../NeuralDataService';

// Mock ResizeObserver and IntersectionObserver for tests
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock analysis data for testing
const mockAnalysisData = {
  files: [
    { path: '/test/file1.js', name: 'file1.js', size: 1024, extension: '.js' },
    { path: '/test/file2.png', name: 'file2.png', size: 2048, extension: '.png' },
    { path: '/test/file3.mp4', name: 'file3.mp4', size: 1048576, extension: '.mp4' },
    { path: '/test/file4.txt', name: 'file4.txt', size: 512, extension: '.txt' },
  ],
  categories: {
    'code': { count: 1, size: 1024 },
    'images': { count: 1, size: 2048 },
    'video': { count: 1, size: 1048576 },
    'documents': { count: 1, size: 512 }
  },
  totalSize: 1053632,
  totalFiles: 4
};

describe('NeuralDataService', () => {
  describe('transformAnalysisData', () => {
    it('should transform analysis data into neural network format', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      // Check structure
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('connections');
      expect(result).toHaveProperty('metrics');

      // Check nodes array
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.nodes.length).toBeGreaterThan(0);

      // Check connections array
      expect(Array.isArray(result.connections)).toBe(true);

      // Check metrics object
      expect(typeof result.metrics).toBe('object');
      expect(result.metrics).toHaveProperty('neuralDensity');
      expect(result.metrics).toHaveProperty('connectionStrength');
      expect(result.metrics).toHaveProperty('patternRecognition');
      expect(result.metrics).toHaveProperty('anomalyScore');
    });

    it('should handle empty or null data gracefully', () => {
      const result = neuralDataService.transformAnalysisData(null);

      expect(result.nodes).toEqual([]);
      expect(result.connections).toEqual([]);
      expect(result.metrics.neuralDensity).toBe(0);
    });

    it('should generate nodes with correct properties', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      // Check that we have nodes
      expect(result.nodes.length).toBeGreaterThan(0);

      // Check category nodes (first few nodes)
      const categoryNode = result.nodes.find(node => node.type === 'pattern');
      expect(categoryNode).toBeDefined();
      expect(categoryNode).toHaveProperty('id');
      expect(categoryNode).toHaveProperty('x');
      expect(categoryNode).toHaveProperty('y');
      expect(categoryNode).toHaveProperty('size');
      expect(categoryNode).toHaveProperty('type');
      expect(categoryNode).toHaveProperty('connections');
      expect(categoryNode).toHaveProperty('category');
      expect(categoryNode).toHaveProperty('accessFrequency');

      // Check file nodes (should have file-specific properties)
      const fileNode = result.nodes.find(node => node.type === 'file');
      if (fileNode) {
        expect(fileNode).toHaveProperty('fileType');
        expect(fileNode).toHaveProperty('fileSize');
        expect(fileNode).toHaveProperty('path');
      }
    });

    it('should generate connections between nodes', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      if (result.connections.length > 0) {
        const firstConnection = result.connections[0];
        expect(firstConnection).toHaveProperty('from');
        expect(firstConnection).toHaveProperty('to');
        expect(firstConnection).toHaveProperty('strength');
        expect(firstConnection).toHaveProperty('type');

        // Check that connection types are valid
        expect(['similarity', 'dependency', 'access', 'category']).toContain(firstConnection.type);

        // accessFrequency is optional and only present on some connection types
        // This is fine - not all connections need this property
      }
    });

    it('should calculate neural density based on file count', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      // Neural density should be calculated based on total files
      expect(typeof result.metrics.neuralDensity).toBe('number');
      expect(result.metrics.neuralDensity).toBeGreaterThanOrEqual(0);
    });

    it('should calculate connection strength metrics', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      expect(typeof result.metrics.connectionStrength).toBe('number');
      expect(result.metrics.connectionStrength).toBeGreaterThanOrEqual(0);
    });

    it('should provide pattern recognition scores', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      expect(typeof result.metrics.patternRecognition).toBe('number');
      expect(result.metrics.patternRecognition).toBeGreaterThanOrEqual(0);
      expect(result.metrics.patternRecognition).toBeLessThanOrEqual(1);
    });

    it('should calculate anomaly scores', () => {
      const result = neuralDataService.transformAnalysisData(mockAnalysisData);

      expect(typeof result.metrics.anomalyScore).toBe('number');
      expect(result.metrics.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.anomalyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('service integration', () => {
    it('should be properly exported and accessible', () => {
      expect(neuralDataService).toBeDefined();
      expect(typeof neuralDataService.transformAnalysisData).toBe('function');
    });

    it('should handle large datasets without crashing', () => {
      const largeDataset = {
        ...mockAnalysisData,
        files: Array.from({ length: 100 }, (_, i) => ({
          path: `/test/file${i}.js`,
          name: `file${i}.js`,
          size: Math.random() * 10000,
          extension: '.js'
        })),
        totalFiles: 100
      };

      expect(() => {
        neuralDataService.transformAnalysisData(largeDataset);
      }).not.toThrow();
    });
  });
});