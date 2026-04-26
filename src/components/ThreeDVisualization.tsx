// ThreeD Visualization Component - Refactored Main Service
// This file now imports from the refactored modular structure

// @ts-ignore
export { ThreeDVisualization } from './ThreeDVisualization/index';
// @ts-ignore
export * from './ThreeDVisualization/interfaces';

// Re-export for backward compatibility
// @ts-ignore
import ThreeDVisualizationClass from './ThreeDVisualization/index';

// Create default export for backward compatibility
const ThreeDVisualization = ThreeDVisualizationClass;
export default ThreeDVisualization;