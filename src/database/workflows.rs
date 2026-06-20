use super::*;
use crate::workflows::WorkflowExecution;

impl super::Database {
    /// Save a workflow execution to history
    pub fn save_workflow_execution(&self, exec: &WorkflowExecution) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO workflow_executions (id, workflow_id, workflow_name, status, started_at, completed_at, error_message, actions_completed, total_actions)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                exec.id, exec.workflow_id, exec.workflow_name,
                format!("{:?}", exec.status),
                exec.started_at, exec.completed_at, exec.error_message,
                exec.actions_completed as i64, exec.total_actions as i64,
            ],
        )?;
        Ok(())
    }

    /// Get workflow execution history, most recent first
    pub fn get_workflow_history(&self, limit: usize) -> rusqlite::Result<Vec<WorkflowExecution>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, workflow_id, workflow_name, status, started_at, completed_at, error_message, actions_completed, total_actions
             FROM workflow_executions ORDER BY started_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            let status_str: String = row.get(3)?;
            let status = match status_str.as_str() {
                "Running" => crate::workflows::ExecutionStatus::Running,
                "Completed" => crate::workflows::ExecutionStatus::Completed,
                "Failed" => crate::workflows::ExecutionStatus::Failed,
                _ => crate::workflows::ExecutionStatus::Running,
            };
            Ok(WorkflowExecution {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                workflow_name: row.get(2)?,
                status,
                started_at: row.get(4)?,
                completed_at: row.get(5)?,
                current_action: None,
                error_message: row.get(6)?,
                actions_completed: row.get::<_, i64>(7)? as usize,
                total_actions: row.get::<_, i64>(8)? as usize,
            })
        })?;
        rows.collect()
    }

    /// Delete a workflow execution by ID
    pub fn delete_workflow_execution(&self, id: &str) -> rusqlite::Result<usize> {
        self.conn
            .execute("DELETE FROM workflow_executions WHERE id = ?1", params![id])
    }

    /// Clear all workflow execution history
    pub fn clear_workflow_history(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM workflow_executions", [])
    }
}
