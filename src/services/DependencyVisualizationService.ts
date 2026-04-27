/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// Dependency Visualization Service - Refactored Main Service
// This file now imports from the refactored modular structure

export { DependencyVisualizationService } from "./DependencyVisualizationService/index";
export * from "./DependencyVisualizationService/interfaces";

// Re-export for backward compatibility
import DependencyVisualizationServiceClass from "./DependencyVisualizationService/index";

// Create default export for backward compatibility
const DependencyVisualizationService = DependencyVisualizationServiceClass;
export default DependencyVisualizationService;
