<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-slate-100 mb-2">Automation</h1>
        <p class="text-slate-400 mb-6">Create automated workflows and scheduled tasks</p>
      </div>

      <!-- Create New Workflow -->
      <div class="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
        <h3 class="text-lg font-semibold text-white mb-4">Create New Workflow</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Workflow Name</label>
            <input
              v-model="newWorkflow.name"
              type="text"
              placeholder="e.g., Weekly Cleanup"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Trigger</label>
            <select
              v-model="newWorkflow.trigger"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="schedule">Scheduled</option>
              <option value="file-change">File Change</option>
              <option value="size-threshold">Size Threshold</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-slate-300 mb-2">Actions</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input type="checkbox" v-model="newWorkflow.actions" value="cleanup" class="mr-2" />
              <span>Cleanup temporary files</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" v-model="newWorkflow.actions" value="compress" class="mr-2" />
              <span>Compress old files</span>
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="newWorkflow.actions"
                value="duplicate-check"
                class="mr-2"
              />
              <span>Check for duplicates</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" v-model="newWorkflow.actions" value="backup" class="mr-2" />
              <span>Backup important files</span>
            </label>
          </div>
        </div>
        <button
          @click="createWorkflow"
          :disabled="!newWorkflow.name || newWorkflow.actions.length === 0"
          class="mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <Plus class="w-4 h-4 mr-2" />
          Create Workflow
        </button>
      </div>

      <!-- Active Workflows -->
      <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 class="text-lg font-semibold text-white mb-4">Active Workflows</h3>
        <div v-if="workflows.length === 0" class="text-center py-8">
          <Cpu class="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p class="text-slate-400">No workflows created yet</p>
        </div>
        <div v-else class="flex flex-col gap-4">
          <div
            v-for="workflow in workflows"
            :key="workflow.id"
            class="flex items-center justify-between p-4 bg-slate-700 rounded-lg"
          >
            <div class="flex-1">
              <div class="flex items-center">
                <component
                  :is="getTriggerIcon(workflow.trigger)"
                  class="w-5 h-5 text-slate-400 mr-2"
                />
                <span class="font-medium text-white">{{ workflow.name }}</span>
              </div>
              <div class="text-sm text-slate-400 mt-1">
                {{ getTriggerDescription(workflow.trigger) }} • {{ workflow.actions.join(", ") }}
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="toggleWorkflow(workflow.id)"
                :class="[
                  'p-2 rounded-lg transition-colors',
                  workflow.enabled
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-300',
                ]"
              >
                <Play v-if="!workflow.enabled" class="w-4 h-4" />
                <Pause v-else class="w-4 h-4" />
              </button>
              <button
                @click="deleteWorkflow(workflow.id)"
                class="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Execution History -->
      <div
        v-if="executionHistory.length > 0"
        class="bg-slate-800 rounded-lg p-6 border border-slate-700 mt-8"
      >
        <h3 class="text-lg font-semibold text-white mb-4">Execution History</h3>
        <div class="space-y-2">
          <div
            v-for="execution in executionHistory.slice(0, 10)"
            :key="execution.id"
            class="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
          >
            <div>
              <div class="font-medium text-white">{{ execution.workflowName }}</div>
              <div class="text-sm text-slate-400">{{ formatDate(execution.timestamp) }}</div>
            </div>
            <div class="flex items-center">
              <component :is="getStatusIcon(execution.status)" class="w-4 h-4 mr-2" />
              <span class="text-sm">{{ execution.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  Cpu,
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-vue-next";

interface Workflow {
  id: string;
  name: string;
  trigger: "schedule" | "file-change" | "size-threshold" | "manual";
  actions: string[];
  enabled: boolean;
  createdAt: Date;
}

interface ExecutionHistory {
  id: string;
  workflowId: string;
  workflowName: string;
  timestamp: Date;
  status: "success" | "failed" | "running";
  details?: string;
}

const workflows = ref<Workflow[]>([]);
const executionHistory = ref<ExecutionHistory[]>([]);

const newWorkflow = ref({
  name: "",
  trigger: "manual" as Workflow["trigger"],
  actions: [] as string[],
});

const createWorkflow = () => {
  if (!newWorkflow.value.name || newWorkflow.value.actions.length === 0) return;

  const workflow: Workflow = {
    id: Date.now().toString(),
    name: newWorkflow.value.name,
    trigger: newWorkflow.value.trigger,
    actions: [...newWorkflow.value.actions],
    enabled: true,
    createdAt: new Date(),
  };

  workflows.value.push(workflow);

  // Reset form
  newWorkflow.value = {
    name: "",
    trigger: "manual",
    actions: [],
  };

  // Save to localStorage
  saveWorkflows();
};

const toggleWorkflow = (workflowId: string) => {
  const workflow = workflows.value.find((w) => w.id === workflowId);
  if (workflow) {
    workflow.enabled = !workflow.enabled;
    saveWorkflows();

    // Add to execution history
    executionHistory.value.unshift({
      id: Date.now().toString(),
      workflowId,
      workflowName: workflow.name,
      timestamp: new Date(),
      status: workflow.enabled ? "success" : "failed",
      details: workflow.enabled ? "Workflow enabled" : "Workflow disabled",
    });
  }
};

const deleteWorkflow = (workflowId: string) => {
  const index = workflows.value.findIndex((w) => w.id === workflowId);
  if (index !== -1) {
    workflows.value.splice(index, 1);
    saveWorkflows();
  }
};

const getTriggerIcon = (trigger: string) => {
  switch (trigger) {
    case "schedule":
      return Calendar;
    case "file-change":
      return FileText;
    case "size-threshold":
      return AlertCircle;
    default:
      return Play;
  }
};

const getTriggerDescription = (trigger: string) => {
  switch (trigger) {
    case "schedule":
      return "Scheduled";
    case "file-change":
      return "On file change";
    case "size-threshold":
      return "When size threshold reached";
    case "manual":
      return "Manual trigger";
    default:
      return trigger;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "success":
      return CheckCircle;
    case "failed":
      return AlertCircle;
    case "running":
      return Clock;
    default:
      return Clock;
  }
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const saveWorkflows = () => {
  localStorage.setItem("automation-workflows", JSON.stringify(workflows.value));
};

const loadWorkflows = () => {
  const saved = localStorage.getItem("automation-workflows");
  if (saved) {
    workflows.value = JSON.parse(saved);
  }
};

onMounted(() => {
  loadWorkflows();
});
</script>
