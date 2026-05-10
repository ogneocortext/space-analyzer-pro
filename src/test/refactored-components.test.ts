/**
 * Test file for refactored components
 * This file tests the basic functionality of our new modular components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataPersistenceManager } from '../utils/DataPersistence';
import { FileSizeFormatter, FilePathUtils, FileTypeDetector } from '../utils/FileUtils';
import { DebugLogger } from '../utils/DebugUtils';

describe('DataPersistenceManager', () => {
  let persistence: DataPersistenceManager;

  beforeEach(() => {
    persistence = new DataPersistenceManager('test');
    persistence.clear();
  });

  it('should save and load data correctly', () => {
    const testData = { message: 'Hello World', count: 42 };
    const saved = persistence.save('test-key', testData);
    
    expect(saved).toBe(true);
    
    const loaded = persistence.load('test-key');
    expect(loaded).toEqual(testData);
  });

  it('should return null for non-existent keys', () => {
    const loaded = persistence.load('non-existent-key');
    expect(loaded).toBe(null);
  });

  it('should check if data exists', () => {
    expect(persistence.exists('test-key')).toBe(false);
    
    persistence.save('test-key', { data: 'test' });
    expect(persistence.exists('test-key')).toBe(true);
  });
});

describe('FileSizeFormatter', () => {
  it('should format file sizes correctly', () => {
    expect(FileSizeFormatter.format(0)).toBe('0 B');
    expect(FileSizeFormatter.format(1024)).toBe('1.0 KB');
    expect(FileSizeFormatter.format(1048576)).toBe('1.0 MB');
    expect(FileSizeFormatter.format(1073741824)).toBe('1.0 GB');
  });

  it('should parse file sizes correctly', () => {
    expect(FileSizeFormatter.parse('0 B')).toBe(0);
    expect(FileSizeFormatter.parse('1.0 KB')).toBe(1024);
    expect(FileSizeFormatter.parse('1.0 MB')).toBe(1048576);
    expect(FileSizeFormatter.parse('1.0 GB')).toBe(1073741824);
  });
});

describe('FilePathUtils', () => {
  it('should get file extensions correctly', () => {
    expect(FilePathUtils.getExtension('test.txt')).toBe('txt');
    expect(FilePathUtils.getExtension('test.file.txt')).toBe('txt');
    expect(FilePathUtils.getExtension('test')).toBe('');
    expect(FilePathUtils.getExtension('/path/to/test.txt')).toBe('txt');
  });

  it('should get file names correctly', () => {
    expect(FilePathUtils.getFileName('/path/to/test.txt')).toBe('test.txt');
    expect(FilePathUtils.getFileName('test.txt')).toBe('test.txt');
    expect(FilePathUtils.getFileName('/path/to/')).toBe('');
  });

  it('should get directory paths correctly', () => {
    expect(FilePathUtils.getDirectory('/path/to/test.txt')).toBe('/path/to');
    expect(FilePathUtils.getDirectory('test.txt')).toBe('');
  });
});

describe('FileTypeDetector', () => {
  it('should detect file types correctly', () => {
    expect(FileTypeDetector.getType('jpg')).toBe('image');
    expect(FileTypeDetector.getType('mp4')).toBe('video');
    expect(FileTypeDetector.getType('mp3')).toBe('audio');
    expect(FileTypeDetector.getType('pdf')).toBe('document');
    expect(FileTypeDetector.getType('zip')).toBe('archive');
    expect(FileTypeDetector.getType('js')).toBe('code');
    expect(FileTypeDetector.getType('unknown')).toBe('unknown');
  });

  it('should identify media files correctly', () => {
    expect(FileTypeDetector.isMedia('jpg')).toBe(true);
    expect(FileTypeDetector.isMedia('mp4')).toBe(true);
    expect(FileTypeDetector.isMedia('mp3')).toBe(true);
    expect(FileTypeDetector.isMedia('txt')).toBe(false);
  });

  it('should get appropriate icons for file types', () => {
    expect(FileTypeDetector.getIcon('jpg')).toBe('Image');
    expect(FileTypeDetector.getIcon('mp4')).toBe('Video');
    expect(FileTypeDetector.getIcon('pdf')).toBe('FileText');
    expect(FileTypeDetector.getIcon('unknown')).toBe('File');
  });
});

describe('DebugLogger', () => {
  let logger: DebugLogger;

  beforeEach(() => {
    logger = new DebugLogger('TestLogger', { enableConsole: false, enableStorage: false });
  });

  it('should create log entries correctly', () => {
    logger.info('Test message', { data: 'test' });
    logger.error('Error message');
    logger.warn('Warning message');
    logger.debug('Debug message');

    const entries = logger.getEntries();
    expect(entries).toHaveLength(4);
    
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('Test message');
    expect(entries[0].data).toEqual({ data: 'test' });
    
    expect(entries[1].level).toBe('error');
    expect(entries[1].message).toBe('Error message');
  });

  it('should filter entries by level', () => {
    logger.info('Info message');
    logger.error('Error message');
    logger.warn('Warning message');

    const errorEntries = logger.getEntries('error');
    expect(errorEntries).toHaveLength(1);
    expect(errorEntries[0].level).toBe('error');
  });

  it('should clear all entries', () => {
    logger.info('Test message');
    expect(logger.getEntries()).toHaveLength(1);
    
    logger.clear();
    expect(logger.getEntries()).toHaveLength(0);
  });
});

// Integration test for the refactored components
describe('Refactored Components Integration', () => {
  it('should work together seamlessly', () => {
    // Create instances
    const persistence = new DataPersistenceManager('integration-test');
    const logger = new DebugLogger('IntegrationTest', { enableConsole: false, enableStorage: false });
    
    // Test data
    const fileData = {
      name: 'test-file.jpg',
      size: 2048576, // 2MB
      path: '/path/to/test-file.jpg'
    };

    // Format file size
    const formattedSize = FileSizeFormatter.format(fileData.size);
    expect(formattedSize).toBe('2.0 MB');

    // Get file type
    const extension = FilePathUtils.getExtension(fileData.name);
    const fileType = FileTypeDetector.getType(extension);
    expect(fileType).toBe('image');

    // Log the operation
    logger.info('File processed', { 
      name: fileData.name, 
      size: formattedSize, 
      type: fileType 
    });

    // Save to persistence
    const saved = persistence.save('file-data', fileData);
    expect(saved).toBe(true);

    // Load from persistence
    const loaded = persistence.load('file-data');
    expect(loaded).toEqual(fileData);

    // Check log entries
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('File processed');

    // Cleanup
    persistence.clear();
    logger.clear();
  });
});