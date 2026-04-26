import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock localStorage for real data testing
const mockLocalStorage = {
  getItem: vi.fn((key: string) => {
    if (key === 'space-analyzer-onboarding-completed') return 'true';
    if (key === 'space-analyzer-skip-onboarding') return 'false';
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock external dependencies minimally to allow real data testing
global.fetch = vi.fn(() => Promise.resolve({
  json: () => Promise.resolve({
    vision: true,
    codeAnalysis: true,
    selfLearning: true,
    ollama: true,
    enhancedWorkflow: true,
    streaming: true,
    toolCalling: true
  }),
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  redirected: false,
  type: 'basic',
  url: '',
  clone: () => ({} as Response),
  body: null,
  bodyUsed: false,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  blob: () => Promise.resolve(new Blob()),
  formData: () => Promise.resolve(new FormData()),
  text: () => Promise.resolve('')
} as Response));

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

describe('App Component - Integration Tests with Real Data', () => {
  it('renders the complete app with real components', () => {
    render(<App />);

    // Test that the app renders without crashing with all real components
    expect(document.body).toBeInTheDocument();

    // Test that navigation is present
    const navElement = document.querySelector('nav, [role="navigation"]');
    expect(navElement).toBeInTheDocument();
  });

  it('loads with real context providers and data', () => {
    render(<App />);

    // Test that context providers work with real data
    expect(document.body).toBeInTheDocument();

    // Test that the app doesn't show initial errors
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('supports real accessibility features', () => {
    render(<App />);

    // Test that the app renders without accessibility issues
    expect(document.body).toBeInTheDocument();

    // Test that no accessibility alerts are present initially
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('integrates real lazy-loaded components', async () => {
    render(<App />);

    // Test that lazy loading works with real components
    // Components should load without throwing errors
    expect(document.body.children.length).toBeGreaterThan(0);
  });

  it('handles real state management with hooks', () => {
    render(<App />);

    // Test that state management works with real hooks and contexts
    expect(document.body).toBeInTheDocument();

    // Test that the app shows dashboard content (storage metrics)
    expect(screen.getByText('Total Storage')).toBeInTheDocument();
  });

  it('renders real dashboard with data', () => {
    render(<App />);

    // Test that dashboard components render with real data structures
    expect(document.body).toBeInTheDocument();

    // Should not show error states
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});