<template>
  <div class="content-section">
    <h2>Development</h2>
    <p>Developer tools and APIs for extending Space Analyzer</p>

    <div v-if="isLoading || !analysisData" class="loading">
      <p>Loading developer tools...</p>
    </div>

    <div v-else class="development-section">
      <div class="tools-overview">
        <h3>Available Tools</h3>
        <div class="tools-grid">
          <div
            v-for="tool in tools"
            :key="tool.id"
            :class="['tool-card', selectedTool?.id === tool.id ? 'selected' : '']"
            @click="selectedTool = tool"
          >
            <div class="tool-header">
              <span class="tool-icon">{{ getToolIcon(tool.category) }}</span>
              <h4>{{ tool.name }}</h4>
              <span
                class="tool-status"
                :style="{ backgroundColor: getStatusColor(tool.status) }"
              >
                {{ tool.status }}
              </span>
            </div>
            <p>{{ tool.description }}</p>
            <div class="tool-footer">
              <span class="tool-category">{{ tool.category }}</span>
              <span class="tool-updated">
                Updated: {{ tool.lastUpdated.toLocaleDateString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="development-content">
        <div v-if="selectedTool" class="tool-details">
          <h3>{{ selectedTool.name }}</h3>
          <p class="tool-description">{{ selectedTool.description }}</p>

          <div class="tool-actions">
            <button class="tool-button">Documentation</button>
            <button class="tool-button">Download</button>
            <button class="tool-button">Examples</button>
          </div>

          <div class="tool-info">
            <div class="info-item">
              <span class="info-label">Category:</span>
              <span class="info-value">{{ selectedTool.category }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span
                class="info-value"
                :style="{ color: getStatusColor(selectedTool.status) }"
              >
                {{ selectedTool.status }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Last Updated:</span>
              <span class="info-value">
                {{ selectedTool.lastUpdated.toLocaleString() }}
              </span>
            </div>
          </div>

          <div v-if="selectedTool.category === 'api'" class="api-documentation">
            <h4>API Documentation</h4>
            <div class="code-block">
              <pre>{{ apiDocs }}</pre>
            </div>
          </div>
        </div>

        <div v-else class="no-selection">
          <h3>Select a Tool</h3>
          <p>Click on any tool card to view detailed information and documentation.</p>
        </div>
      </div>

      <div class="development-resources">
        <h3>Developer Resources</h3>
        <div class="resources-list">
          <div class="resource-card">
            <h4>📚 API Documentation</h4>
            <p>Complete API reference with examples and authentication guides.</p>
            <button class="resource-button">View Docs</button>
          </div>
          <div class="resource-card">
            <h4>🔧 SDK Downloads</h4>
            <p>Download SDKs for popular programming languages.</p>
            <button class="resource-button">Download</button>
          </div>
          <div class="resource-card">
            <h4>💡 Code Examples</h4>
            <p>Sample code and integration examples.</p>
            <button class="resource-button">View Examples</button>
          </div>
          <div class="resource-card">
            <h4>🐛 Bug Reports</h4>
            <p>Report issues and track development progress.</p>
            <button class="resource-button">Report Issue</button>
          </div>
        </div>
      </div>

      <div class="development-stats">
        <h3>Development Statistics</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>API Endpoints</h4>
            <div class="stat-value">15+</div>
            <div class="stat-label">Available endpoints</div>
          </div>
          <div class="stat-card">
            <h4>SDK Languages</h4>
            <div class="stat-value">5</div>
            <div class="stat-label">Supported languages</div>
          </div>
          <div class="stat-card">
            <h4>Active Integrations</h4>
            <div class="stat-value">12</div>
            <div class="stat-label">Third-party tools</div>
          </div>
          <div class="stat-card">
            <h4>Documentation</h4>
            <div class="stat-value">100%</div>
            <div class="stat-label">API coverage</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface DevTool {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'cli' | 'integration' | 'monitoring';
  status: 'available' | 'beta' | 'planned';
  lastUpdated: Date;
}

interface DevelopmentPageProps {
  analysisData: any;
  isLoading: boolean;
}

const props = defineProps<DevelopmentPageProps>();

const tools = ref<DevTool[]>([
  {
    id: '1',
    name: 'REST API',
    description: 'Full REST API for programmatic access to Space Analyzer features',
    category: 'api',
    status: 'available',
    lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    name: 'CLI Tool',
    description: 'Command-line interface for automated file analysis and reporting',
    category: 'cli',
    status: 'beta',
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    name: 'Webhooks',
    description: 'Real-time notifications for file system events and analysis results',
    category: 'integration',
    status: 'planned',
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    name: 'SDK',
    description: 'Software Development Kit for building custom integrations',
    category: 'integration',
    status: 'planned',
    lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: '5',
    name: 'Metrics API',
    description: 'Access to system metrics and performance data',
    category: 'monitoring',
    status: 'available',
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]);

const selectedTool = ref<DevTool | null>(null);
const apiDocs = ref('');

onMounted(() => {
  if (props.analysisData) {
    const docs = `
# Space Analyzer API Documentation

## Base URL
\`\`\`
http://localhost:8080/api
\`\`\`

## Authentication
API Key required in header:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Analyze Directory
\`\`\`
POST /analyze
Content-Type: application/json

{
  "directory": "/path/to/directory",
  "options": {
    "recursive": true,
    "includeHidden": false,
    "fileTypes": ["js", "ts", "json"]
  }
}
\`\`\`

### Get Analysis Results
\`\`\`
GET /results/{analysisId}
\`\`\`

### System Metrics
\`\`\`
GET /metrics
\`\`\`

### File Search
\`\`\`
GET /search?q=filename
\`\`\`

## Response Format
\`\`\`json
{
  "totalFiles": 1250,
  "totalSize": 50000000000,
  "categories": {
    "JavaScript": { "size": 1000000000, "count": 500 }
  },
  "ai_insights": {
    "storage_warnings": [],
    "optimization_suggestions": []
  }
}
\`\`\`
    `;
    apiDocs.value = docs;
  }
});

const getToolIcon = (category: string) => {
  switch (category) {
    case 'api':
      return '🔌';
    case 'cli':
      return '💻';
    case 'integration':
      return '🔗';
    case 'monitoring':
      return '📊';
    default:
      return '🛠️';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return '#10b981';
    case 'beta':
      return '#f59e0b';
    case 'planned':
      return '#6b7280';
    default:
      return '#6b7280';
  }
};
</script>

<style scoped>
.content-section {
  @apply p-6;
}

.content-section h2 {
  @apply text-2xl font-bold text-white mb-2;
}

.content-section > p {
  @apply text-gray-400 mb-6;
}

.loading {
  @apply flex items-center justify-center py-12;
}

.loading p {
  @apply text-gray-400;
}

.development-section {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

.tools-overview {
  @apply lg:col-span-1;
}

.tools-overview h3 {
  @apply text-lg font-semibold text-white mb-4;
}

.tools-grid {
  @apply space-y-3;
}

.tool-card {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer transition-colors hover:border-gray-600;
}

.tool-card.selected {
  @apply border-blue-500 bg-blue-500/10;
}

.tool-header {
  @apply flex items-center gap-2 mb-2;
}

.tool-icon {
  @apply text-xl;
}

.tool-header h4 {
  @apply text-sm font-medium text-white flex-1;
}

.tool-status {
  @apply px-2 py-0.5 rounded text-xs text-white;
}

.tool-card > p {
  @apply text-xs text-gray-400 mb-3;
}

.tool-footer {
  @apply flex justify-between text-xs text-gray-500;
}

.development-content {
  @apply lg:col-span-2;
}

.tool-details {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-6;
}

.tool-details h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.tool-description {
  @apply text-gray-400 mb-4;
}

.tool-actions {
  @apply flex gap-2 mb-6;
}

.tool-button {
  @apply px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors;
}

.tool-info {
  @apply space-y-2 mb-6;
}

.info-item {
  @apply flex justify-between text-sm;
}

.info-label {
  @apply text-gray-400;
}

.info-value {
  @apply text-white;
}

.api-documentation {
  @apply mt-6;
}

.api-documentation h4 {
  @apply text-sm font-medium text-white mb-3;
}

.code-block {
  @apply bg-gray-900 rounded-lg p-4 overflow-x-auto;
}

.code-block pre {
  @apply text-sm text-gray-300 whitespace-pre-wrap;
}

.no-selection {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-12 text-center;
}

.no-selection h3 {
  @apply text-lg font-semibold text-white mb-2;
}

.no-selection p {
  @apply text-gray-400;
}

.development-resources {
  @apply lg:col-span-3;
}

.development-resources h3 {
  @apply text-lg font-semibold text-white mb-4;
}

.resources-list {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.resource-card {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4;
}

.resource-card h4 {
  @apply text-sm font-medium text-white mb-2;
}

.resource-card > p {
  @apply text-xs text-gray-400 mb-3;
}

.resource-button {
  @apply w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors;
}

.development-stats {
  @apply lg:col-span-3;
}

.development-stats h3 {
  @apply text-lg font-semibold text-white mb-4;
}

.stats-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.stat-card {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4;
}

.stat-card h4 {
  @apply text-sm font-medium text-white mb-2;
}

.stat-value {
  @apply text-2xl font-bold text-blue-400 mb-1;
}

.stat-label {
  @apply text-xs text-gray-400;
}
</style>
