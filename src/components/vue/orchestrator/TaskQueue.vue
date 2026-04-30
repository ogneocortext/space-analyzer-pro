<template>
  <div class="task-queue">
    <h3>📋 Task Queue Management</h3>

    <!-- Stats Overview -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card active">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">{{ stats.failed }}</div>
        <div class="stat-label">Failed</div>
      </div>
    </div>

    <!-- Priority Distribution -->
    <div class="priority-section">
      <h4>Priority Distribution</h4>
      <div class="priority-bars">
        <div class="priority-bar">
          <span class="priority-label critical">Critical</span>
          <div class="bar-container">
            <div
              class="bar-fill critical"
              :style="{ width: priorityPercentages.critical + '%' }"
            ></div>
          </div>
          <span class="priority-count">{{ stats.byPriority.critical }}</span>
        </div>
        <div class="priority-bar">
          <span class="priority-label high">High</span>
          <div class="bar-container">
            <div
              class="bar-fill high"
              :style="{ width: priorityPercentages.high + '%' }"
            ></div>
          </div>
          <span class="priority-count">{{ stats.byPriority.high }}</span>
        </div>
        <div class="priority-bar">
          <span class="priority-label normal">Normal</span>
          <div class="bar-container">
            <div
              class="bar-fill normal"
              :style="{ width: priorityPercentages.normal + '%' }"
            ></div>
          </div>
          <span class="priority-count">{{ stats.byPriority.normal }}</span>
        </div>
        <div class="priority-bar">
          <span class="priority-label low">Low</span>
          <div class="bar-container">
            <div
              class="bar-fill low"
              :style="{ width: priorityPercentages.low + '%' }"
            ></div>
          </div>
          <span class="priority-count">{{ stats.byPriority.low }}</span>
        </div>
        <div class="priority-bar">
          <span class="priority-label background">Background</span>
          <div class="bar-container">
            <div
              class="bar-fill background"
              :style="{ width: priorityPercentages.background + '%' }"
            ></div>
          </div>
          <span class="priority-count">{{ stats.byPriority.background }}</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <label>Filter by status:</label>
      <select v-model="statusFilter" @change="fetchTasks">
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
      <button @click="fetchTasks" class="btn-refresh">🔄 Refresh</button>
    </div>

    <!-- Task List -->
    <div class="task-list">
      <h4>Tasks ({{ tasks.length }} shown)</h4>
      <div v-if="tasks.length === 0" class="empty-state">
        No tasks found
      </div>
      <div
        v-for="task in tasks"
        :key="task.id"
        class="task-item"
        :class="task.status.toLowerCase()"
      >
        <div class="task-header">
          <span class="task-id">{{ task.id }}</span>
          <span class="task-priority" :class="priorityClass(task.priority)">
            {{ task.priorityLabel }}
          </span>
          <span class="task-status" :class="task.status.toLowerCase()">
            {{ task.status }}
          </span>
        </div>

        <div v-if="task.data?.directory" class="task-path">
          📁 {{ task.data.directory }}
        </div>

        <div class="task-meta">
          <span v-if="task.createdAt">Created: {{ formatTime(task.createdAt) }}</span>
          <span v-if="task.assignedAgent">Agent: {{ task.assignedAgent }}</span>
          <span v-if="task.result">Result: {{ task.result.success ? '✅ Success' : '❌ Failed' }}</span>
        </div>

        <div v-if="task.error" class="task-error">
          ⚠️ {{ task.error }}
        </div>

        <div class="task-actions" v-if="task.status === 'pending' || task.status === 'active'">
          <button @click="cancelTask(task.id)" class="btn-cancel" :disabled="cancelling">
            {{ cancelling ? 'Cancelling...' : 'Cancel Task' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AnalysisBridge } from '@/services/AnalysisBridge';

interface Task {
  id: string;
  status: string;
  priority: number;
  priorityLabel: string;
  data: { directory?: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  assignedAgent: string | null;
  result: { success: boolean; hasData: boolean } | null;
  error: string | null;
}

// State
const analysisBridge = new AnalysisBridge();
const tasks = ref<Task[]>([]);
const stats = ref({
  total: 0,
  pending: 0,
  active: 0,
  completed: 0,
  failed: 0,
  byPriority: {
    critical: 0,
    high: 0,
    normal: 0,
    low: 0,
    background: 0
  }
});
const statusFilter = ref('all');
const error = ref<string | null>(null);
const cancelling = ref(false);

// Computed
const priorityPercentages = computed(() => {
  const total = stats.value.total || 1; // Avoid division by zero
  return {
    critical: (stats.value.byPriority.critical / total) * 100,
    high: (stats.value.byPriority.high / total) * 100,
    normal: (stats.value.byPriority.normal / total) * 100,
    low: (stats.value.byPriority.low / total) * 100,
    background: (stats.value.byPriority.background / total) * 100
  };
});

// Methods
const priorityClass = (priority: number): string => {
  const classes = ['critical', 'high', 'normal', 'low', 'background'];
  return classes[priority] || 'normal';
};

const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

const fetchTasks = async () => {
  try {
    error.value = null;
    const result = await analysisBridge.getTaskQueue(
      statusFilter.value as 'all' | 'pending' | 'active' | 'completed' | 'failed',
      50
    );
    tasks.value = result.tasks;
    stats.value = result.stats;
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch tasks';
  }
};

const cancelTask = async (taskId: string) => {
  if (!confirm('Are you sure you want to cancel this task?')) return;

  cancelling.value = true;
  try {
    await analysisBridge.cancelTask(taskId);
    await fetchTasks();
  } catch (err: any) {
    error.value = err.message || 'Failed to cancel task';
  } finally {
    cancelling.value = false;
  }
};

// Lifecycle
onMounted(() => {
  fetchTasks();
});
</script>

<style scoped>
.task-queue {
  padding: 20px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 12px;
}

h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary, #333);
  font-size: 1.5rem;
}

h4 {
  margin: 20px 0 12px 0;
  color: var(--text-secondary, #666);
  font-size: 1.1rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #ddd;
}

.stat-card.pending { border-left-color: #ffc107; }
.stat-card.active { border-left-color: #007acc; }
.stat-card.completed { border-left-color: #28a745; }
.stat-card.failed { border-left-color: #dc3545; }

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
}

/* Priority Section */
.priority-section {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.priority-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.priority-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.priority-label {
  width: 80px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.priority-label.critical { color: #dc3545; }
.priority-label.high { color: #fd7e14; }
.priority-label.normal { color: #007acc; }
.priority-label.low { color: #6c757d; }
.priority-label.background { color: #adb5bd; }

.bar-container {
  flex: 1;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.3s ease;
}

.bar-fill.critical { background: #dc3545; }
.bar-fill.high { background: #fd7e14; }
.bar-fill.normal { background: #007acc; }
.bar-fill.low { background: #6c757d; }
.bar-fill.background { background: #adb5bd; }

.priority-count {
  width: 40px;
  text-align: right;
  font-weight: 600;
}

/* Filters */
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: white;
  border-radius: 8px;
}

.filters label {
  font-weight: 600;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.btn-refresh {
  padding: 8px 16px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* Task List */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.task-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #ddd;
}

.task-item.pending { border-left-color: #ffc107; }
.task-item.active { border-left-color: #007acc; }
.task-item.completed { border-left-color: #28a745; }
.task-item.failed { border-left-color: #dc3545; }

.task-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.task-id {
  font-family: monospace;
  font-size: 0.85rem;
  color: #666;
}

.task-priority {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.task-priority.critical { background: #f8d7da; color: #721c24; }
.task-priority.high { background: #fff3cd; color: #856404; }
.task-priority.normal { background: #e7f3ff; color: #007acc; }
.task-priority.low { background: #e9ecef; color: #495057; }
.task-priority.background { background: #f8f9fa; color: #6c757d; }

.task-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.task-status.pending { background: #fff3cd; color: #856404; }
.task-status.active { background: #e7f3ff; color: #007acc; }
.task-status.completed { background: #d4edda; color: #155724; }
.task-status.failed { background: #f8d7da; color: #721c24; }

.task-path {
  font-size: 0.9rem;
  color: #333;
  margin-bottom: 8px;
  word-break: break-all;
}

.task-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 8px;
}

.task-error {
  padding: 8px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.task-actions {
  margin-top: 12px;
}

.btn-cancel {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-cancel:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 6px;
}
</style>
