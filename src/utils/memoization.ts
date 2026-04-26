import * as React from 'react';

// Memoization levels for different component types
export enum MemoizationLevel {
  NEVER = 'never',           // Pure functions, no props/state
  PROPS = 'props',           // When props change
  STATE = 'state',           // When internal state changes
  EXPENSIVE = 'expensive'    // Expensive calculations
}

// Custom shallow equal for objects
export const shallowEqualObjects = (obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean => {
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

// Simple shallow equal for props
const shallowEqual = (prevProps: Record<string, unknown>, nextProps: Record<string, unknown>): boolean => {
  return shallowEqualObjects(prevProps, nextProps);
};

// Enhanced memoization function with different strategies
export const withMemoization = <P extends object>(
  component: (props: P) => any,
  level: MemoizationLevel = MemoizationLevel.PROPS
) => {
  switch (level) {
    case MemoizationLevel.NEVER:
      return React.memo(component);

    case MemoizationLevel.PROPS:
      return React.memo(component, (prevProps: Record<string, unknown>, nextProps: Record<string, unknown>) => {
        // Use shallow equal for props comparison
        return shallowEqual(prevProps, nextProps);
      });

    case MemoizationLevel.STATE:
      // For stateful components, we need to be more careful
      return React.memo(component, (prevProps: Record<string, unknown>, nextProps: Record<string, unknown>) => {
        // Compare only non-function props (functions are usually stable)
        const prevKeys = Object.keys(prevProps).filter(key =>
          typeof prevProps[key] !== 'function'
        );
        const nextKeys = Object.keys(nextProps).filter(key =>
          typeof nextProps[key] !== 'function'
        );

        if (prevKeys.length !== nextKeys.length) return false;

        for (const key of prevKeys) {
          if (!(key in nextProps)) return false;
          if (!shallowEqualObjects(prevProps[key] as Record<string, unknown>, nextProps[key] as Record<string, unknown>)) {
            return false;
          }
        }

        return true;
      });

    case MemoizationLevel.EXPENSIVE:
      return React.memo(component, (prevProps: Record<string, unknown>, nextProps: Record<string, unknown>) => {
        // For expensive components, use deep comparison but with caching
        return JSON.stringify(prevProps) === JSON.stringify(nextProps);
      });

    default:
      return React.memo(component);
  }
};

// Memoization for expensive calculations
export const useMemoizedCalculation = <T>(
  calculation: () => T,
  deps: any[]
): T => {
  return (React as any).useMemo(calculation, deps);
};

// Memoization for callbacks
export const useMemoizedCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: any[]
): T => {
  return (React as any).useCallback(callback, deps);
};

// Performance monitoring for memoized components
export const withPerformanceMonitoring = <P extends object>(
  component: (props: P) => any,
  componentName: string
) => {
  return React.memo((props: P) => {
    const startTime = performance.now();

    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Log slow renders (>16ms for 60fps)
      if (renderTime > 16) {
        console.warn(`${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
    });

    return (React as any).createElement(component as any, props);
  });
};

// Lazy memoization - only memoize after first render
export const useLazyMemo = <T>(factory: () => T, deps: any[]): T => {
  const [isInitialized, setIsInitialized] = (React as any).useState(false);

  (React as any).useEffect(() => {
    setIsInitialized(true);
  }, []);

  return (React as any).useMemo(() => {
    if (!isInitialized) return factory();
    return factory();
  }, deps);
};