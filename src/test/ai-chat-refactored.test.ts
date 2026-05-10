/**
 * Test file for refactored AI Chat components
 * Tests the new modular architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIChatService } from '../services/AIChatService';
import { useAIChat } from '../composables/useAIChat';
import { useAISuggestions } from '../composables/useAISuggestions';

// Mock the debug logger
vi.mock('../utils/DebugUtils', () => ({
  useDebugLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock the data persistence
vi.mock('../utils/DataPersistence', () => ({
  useDataPersistence: () => ({
    save: vi.fn(),
    load: vi.fn(),
    exists: vi.fn(() => false),
    clear: vi.fn(),
  }),
}));

describe('AIChatService', () => {
  let service: AIChatService;

  beforeEach(() => {
    service = AIChatService.getInstance();
  });

  it('should get available models', () => {
    const models = service.getAvailableModels();
    expect(models).toHaveLength(4);
    expect(models[0].id).toBe('deepseek-coder:6.7b');
  });

  it('should select best model for code queries', () => {
    const model = service.selectBestModel('How can I optimize my JavaScript code?');
    expect(model.id).toBe('deepseek-coder:6.7b');
  });

  it('should select best model for quick analysis', () => {
    const model = service.selectBestModel('Give me a quick summary');
    expect(model.id).toBe('mistral:7b');
  });

  it('should process query and generate response', async () => {
    const analysisData = {
      totalSize: 1024 * 1024 * 1024, // 1GB
      files: [
        { name: 'large-file.mp4', size: 500 * 1024 * 1024 },
        { name: 'code.js', size: 1024 },
      ],
    };

    const response = await service.processQuery('Analyze my large files', analysisData);
    
    expect(response.content).toContain('large files');
    expect(response.insights).toBeDefined();
    expect(response.recommendations).toBeDefined();
    expect(response.model).toBeDefined();
    expect(response.processingTime).toBeGreaterThan(0);
  });

  it('should handle storage optimization queries', async () => {
    const analysisData = {
      totalSize: 2 * 1024 * 1024 * 1024, // 2GB
      files: Array.from({ length: 1000 }, (_, i) => ({
        name: `file-${i}.txt`,
        size: 1024,
      })),
    };

    const response = await service.processQuery('How can I optimize storage?', analysisData);
    
    expect(response.content).toContain('optimize');
    expect(response.recommendations).toContain('Remove duplicate files');
  });

  it('should check service availability', async () => {
    const isAvailable = await service.isAvailable();
    expect(isAvailable).toBe(true);
  });

  it('should get service status', async () => {
    const status = await service.getStatus();
    expect(status.available).toBe(true);
    expect(status.models).toHaveLength(4);
    expect(status.responseTime).toBeDefined();
  });
});

describe('useAIChat composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const chat = useAIChat();
    
    expect(chat.messages.value).toEqual([]);
    expect(chat.isStreaming.value).toBe(false);
    expect(chat.isTyping.value).toBe(false);
    expect(chat.currentModel.value).toBe('auto');
    expect(chat.analysisDepth.value).toBe('standard');
    expect(chat.showSettings.value).toBe(false);
    expect(chat.inputMessage.value).toBe('');
  });

  it('should add user message', () => {
    const chat = useAIChat();
    
    chat.addMessage({
      type: 'user',
      content: 'Hello AI',
    });
    
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0].type).toBe('user');
    expect(chat.messages.value[0].content).toBe('Hello AI');
    expect(chat.messages.value[0].id).toBeDefined();
    expect(chat.messages.value[0].timestamp).toBeInstanceOf(Date);
  });

  it('should send message and receive response', async () => {
    const chat = useAIChat({
      analysisData: {
        totalSize: 1024 * 1024,
        files: [{ name: 'test.txt', size: 1024 }],
      },
    });
    
    chat.inputMessage.value = 'Hello AI';
    await chat.sendMessage();
    
    expect(chat.messages.value).toHaveLength(2);
    expect(chat.messages.value[0].type).toBe('user');
    expect(chat.messages.value[1].type).toBe('assistant');
    expect(chat.inputMessage.value).toBe('');
  });

  it('should update model', () => {
    const chat = useAIChat();
    
    chat.updateModel('llama2:7b');
    expect(chat.currentModel.value).toBe('llama2:7b');
  });

  it('should update analysis depth', () => {
    const chat = useAIChat();
    
    chat.updateAnalysisDepth('comprehensive');
    expect(chat.analysisDepth.value).toBe('comprehensive');
  });

  it('should toggle settings', () => {
    const chat = useAIChat();
    
    expect(chat.showSettings.value).toBe(false);
    chat.toggleSettings();
    expect(chat.showSettings.value).toBe(true);
    chat.toggleSettings();
    expect(chat.showSettings.value).toBe(false);
  });

  it('should clear messages', () => {
    const chat = useAIChat();
    
    chat.addMessage({ type: 'user', content: 'Test' });
    expect(chat.messages.value).toHaveLength(1);
    
    chat.clearMessages();
    expect(chat.messages.value).toHaveLength(0);
  });

  it('should delete specific message', () => {
    const chat = useAIChat();
    
    chat.addMessage({ type: 'user', content: 'Message 1' });
    chat.addMessage({ type: 'assistant', content: 'Response 1' });
    chat.addMessage({ type: 'user', content: 'Message 2' });
    
    expect(chat.messages.value).toHaveLength(3);
    
    const messageIdToDelete = chat.messages.value[1].id;
    chat.deleteMessage(messageIdToDelete);
    
    expect(chat.messages.value).toHaveLength(2);
    expect(chat.messages.value.find(m => m.id === messageIdToDelete)).toBeUndefined();
  });

  it('should compute derived state correctly', () => {
    const chat = useAIChat();
    
    expect(chat.hasMessages.value).toBe(false);
    expect(chat.messageCount.value).toBe(0);
    expect(chat.canSendMessage.value).toBe(false);
    
    chat.inputMessage.value = 'Test message';
    expect(chat.canSendMessage.value).toBe(true);
    
    chat.addMessage({ type: 'user', content: 'Test' });
    expect(chat.hasMessages.value).toBe(true);
    expect(chat.messageCount.value).toBe(1);
  });
});

describe('useAISuggestions composable', () => {
  const mockAnalysisData = {
    totalSize: 2 * 1024 * 1024 * 1024, // 2GB
    files: [
      { name: 'large-video.mp4', size: 500 * 1024 * 1024 }, // 500MB
      { name: 'code.js', size: 1024 },
      { name: 'old-file.txt', size: 2048, modified: '2020-01-01' },
      { name: 'duplicate.txt', size: 1024 },
      { name: 'duplicate.txt', size: 1024 },
      { name: 'secret.key', size: 512 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const suggestions = useAISuggestions();
    
    expect(suggestions.suggestions.value).toEqual([]);
    expect(suggestions.isLoading.value).toBe(false);
    expect(suggestions.hasSuggestions.value).toBe(false);
    expect(suggestions.suggestionCount.value).toBe(0);
  });

  it('should generate suggestions for analysis data', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    expect(suggestions.suggestions.value.length).toBeGreaterThan(0);
    expect(suggestions.hasSuggestions.value).toBe(true);
    expect(suggestions.suggestionCount.value).toBeGreaterThan(0);
  });

  it('should generate large files suggestion', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const largeFilesSuggestion = suggestions.getSuggestionById('large-files');
    expect(largeFilesSuggestion).toBeDefined();
    expect(largeFilesSuggestion?.title).toContain('Large Files');
    expect(largeFilesSuggestion?.category).toBe('storage');
    expect(largeFilesSuggestion?.priority).toBe('high');
  });

  it('should generate old files suggestion', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const oldFilesSuggestion = suggestions.getSuggestionById('old-files');
    expect(oldFilesSuggestion).toBeDefined();
    expect(oldFilesSuggestion?.title).toContain('Archive');
    expect(oldFilesSuggestion?.category).toBe('organization');
  });

  it('should generate code project suggestion', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const codeSuggestion = suggestions.getSuggestionById('code-project');
    expect(codeSuggestion).toBeDefined();
    expect(codeSuggestion?.title).toContain('Code');
    expect(codeSuggestion?.category).toBe('performance');
  });

  it('should generate duplicate files suggestion', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const duplicateSuggestion = suggestions.getSuggestionById('duplicate-files');
    expect(duplicateSuggestion).toBeDefined();
    expect(duplicateSuggestion?.title).toContain('Duplicate');
    expect(duplicateSuggestion?.category).toBe('storage');
  });

  it('should generate security suggestion', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const securitySuggestion = suggestions.getSuggestionById('security');
    expect(securitySuggestion).toBeDefined();
    expect(securitySuggestion?.title).toContain('Security');
    expect(securitySuggestion?.category).toBe('security');
    expect(securitySuggestion?.priority).toBe('high');
  });

  it('should categorize suggestions correctly', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const categorized = suggestions.suggestionsByCategory;
    expect(categorized.storage).toBeDefined();
    expect(categorized.performance).toBeDefined();
    expect(categorized.organization).toBeDefined();
    expect(categorized.security).toBeDefined();
  });

  it('should filter suggestions by priority', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const highPriority = suggestions.getSuggestionsByPriority('high');
    expect(highPriority.length).toBeGreaterThan(0);
    
    const mediumPriority = suggestions.getSuggestionsByPriority('medium');
    expect(mediumPriority.length).toBeGreaterThanOrEqual(0);
    
    const lowPriority = suggestions.getSuggestionsByPriority('low');
    expect(lowPriority.length).toBeGreaterThanOrEqual(0);
  });

  it('should filter suggestions by category', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const storageSuggestions = suggestions.getSuggestionsByCategory('storage');
    expect(storageSuggestions.length).toBeGreaterThan(0);
    
    const performanceSuggestions = suggestions.getSuggestionsByCategory('performance');
    expect(performanceSuggestions.length).toBeGreaterThanOrEqual(0);
  });

  it('should clear suggestions', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    expect(suggestions.suggestions.value.length).toBeGreaterThan(0);
    
    suggestions.clearSuggestions();
    expect(suggestions.suggestions.value).toEqual([]);
    expect(suggestions.hasSuggestions.value).toBe(false);
  });

  it('should refresh suggestions', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
    });
    
    const initialCount = suggestions.suggestions.value.length;
    
    suggestions.refreshSuggestions();
    expect(suggestions.suggestions.value.length).toBe(initialCount);
  });

  it('should limit suggestions to maxSuggestions', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
      maxSuggestions: 3,
    });
    
    expect(suggestions.suggestions.value.length).toBeLessThanOrEqual(3);
  });

  it('should disable proactive suggestions when option is false', () => {
    const suggestions = useAISuggestions({
      analysisData: mockAnalysisData,
      enableProactiveSuggestions: false,
    });
    
    expect(suggestions.suggestions.value).toEqual([]);
  });
});

describe('Integration Tests', () => {
  it('should work together seamlessly', async () => {
    const analysisData = {
      totalSize: 1024 * 1024 * 1024,
      files: [
        { name: 'large-file.mp4', size: 200 * 1024 * 1024 },
        { name: 'code.js', size: 1024 },
      ],
    };

    // Initialize chat and suggestions
    const chat = useAIChat({ analysisData });
    const aiSuggestions = useAISuggestions({ analysisData });

    // Check initial state
    expect(chat.messages.value).toEqual([]);
    expect(aiSuggestions.suggestions.value.length).toBeGreaterThan(0);

    // Send a message
    chat.inputMessage.value = 'Analyze my files';
    await chat.sendMessage();

    // Check that message was sent and response received
    expect(chat.messages.value).toHaveLength(2);
    expect(chat.messages.value[0].type).toBe('user');
    expect(chat.messages.value[1].type).toBe('assistant');

    // Check that suggestions are available
    expect(aiSuggestions.hasSuggestions.value).toBe(true);
    expect(aiSuggestions.suggestionCount.value).toBeGreaterThan(0);

    // Select a suggestion
    const firstSuggestion = aiSuggestions.suggestions.value[0];
    expect(firstSuggestion).toBeDefined();
    expect(firstSuggestion.prompt).toBeDefined();
  });
});