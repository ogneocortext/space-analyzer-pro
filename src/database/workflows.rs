use super::*;
use crate::workflows::WorkflowExecution;

/// Maximum number of workflow execution records kept in history. Oldest rows
/// are trimmed automatically after each insert to prevent unbounded growth.
pub const MAX_WORKFLOW_HISTORY: usize = 100;

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
        self.prune_workflow_history(MAX_WORKFLOW_HISTORY)?;
        Ok(())
    }

    /// Trim workflow history to the newest `keep` records (by start time).
    /// Running workflows are always preserved, so a long-lived run that started
    /// earlier is never dropped while it is still active.
    pub fn prune_workflow_history(&self, keep: usize) -> rusqlite::Result<usize> {
        let deleted = self.conn.execute(
            "DELETE FROM workflow_executions
             WHERE status != 'Running'
               AND id NOT IN (
                   SELECT id FROM workflow_executions
                   ORDER BY started_at DESC, rowid DESC
                   LIMIT ?1
               )",
            params![keep as i64],
        )?;
        Ok(deleted)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflows::ExecutionStatus;

    fn test_db() -> Database {
        Database::open(PathBuf::from(":memory:")).expect("in-memory db")
    }

    fn make_exec(
        id: &str,
        workflow_id: &str,
        name: &str,
        status: ExecutionStatus,
        started_at: &str,
    ) -> WorkflowExecution {
        WorkflowExecution {
            id: id.to_string(),
            workflow_id: workflow_id.to_string(),
            workflow_name: name.to_string(),
            status,
            started_at: started_at.to_string(),
            completed_at: None,
            current_action: None,
            error_message: None,
            actions_completed: 0,
            total_actions: 0,
        }
    }

    #[test]
    fn prune_workflow_history_keeps_newest() {
        let db = test_db();
        // Insert 5 executions; the 3 oldest should be trimmed when keep=2.
        for i in 0..5 {
            let exec = make_exec(
                &format!("exec-{i}"),
                "wf-1",
                "test",
                ExecutionStatus::Completed,
                &format!("2026-08-03T00:00:0{}Z", i),
            );
            db.save_workflow_execution(&exec).unwrap();
        }
        // save_workflow_execution auto-prunes to MAX_WORKFLOW_HISTORY (100), so all 5 survive.
        // Manually prune to 2 to test the logic.
        let pruned = db.prune_workflow_history(2).unwrap();
        assert_eq!(pruned, 3, "3 oldest completed executions should be removed");
        let remaining = db.get_workflow_history(10).unwrap();
        assert_eq!(remaining.len(), 2);
        // Newest two (exec-4 and exec-3) should survive.
        assert_eq!(remaining[0].id, "exec-4");
        assert_eq!(remaining[1].id, "exec-3");
    }

    #[test]
    fn prune_workflow_history_preserves_running() {
        let db = test_db();
        // Insert a running execution (oldest) and two completed ones.
        // With keep=1, the newest completed should survive AND the running
        // exec should always be preserved regardless of the limit.
        db.save_workflow_execution(&make_exec(
            "running-1",
            "wf-1",
            "test",
            ExecutionStatus::Running,
            "2026-08-03T00:00:00Z",
        ))
        .unwrap();
        db.save_workflow_execution(&make_exec(
            "completed-old",
            "wf-1",
            "test",
            ExecutionStatus::Completed,
            "2026-08-03T00:00:01Z",
        ))
        .unwrap();
        db.save_workflow_execution(&make_exec(
            "completed-new",
            "wf-1",
            "test",
            ExecutionStatus::Completed,
            "2026-08-03T00:00:02Z",
        ))
        .unwrap();
        // Prune to 1 — running exec must survive, newest completed survives,
        // oldest completed is pruned.
        let pruned = db.prune_workflow_history(1).unwrap();
        assert_eq!(pruned, 1, "only the oldest completed exec should be pruned");
        let remaining = db.get_workflow_history(10).unwrap();
        assert_eq!(remaining.len(), 2);
        let ids: Vec<_> = remaining.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&"running-1"));
        assert!(ids.contains(&"completed-new"));
    }
}
