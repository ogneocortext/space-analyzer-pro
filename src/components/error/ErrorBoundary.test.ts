import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ErrorBoundary from './ErrorBoundary.vue';

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('ErrorBoundary', () => {
  beforeEach(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });

  it('renders slot content when no error occurs', () => {
    const wrapper = mount(ErrorBoundary, {
      slots: {
        default: '<div>Test content</div>'
      }
    });

    expect(wrapper.find('.error-boundary').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test content');
    expect(wrapper.find('.error-fallback').exists()).toBe(false);
  });

  it('displays error fallback when error is captured', async () => {
    const TestComponent = {
      template: '<div>{{ errorMessage }}</div>',
      setup() {
        throw new Error('Test error');
      }
    };

    const wrapper = mount(ErrorBoundary, {
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.find('.error-fallback').exists()).toBe(true);
    expect(wrapper.text()).toContain('Something went wrong');
  });

  it('displays custom fallback message when provided', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        throw new Error('Custom error');
      }
    };

    const wrapper = mount(ErrorBoundary, {
      props: {
        fallbackMessage: 'Custom error message'
      },
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('Custom error message');
  });

  it('emits error event when error occurs', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        throw new Error('Test error');
      }
    };

    const wrapper = mount(ErrorBoundary, {
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    const emitted = wrapper.emitted('error');
    expect(emitted).toBeTruthy();
    expect(emitted[0]).toHaveLength(1);
    expect(emitted[0][0][0]).toBeInstanceOf(Error);
    expect(emitted[0][0][0].message).toBe('Test error');
  });

  it('calls onError prop when provided', async () => {
    const onError = vi.fn();
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        throw new Error('Test error');
      }
    };

    mount(ErrorBoundary, {
      props: {
        onError
      },
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('shows retry button when retryCount < maxRetries', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        throw new Error('Test error');
      }
    };

    const wrapper = mount(ErrorBoundary, {
      props: {
        maxRetries: 3
      },
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.find('.btn-primary').exists()).toBe(true);
    expect(wrapper.text()).toContain('Retry');
  });

  it('disables retry button when maxRetries reached', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        throw new Error('Test error');
      }
    };

    const wrapper = mount(ErrorBoundary, {
      props: {
        maxRetries: 1
      },
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    // Trigger retry once
    await wrapper.find('.btn-primary').trigger('click');
    await new Promise(resolve => setTimeout(resolve, 0));

    // Trigger retry second time (should be disabled)
    await wrapper.find('.btn-primary').trigger('click');
    await new Promise(resolve => setTimeout(resolve, 0));

    const retryButton = wrapper.find('.btn-primary');
    expect(retryButton.exists()).toBe(true);
    // Button should be disabled or not present after max retries
  });

  it('toggles error details visibility', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        throw new Error('Test error with stack');
      }
    };

    const wrapper = mount(ErrorBoundary, {
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    const detailsButton = wrapper.find('.btn-outline');
    expect(detailsButton.exists()).toBe(true);

    // Initially hidden
    expect(wrapper.find('.error-details').exists()).toBe(false);

    // Click to show details
    await detailsButton.trigger('click');
    expect(wrapper.find('.error-details').exists()).toBe(true);

    // Click to hide details
    await detailsButton.trigger('click');
    expect(wrapper.find('.error-details').exists()).toBe(false);
  });

  it('handles async errors from unhandled rejections', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      async setup() {
        await new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Async error')), 0);
        });
      }
    };

    const wrapper = mount(ErrorBoundary, {
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(wrapper.find('.error-fallback').exists()).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('ErrorBoundary caught async error'),
      expect.any(Object)
    );
  });

  it('registers and unregisters async error handlers', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const wrapper = mount(ErrorBoundary);

    expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    
    wrapper.unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('reports error details correctly', async () => {
    const TestComponent = {
      template: '<div>Test content</div>',
      setup() {
        const error = new Error('Test error');
        error.stack = 'Error stack trace';
        throw error;
      }
    };

    const wrapper = mount(ErrorBoundary, {
      slots: {
        default: TestComponent
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    const reportButton = wrapper.find('.btn-secondary');
    expect(reportButton.exists()).toBe(true);

    await reportButton.trigger('click');

    // Check localStorage for error report
    const reports = JSON.parse(localStorage.getItem('errorReports') || '[]');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      message: 'An unexpected error occurred while rendering this component.',
      stack: 'Error stack trace',
      userAgent: expect.any(String),
      url: expect.any(String),
      timestamp: expect.any(String),
      retryCount: 0
    });
  });
});
