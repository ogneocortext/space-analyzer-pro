<template>
  <div class="enhanced-dashboard">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <p class="text-gray-400">Welcome back! Here's your space analysis overview.</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
          />
        </div>
        <button
          @click="refreshData"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw class="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- System Status -->
    <div
      :class="[
        'mb-6 p-4 rounded-lg border',
        systemStatus.status === 'healthy' ? 'bg-green-900/20 border-green-800' :
        systemStatus.status === 'warning' ? 'bg-yellow-900/20 border-yellow-800' :
        'bg-red-900/20 border-red-800'
      ]"
    >
      <div class="flex items-center gap-3">
        <CheckCircle
          v-if="systemStatus.status === 'healthy'"
          class="w-5 h-5 text-green-400"
        />
        <AlertTriangle
          v-else-if="systemStatus.status === 'warning'"
          class="w-5 h-5 text-yellow-400"
        />
        <AlertTriangle v-else class="w-5 h-5 text-red-400" />
        <div>
          <p class="font-medium text-white">{{ systemStatus.message }}</p>
          <p class="text-sm text-gray-400">Last checked: {{ systemStatus.lastCheck.toLocaleString() }}</p>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Folder class="w-6 h-6 text-blue-400" />
          <h3 class="text-lg font-semibold text-white">Total Files</h3>
        </div>
        <div class="text-3xl font-bold text-white mb-2">12,458</div>
        <p class="text-sm text-gray-400">+5.2% from last week</p>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Database class="w-6 h-6 text-purple-400" />
          <h3 class="text-lg font-semibold text-white">Storage Used</h3>
        </div>
        <div class="text-3xl font-bold text-white mb-2">847 GB</div>
        <p class="text-sm text-gray-400">of 2 TB total</p>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Activity class="w-6 h-6 text-green-400" />
          <h3 class="text-lg font-semibold text-white">Analysis Speed</h3>
        </div>
        <div class="text-3xl font-bold text-white mb-2">2,450</div>
        <p class="text-sm text-gray-400">files/second</p>
      </div>

      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <BrainCircuit class="w-6 h-6 text-yellow-400" />
          <h3 class="text-lg font-semibold text-white">AI Insights</h3>
        </div>
        <div class="text-3xl font-bold text-white mb-2">156</div>
        <p class="text-sm text-gray-400">recommendations generated</p>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-white mb-4">Quick Actions</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          v-for="action in quickActions"
          :key="action.id"
          @click="action.onClick"
          :disabled="action.disabled"
          :class="[
            'flex items-center gap-3 p-4 rounded-lg border transition-colors',
            action.disabled
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 border-gray-700 hover:border-blue-500 text-white'
          ]"
        >
          <component :is="action.icon" class="w-5 h-5" />
          <div class="text-left">
            <p class="font-medium">{{ action.label }}</p>
            <p class="text-xs text-gray-400">{{ action.description }}</p>
          </div>
          <span v-if="action.beta" class="ml-auto text-xs px-2 py-1 bg-blue-600 rounded">Beta</span>
        </button>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-white mb-4">Recent Activity</h2>
      <div class="space-y-3">
        <div
          v-for="activity in recentActivity"
          :key="activity.id"
          class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
        >
          <CheckCircle
            v-if="activity.status === 'success'"
            class="w-5 h-5 text-green-400"
          />
          <AlertTriangle
            v-else-if="activity.status === 'warning'"
            class="w-5 h-5 text-yellow-400"
          />
          <AlertTriangle v-else class="w-5 h-5 text-red-400" />
          <div class="flex-1">
            <p class="text-white">{{ activity.action }}</p>
            <p class="text-sm text-gray-400">{{ formatTime(activity.timestamp) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  Folder,
  FileText,
  Settings,
  AlertTriangle,
  TrendingUp,
  Database,
  Cpu,
  Activity,
  Play,
  RefreshCw,
  Clock,
  Users,
  Globe2,
  Info,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: any;
  onClick: () => void;
  disabled?: boolean;
  beta?: boolean;
}

interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastCheck: Date;
}

const systemStatus = ref<SystemStatus>({
  status: 'healthy',
  message: 'All systems operational',
  lastCheck: new Date(),
});

const searchQuery = ref('');

const recentActivity = ref<
  Array<{
    id: string;
    action: string;
    timestamp: Date;
    status: 'success' | 'warning' | 'error';
  }>
>([
  {
    id: '1',
    action: 'Analysis completed',
    timestamp: new Date(Date.now() - 60000),
    status: 'success',
  },
  {
    id: '2',
    action: 'AI insights generated',
    timestamp: new Date(Date.now() - 300000),
    status: 'success',
  },
  {
    id: '3',
    action: 'Duplicate files detected',
    timestamp: new Date(Date.now() - 600000),
    status: 'warning',
  },
  {
    id: '4',
    action: 'Storage optimization applied',
    timestamp: new Date(Date.now() - 900000),
    status: 'success',
  },
]);

const quickActions: QuickAction[] = [
  {
    id: '1',
    label: 'Start Analysis',
    description: 'Analyze your file system',
    icon: Play,
    onClick: () => {
      console.warn('Starting analysis...');
    },
  },
  {
    id: '2',
    label: 'AI Insights',
    description: 'Get AI-powered recommendations',
    icon: BrainCircuit,
    onClick: () => {
      console.warn('Opening AI insights...');
    },
    beta: true,
  },
  {
    id: '3',
    label: 'File Browser',
    description: 'Browse and manage files',
    icon: Folder,
    onClick: () => {
      console.warn('Opening file browser...');
    },
  },
  {
    id: '4',
    label: 'Settings',
    description: 'Configure preferences',
    icon: Settings,
    onClick: () => {
      console.warn('Opening settings...');
    },
  },
];

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

const refreshData = () => {
  console.warn('Refreshing data...');
  systemStatus.value.lastCheck = new Date();
};
</script>

<style scoped>
.enhanced-dashboard {
  @apply p-6;
}
</style>
