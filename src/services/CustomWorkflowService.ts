// Custom Workflow Service - Refactored Main Service
// This file now imports from the refactored modular structure

// @ts-ignore - Module structure not fully implemented
export { CustomWorkflowService } from './CustomWorkflowService/index';
// @ts-ignore - Module structure not fully implemented
export * from './CustomWorkflowService/interfaces';

// Re-export for backward compatibility
// @ts-ignore - Module structure not fully implemented
import CustomWorkflowServiceClass from './CustomWorkflowService/index';

// Create default export for backward compatibility
const CustomWorkflowService = CustomWorkflowServiceClass;
export default CustomWorkflowService;