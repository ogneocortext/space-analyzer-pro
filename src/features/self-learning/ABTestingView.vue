<template>
  <div class="ab-testing-view">
    <div class="view-header">
      <h1>🧪 A/B Testing Framework</h1>
      <p>Enterprise-grade A/B testing for recommendation effectiveness optimization</p>
      <button class="btn-create" @click="showCreateModal = true" :disabled="isLoading">
        + Create New Test
      </button>
    </div>

    <div class="ab-testing-content">
      <!-- Active Tests Section -->
      <div class="testing-section">
        <h2>🔄 Active Tests</h2>
        <div v-if="activeTests.length === 0" class="empty-state">
          <p>No active tests. Create one to get started!</p>
        </div>
        <div v-else class="test-list">
          <div v-for="test in activeTests" :key="test.id" class="test-card">
            <div class="test-info">
              <h4>{{ test.name }}</h4>
              <p>{{ test.description }}</p>
              <div class="test-meta">
                <span :class="['status-badge', test.status]">{{ test.status }}</span>
                <span class="variant-count">{{ test.variants.length }} variants</span>
                <span class="duration">{{ test.duration }}h duration</span>
              </div>
            </div>
            <div class="test-actions">
              <button
                v-if="test.status === 'draft'"
                class="btn-start"
                @click="startTest(test.id)"
                :disabled="isLoading"
              >
                ▶ Start
              </button>
              <button
                v-if="test.status === 'running'"
                class="btn-pause"
                @click="pauseTest(test.id)"
                :disabled="isLoading"
              >
                ⏸ Pause
              </button>
              <button
                v-if="test.status === 'paused'"
                class="btn-resume"
                @click="startTest(test.id)"
                :disabled="isLoading"
              >
                ▶ Resume
              </button>
              <button
                v-if="test.status === 'running' || test.status === 'paused'"
                class="btn-stop"
                @click="stopTest(test.id)"
                :disabled="isLoading"
              >
                ⏹ Stop
              </button>
              <button class="btn-delete" @click="deleteTest(test.id)" :disabled="isLoading">
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Completed Tests Section -->
      <div class="testing-section">
        <h2>📊 Test History</h2>
        <div v-if="completedTests.length === 0" class="empty-state">
          <p>No completed tests yet.</p>
        </div>
        <div v-else class="test-list">
          <div v-for="test in completedTests" :key="test.id" class="test-card completed">
            <div class="test-info">
              <h4>{{ test.name }}</h4>
              <p>{{ test.description }}</p>
              <div class="test-meta">
                <span class="status-badge completed">completed</span>
                <span v-if="test.results?.winner" class="winner-badge">
                  🏆 Winner: {{ test.results.winner }}
                </span>
                <span v-if="test.results?.confidence" class="confidence-badge">
                  {{ Math.round(test.results.confidence * 100) }}% confidence
                </span>
              </div>
            </div>
            <div class="test-actions">
              <button class="btn-view" @click="viewTestResults(test)">📈 View Results</button>
              <button class="btn-delete" @click="deleteTest(test.id)" :disabled="isLoading">
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Analysis Report Component -->
      <ABTestAnalysisReport v-if="selectedTest" :test-id="selectedTest.id" />
    </div>

    <!-- Create Test Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create New A/B Test</h3>
          <p class="modal-subtitle">Compare two versions to see which performs better</p>
        </div>

        <!-- Step 1: Test Details -->
        <div class="form-section">
          <h4 class="section-title">1. Test Details <span class="required">*</span></h4>
          <div class="form-group">
            <label>What are you testing?</label>
            <input
              v-model="newTest.name"
              type="text"
              placeholder="e.g., New vs Old Recommendation Layout"
            />
            <span class="help-text">Give your test a clear, descriptive name</span>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="newTest.description"
              placeholder="Describe what you're trying to improve (e.g., 'Testing if a compact layout increases user engagement')"
              rows="2"
            ></textarea>
          </div>
        </div>

        <!-- Step 2: Test Settings -->
        <div class="form-section">
          <h4 class="section-title">2. Test Settings</h4>
          <div class="form-row">
            <div class="form-group">
              <label>How long to run?</label>
              <div class="input-with-unit">
                <input v-model.number="newTest.duration" type="number" min="1" max="168" />
                <span class="unit">hours</span>
              </div>
              <span class="help-text">Recommended: 24-48 hours for meaningful results</span>
            </div>
            <div class="form-group">
              <label>Traffic percentage</label>
              <div class="input-with-unit">
                <input v-model.number="newTest.trafficSplit" type="number" min="10" max="100" />
                <span class="unit">%</span>
              </div>
              <span class="help-text">% of users who will see this test</span>
            </div>
          </div>
        </div>

        <!-- Step 3: Variants -->
        <div class="form-section">
          <h4 class="section-title">3. Define Variants</h4>
          <p class="section-help">
            The <strong>Control</strong> is your current version. The <strong>Treatment</strong> is
            your new version.
          </p>
          <div class="variants-list">
            <div
              v-for="(variant, index) in newTest.variants"
              :key="index"
              class="variant-card"
              :class="variant.type"
            >
              <div class="variant-header">
                <span class="variant-badge" :class="variant.type">
                  {{ variant.type === "control" ? "A" : String.fromCharCode(66 + index - 1) }}
                </span>
                <span class="variant-type-label">{{
                  variant.type === "control" ? "Current (Control)" : "New (Treatment)"
                }}</span>
                <button
                  v-if="variant.type === 'treatment' && newTest.variants.length > 2"
                  class="btn-remove-variant"
                  @click="removeVariant(index)"
                  title="Remove this variant"
                >
                  ×
                </button>
              </div>
              <input
                v-model="variant.name"
                type="text"
                :placeholder="
                  variant.type === 'control' ? 'e.g., Current Layout' : 'e.g., New Compact Layout'
                "
                class="variant-name-input"
              />
            </div>
          </div>
          <button v-if="newTest.variants.length < 4" class="btn-add-variant" @click="addVariant">
            <span class="plus">+</span>
            <span>Add another variant (max 4)</span>
          </button>
        </div>

        <!-- Validation Messages -->
        <div v-if="!isValidTest" class="validation-message">
          <span class="warning-icon">⚠️</span>
          <span>Please fill in all required fields (marked with *)</span>
        </div>

        <!-- Summary Preview -->
        <div v-else class="test-preview">
          <h4>Test Summary</h4>
          <p>
            You'll compare <strong>{{ newTest.variants.length }} versions</strong> over
            <strong>{{ newTest.duration }} hours</strong> with
            <strong>{{ newTest.trafficSplit }}% of users</strong>
          </p>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="showCreateModal = false">Cancel</button>
          <button class="btn-save" @click="createTest" :disabled="!isValidTest || isLoading">
            {{ isLoading ? "Creating..." : "🚀 Start Test" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import ABTestAnalysisReport from "@/components/ai/ABTestAnalysisReport.vue";
import { abTestingFramework, ABTest } from "@/store/abTestingFramework";

const activeTests = ref<ABTest[]>([]);
const completedTests = ref<ABTest[]>([]);
const isLoading = ref(false);
const showCreateModal = ref(false);
const selectedTest = ref<ABTest | null>(null);

const newTest = ref({
  name: "",
  description: "",
  duration: 24,
  trafficSplit: 50,
  variants: [
    { name: "Control", type: "control" as const },
    { name: "Treatment A", type: "treatment" as const },
  ],
});

const isValidTest = computed(() => {
  return (
    newTest.value.name.trim() &&
    newTest.value.description.trim() &&
    newTest.value.variants.every((v) => v.name.trim()) &&
    newTest.value.variants.filter((v) => v.type === "control").length === 1
  );
});

const loadTests = async () => {
  try {
    activeTests.value = await abTestingFramework.getActiveTests();
    completedTests.value = await abTestingFramework.getTestHistory();
  } catch (error) {
    console.error("Failed to load tests:", error);
  }
};

const createTest = async () => {
  isLoading.value = true;
  try {
    await abTestingFramework.createTest({
      name: newTest.value.name,
      description: newTest.value.description,
      duration: newTest.value.duration,
      trafficSplit: newTest.value.trafficSplit,
      variants: newTest.value.variants.map((v) => ({
        ...v,
        id: crypto.randomUUID(),
        description: `${v.name} variant`,
        trafficAllocation: v.type === "control" ? 50 : 50 / (newTest.value.variants.length - 1),
        config: {
          algorithm: "traditional",
          weights: {},
          filters: [],
        },
      })),
      targetAudience: {
        segments: ["all"],
        filters: {},
        sampleSize: 1000,
        criteria: { minActivity: 1, timeWindow: 30 },
      },
      successMetrics: [
        { name: "conversion", type: "conversion", weight: 1, target: 0.1, measurement: "rate" },
      ],
      minSampleSize: 100,
      confidenceLevel: 0.95,
    });
    showCreateModal.value = false;
    resetNewTest();
    await loadTests();
  } catch (error) {
    console.error("Failed to create test:", error);
  } finally {
    isLoading.value = false;
  }
};

const startTest = async (testId: string) => {
  isLoading.value = true;
  try {
    await abTestingFramework.startTest(testId);
    await loadTests();
  } catch (error) {
    console.error("Failed to start test:", error);
  } finally {
    isLoading.value = false;
  }
};

const pauseTest = async (testId: string) => {
  isLoading.value = true;
  try {
    await abTestingFramework.pauseTest(testId);
    await loadTests();
  } catch (error) {
    console.error("Failed to pause test:", error);
  } finally {
    isLoading.value = false;
  }
};

const stopTest = async (testId: string) => {
  isLoading.value = true;
  try {
    await abTestingFramework.stopTest(testId);
    await loadTests();
  } catch (error) {
    console.error("Failed to stop test:", error);
  } finally {
    isLoading.value = false;
  }
};

const deleteTest = async (testId: string) => {
  if (!confirm("Are you sure you want to delete this test?")) return;
  isLoading.value = true;
  try {
    await abTestingFramework.deleteTest(testId);
    await loadTests();
  } catch (error) {
    console.error("Failed to delete test:", error);
  } finally {
    isLoading.value = false;
  }
};

const viewTestResults = (test: ABTest) => {
  selectedTest.value = test;
};

const addVariant = () => {
  newTest.value.variants.push({
    name: `Treatment ${String.fromCharCode(65 + newTest.value.variants.length - 1)}`,
    type: "treatment" as const,
  });
};

const removeVariant = (index: number) => {
  newTest.value.variants.splice(index, 1);
};

const resetNewTest = () => {
  newTest.value = {
    name: "",
    description: "",
    duration: 24,
    trafficSplit: 50,
    variants: [
      { name: "Control", type: "control" as const },
      { name: "Treatment A", type: "treatment" as const },
    ],
  };
};

onMounted(() => {
  loadTests();
});
</script>

<style scoped>
.ab-testing-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 2rem;
  text-align: center;
}

.view-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary, #fafaf9);
}

.view-header p {
  font-size: 1.1rem;
  color: var(--text-secondary, #6b6b70);
  max-width: 600px;
  margin: 0 auto 1rem;
}

.btn-create {
  background: var(--accent-emerald, #32d583);
  color: var(--text-inverse, #0b0b0e);
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-create:hover:not(:disabled) {
  background: var(--accent-emerald-hover, #27ae60);
  transform: translateY(-1px);
}

.btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ab-testing-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.testing-section {
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  padding: 1.5rem;
}

.testing-section h2 {
  font-size: 1.5rem;
  color: var(--text-primary, #fafaf9);
  margin-bottom: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary, #6b6b70);
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.test-card {
  background: var(--bg-elevated, #1a1a1e);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.test-card.completed {
  border-left: 4px solid var(--accent-indigo, #6366f1);
}

.test-info {
  flex: 1;
}

.test-info h4 {
  font-size: 1.25rem;
  color: var(--text-primary, #fafaf9);
  margin-bottom: 0.5rem;
}

.test-info p {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.test-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.draft {
  background: var(--text-tertiary, #71717a);
  color: var(--text-inverse, #0b0b0e);
}

.status-badge.running {
  background: var(--accent-emerald, #32d583);
  color: var(--text-inverse, #0b0b0e);
}

.status-badge.paused {
  background: var(--accent-amber, #ffb547);
  color: var(--text-inverse, #0b0b0e);
}

.status-badge.completed {
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
}

.variant-count,
.duration {
  font-size: 0.85rem;
  color: var(--text-secondary, #a1a1aa);
}

.winner-badge {
  background: var(--accent-coral, #e85a4f);
  color: var(--text-inverse, #0b0b0e);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.confidence-badge {
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
}

.test-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.test-actions button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.test-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start,
.btn-resume {
  background: var(--accent-emerald, #32d583);
  color: var(--text-inverse, #0b0b0e);
}

.btn-start:hover:not(:disabled),
.btn-resume:hover:not(:disabled) {
  background: var(--accent-emerald-hover, #27ae60);
}

.btn-pause {
  background: var(--accent-amber, #ffb547);
  color: var(--text-inverse, #0b0b0e);
}

.btn-pause:hover:not(:disabled) {
  background: #f59e0b;
}

.btn-stop {
  background: var(--accent-coral, #e85a4f);
  color: var(--text-inverse, #0b0b0e);
}

.btn-stop:hover:not(:disabled) {
  background: #dc2626;
}

.btn-delete {
  background: transparent;
  color: var(--text-tertiary, #71717a);
  border: 1px solid var(--border-subtle, #2a2a2e);
}

.btn-delete:hover:not(:disabled) {
  color: var(--accent-coral, #e85a4f);
  border-color: var(--accent-coral, #e85a4f);
}

.btn-view {
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
}

.btn-view:hover:not(:disabled) {
  background: var(--accent-indigo-hover, #4f46e5);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  padding: 2rem;
  max-width: 550px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  text-align: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle, #2a2a2e);
}

.modal-header h3 {
  color: var(--text-primary, #fafaf9);
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}

.modal-subtitle {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.95rem;
  margin: 0;
}

.form-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-subtle, #2a2a2e);
}

.form-section:last-of-type {
  border-bottom: none;
}

.section-title {
  font-size: 1.1rem;
  color: var(--text-primary, #fafaf9);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.section-title .required {
  color: var(--accent-coral, #e85a4f);
}

.section-help {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 6px;
}

.section-help strong {
  color: var(--text-primary, #fafaf9);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-elevated, #1a1a1e);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 6px;
  color: var(--text-primary, #fafaf9);
  font-size: 0.95rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent-indigo, #6366f1);
}

.help-text {
  display: block;
  font-size: 0.8rem;
  color: var(--text-tertiary, #71717a);
  margin-top: 0.25rem;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-with-unit input {
  flex: 1;
}

.input-with-unit .unit {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.9rem;
  min-width: 50px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* Variant Cards */
.variants-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.variant-card {
  background: var(--bg-elevated, #1a1a1e);
  border: 2px solid var(--border-subtle, #2a2a2e);
  border-radius: 8px;
  padding: 1rem;
}

.variant-card.control {
  border-color: var(--accent-indigo, #6366f1);
}

.variant-card.treatment {
  border-color: var(--accent-emerald, #32d583);
}

.variant-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.variant-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.85rem;
}

.variant-badge.control {
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
}

.variant-badge.treatment {
  background: var(--accent-emerald, #32d583);
  color: var(--text-inverse, #0b0b0e);
}

.variant-type-label {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-secondary, #a1a1aa);
  font-weight: 500;
}

.btn-remove-variant {
  background: transparent;
  border: none;
  color: var(--accent-coral, #e85a4f);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.variant-name-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 4px;
  color: var(--text-primary, #fafaf9);
  font-size: 0.9rem;
}

.variant-name-input:focus {
  outline: none;
  border-color: var(--accent-indigo, #6366f1);
}

.btn-add-variant {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  border: 1px dashed var(--border-subtle, #2a2a2e);
  color: var(--text-secondary, #a1a1aa);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 0.5rem;
  width: 100%;
  font-size: 0.9rem;
}

.btn-add-variant:hover {
  border-color: var(--accent-indigo, #6366f1);
  color: var(--accent-indigo, #6366f1);
}

.btn-add-variant .plus {
  font-size: 1.2rem;
  font-weight: 600;
}

/* Validation & Preview */
.validation-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(232, 90, 79, 0.1);
  border: 1px solid var(--accent-coral, #e85a4f);
  border-radius: 8px;
  color: var(--accent-coral, #e85a4f);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.test-preview {
  padding: 1rem;
  background: var(--bg-elevated, #1a1a1e);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.test-preview h4 {
  color: var(--text-primary, #fafaf9);
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.test-preview p {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.9rem;
  margin: 0;
}

.test-preview strong {
  color: var(--accent-emerald, #32d583);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle, #2a2a2e);
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-subtle, #2a2a2e);
  color: var(--text-secondary, #a1a1aa);
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
}

.btn-cancel:hover {
  border-color: var(--text-tertiary, #71717a);
  color: var(--text-primary, #fafaf9);
}

.btn-save {
  background: var(--accent-indigo, #6366f1);
  color: var(--text-inverse, #0b0b0e);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent-indigo-hover, #4f46e5);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .ab-testing-view {
    padding: 1rem;
  }

  .view-header h1 {
    font-size: 2rem;
  }

  .test-card {
    flex-direction: column;
  }

  .test-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
