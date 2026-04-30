<template>
  <div class="self-learning-engine">
    <div class="learning-header">
      <h3>🧠 Self-Learning System</h3>
      <div class="learning-status">
        <span :class="['status-badge', learningStatus]">
          {{ learningStatusText }}
        </span>
        <span class="patterns-count"> {{ patterns.length }} patterns learned </span>
      </div>
    </div>

    <div class="learning-controls">
      <button
        @click="toggleLearning"
        :class="['btn', learningEnabled ? 'btn-danger' : 'btn-primary']"
      >
        {{ learningEnabled ? "Disable Learning" : "Enable Learning" }}
      </button>
      <button @click="resetPatterns" class="btn btn-secondary">Reset Patterns</button>
      <button @click="exportPatterns" class="btn btn-outline">Export Patterns</button>
    </div>

    <div class="patterns-display">
      <h4>Learned Patterns</h4>
      <div class="patterns-grid">
        <div
          v-for="pattern in patterns"
          :key="pattern.id"
          class="pattern-card"
          :class="{ 'high-confidence': pattern.confidence > 0.8 }"
        >
          <div class="pattern-header">
            <span class="pattern-type">{{ pattern.type }}</span>
            <span class="pattern-confidence"> {{ Math.round(pattern.confidence * 100) }}% </span>
          </div>
          <div class="pattern-description">
            {{ pattern.description }}
          </div>
          <div class="pattern-actions">
            <span class="pattern-frequency"> Used {{ pattern.frequency }} times </span>
            <button @click="applyPattern(pattern)" class="btn btn-sm">Apply</button>
          </div>
        </div>
      </div>
    </div>

    <div class="recommendations-panel">
      <h4>Personalized Recommendations</h4>
      <div class="recommendations-list">
        <div
          v-for="recommendation in recommendations"
          :key="recommendation.id"
          class="recommendation-item"
          :class="recommendation.priority"
        >
          <div class="rec-header">
            <span class="rec-type">{{ recommendation.type }}</span>
            <span class="rec-score"> {{ Math.round(recommendation.score * 100) }}% </span>
          </div>
          <div class="rec-content">
            <h5>{{ recommendation.title }}</h5>
            <p>{{ recommendation.description }}</p>
          </div>
          <div class="rec-actions">
            <button @click="acceptRecommendation(recommendation)" class="btn btn-sm btn-primary">
              Accept
            </button>
            <button @click="dismissRecommendation(recommendation)" class="btn btn-sm btn-outline">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useSelfLearningStore } from "@/store/selfLearning";

interface LearningPattern {
  id: string;
  type: "file-access" | "directory-preference" | "time-pattern" | "cleanup-habit";
  description: string;
  confidence: number;
  frequency: number;
  data: any;
  createdAt: Date;
  lastUsed: Date;
}

interface Recommendation {
  id: string;
  type: "cleanup" | "organization" | "access-shortcut" | "schedule";
  title: string;
  description: string;
  score: number;
  priority: "high" | "medium" | "low";
  actions: any[];
}

const selfLearningStore = useSelfLearningStore();

const learningEnabled = ref(true);
const patterns = ref<LearningPattern[]>([]);
const recommendations = ref<Recommendation[]>([]);
const isLearning = ref(false);

const learningStatus = computed(() => {
  if (!learningEnabled.value) return "disabled";
  if (!isLearning.value) return "inactive";
  if (patterns.value.length === 0) return "learning";
  return "active";
});

const learningStatusText = computed(() => {
  switch (learningStatus.value) {
    case "disabled":
      return "Learning Disabled";
    case "inactive":
      return "Learning Inactive";
    case "learning":
      return "Learning Patterns...";
    case "active":
      return "Learning Active";
    default:
      return "Unknown";
  }
});

const toggleLearning = () => {
  learningEnabled.value = !learningEnabled.value;
  if (learningEnabled.value) {
    isLearning.value = true;
    startLearning();
  } else {
    isLearning.value = false;
    stopLearning();
  }
};

const startLearning = () => {
  isLearning.value = true;
  selfLearningStore.startLearning();
  loadPatterns();
  generateRecommendations();
};

const stopLearning = () => {
  isLearning.value = false;
  selfLearningStore.stopLearning();
};

const loadPatterns = async () => {
  try {
    const loadedPatterns = await selfLearningStore.getPatterns();
    patterns.value = loadedPatterns;
  } catch (error) {
    console.error("Failed to load patterns:", error);
  }
};

const resetPatterns = async () => {
  if (confirm("Are you sure you want to reset all learned patterns?")) {
    await selfLearningStore.resetPatterns();
    patterns.value = [];
    recommendations.value = [];
  }
};

const exportPatterns = async () => {
  try {
    const patternsData = await selfLearningStore.exportPatterns();
    const blob = new Blob([JSON.stringify(patternsData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `self-learning-patterns-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export patterns:", error);
  }
};

const generateRecommendations = async () => {
  try {
    const recs = await selfLearningStore.generateRecommendations();
    recommendations.value = recs;
  } catch (error) {
    console.error("Failed to generate recommendations:", error);
  }
};

const applyPattern = async (pattern: LearningPattern) => {
  try {
    await selfLearningStore.applyPattern(pattern.id);
    pattern.frequency++;
    pattern.lastUsed = new Date();
  } catch (error) {
    console.error("Failed to apply pattern:", error);
  }
};

const acceptRecommendation = async (recommendation: Recommendation) => {
  try {
    await selfLearningStore.acceptRecommendation(recommendation.id);
    recommendations.value = recommendations.value.filter((r) => r.id !== recommendation.id);
  } catch (error) {
    console.error("Failed to accept recommendation:", error);
  }
};

const dismissRecommendation = async (recommendation: Recommendation) => {
  try {
    await selfLearningStore.dismissRecommendation(recommendation.id);
    recommendations.value = recommendations.value.filter((r) => r.id !== recommendation.id);
  } catch (error) {
    console.error("Failed to dismiss recommendation:", error);
  }
};

// Watch for learning status changes
watch(learningEnabled, (newValue) => {
  if (newValue) {
    generateRecommendations();
  }
});

onMounted(() => {
  if (learningEnabled.value) {
    startLearning();
  }
});
</script>

<style scoped>
.self-learning-engine {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 1rem 0;
}

.learning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.learning-status {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.active {
  background: #10b981;
  color: white;
}

.status-badge.learning {
  background: #3b82f6;
  color: white;
}

.status-badge.disabled {
  background: #6b7280;
  color: white;
}

.patterns-count {
  color: #6b7280;
  font-size: 0.875rem;
}

.learning-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.patterns-display,
.recommendations-panel {
  margin-bottom: 2rem;
}

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.pattern-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.pattern-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.pattern-card.high-confidence {
  border-left: 4px solid #10b981;
}

.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.pattern-type {
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.pattern-confidence {
  color: #10b981;
  font-weight: 600;
  font-size: 0.875rem;
}

.pattern-description {
  color: #374151;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.pattern-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pattern-frequency {
  color: #6b7280;
  font-size: 0.75rem;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.recommendation-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.recommendation-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.recommendation-item.high {
  border-left: 4px solid #ef4444;
}

.recommendation-item.medium {
  border-left: 4px solid #f59e0b;
}

.recommendation-item.low {
  border-left: 4px solid #3b82f6;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.rec-type {
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.rec-score {
  color: #10b981;
  font-weight: 600;
  font-size: 0.875rem;
}

.rec-content h5 {
  margin: 0 0 0.5rem 0;
  color: #111827;
  font-size: 1rem;
}

.rec-content p {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.rec-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-outline {
  background: transparent;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-outline:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

h3,
h4,
h5 {
  margin: 0 0 1rem 0;
  color: #111827;
}

h3 {
  font-size: 1.25rem;
}

h4 {
  font-size: 1.125rem;
}
</style>
