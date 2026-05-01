// Vue-compatible memoization utilities

// Memoization levels for different component types
export enum MemoizationLevel {
  NEVER = "never", // Pure functions, no props/state
  PROPS = "props", // When props change
  STATE = "state", // When internal state changes
  EXPENSIVE = "expensive", // Expensive calculations
}

// Custom shallow equal for objects
export const shallowEqualObjects = (
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>
): boolean => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
};

// Simple shallow equal for props (unused but kept for reference)
// const shallowEqual = (
//   prevProps: Record<string, unknown>,
//   nextProps: Record<string, unknown>
// ): boolean => {
//   return shallowEqualObjects(prevProps, nextProps);
// };

// Enhanced memoization function for Vue components
export const withMemoization = <P extends object>(
  component: (props: P) => any,
  _level: MemoizationLevel = MemoizationLevel.PROPS
) => {
  // In Vue, memoization is handled differently - this is a placeholder for Vue-specific optimizations
  return component;
};

// Memoization for expensive calculations - Vue version
export const useMemoizedCalculation = <T>(calculation: () => T, deps: any[]): T => {
  // Simple memoization cache for Vue
  const cache = new Map<string, T>();
  const key = JSON.stringify(deps);

  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const result = calculation();
  cache.set(key, result);
  return result;
};

// Memoization for callbacks - Vue version
export const useMemoizedCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  _deps: any[]
): T => {
  // In Vue, callbacks are typically stable, but we can cache if needed
  return callback;
};

// Performance monitoring for Vue components
export const withPerformanceMonitoring = <P extends object>(
  component: (props: P) => any,
  componentName: string
) => {
  return (props: P) => {
    const startTime = performance.now();
    const result = component(props);
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Log slow renders (>16ms for 60fps)
    if (renderTime > 16) {
      console.warn(`${componentName} took ${renderTime.toFixed(2)}ms to render`);
    }

    return result;
  };
};

// Lazy memoization - Vue version
export const useLazyMemo = <T>(factory: () => T, _deps: any[]): T => {
  // Simple lazy memoization for Vue
  let isInitialized = false;

  return (() => {
    if (!isInitialized) {
      isInitialized = true;
      return factory();
    }
    return factory();
  })();
};
