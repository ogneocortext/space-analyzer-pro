//! Library root for integration tests.
//!
//! Tests import this shim which re-exports types from the real library.
//! This avoids the fragile #[path] hack previously needed when there was no [lib] target.

// Re-export for compatibility with existing tests
pub use space_analyzer_pro_desktop::gui::{self, SpaceAnalyzerApp, ChatMessage, ScanMessage};
pub use space_analyzer_pro_desktop::gui::AppTab;
pub use space_analyzer_pro_desktop::database::AppSettings;
pub use space_analyzer_pro_desktop::workflows::WorkflowTemplates;
