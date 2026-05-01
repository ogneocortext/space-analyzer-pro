<template>
  <div class="user-feedback-collection">
    <div class="feedback-header">
      <h4>💬 Help Us Improve</h4>
      <p class="feedback-subtitle">Your feedback helps us provide better recommendations</p>
    </div>

    <div class="feedback-form" v-if="!showThankYou">
      <div class="rating-section">
        <label class="rating-label">How helpful was this recommendation?</label>
        <div class="rating-stars">
          <button
            :aria-label="`Rate ${star} star${star > 1 ? 's' : ''}`"
            v-for="star in 5"
            :key="star"
            :class="['star-btn', { active: star <= rating }]"
            @click="setRating(star)"
            @mouseenter="hoverRating = star"
            @mouseleave="hoverRating = 0"
          >
            <span class="star">{{ star <= (hoverRating || rating) ? "★" : "☆" }}</span>
          </button>
        </div>
        <div class="rating-text" v-if="rating > 0">
          {{ getRatingText(rating) }}
        </div>
      </div>

      <div class="feedback-type-section">
        <label class="feedback-type-label">What type of feedback would you like to provide?</label>
        <div class="feedback-types">
          <label class="feedback-type-option">
            <input
              type="radio"
              v-model="feedbackType"
              value="general"
              class="feedback-type-radio"
            />
            <span class="feedback-type-text">General Feedback</span>
          </label>
          <label class="feedback-type-option">
            <input
              type="radio"
              v-model="feedbackType"
              value="specific"
              class="feedback-type-radio"
            />
            <span class="feedback-type-text">Specific Issue</span>
          </label>
          <label class="feedback-type-option">
            <input
              type="radio"
              v-model="feedbackType"
              value="suggestion"
              class="feedback-type-radio"
            />
            <span class="feedback-type-text">Improvement Suggestion</span>
          </label>
        </div>
      </div>

      <div class="categories-section" v-if="feedbackType === 'specific'">
        <label class="categories-label">What category best describes your feedback?</label>
        <div class="category-chips">
          <button
            :aria-label="category.name"
            v-for="category in feedbackCategories"
            :key="category.id"
            :class="['category-chip', { active: selectedCategories.includes(category.id) }]"
            @click="toggleCategory(category.id)"
          >
            {{ category.icon }} {{ category.name }}
          </button>
        </div>
      </div>

      <div class="comment-section">
        <label class="comment-label" :for="'feedback-comment-' + recommendationId">
          {{ getCommentLabel() }}
        </label>
        <textarea
          :id="'feedback-comment-' + recommendationId"
          v-model="comment"
          :placeholder="getCommentPlaceholder()"
          class="comment-textarea"
          rows="4"
          maxlength="500"
        ></textarea>
        <div class="character-count">{{ comment.length }}/500 characters</div>
      </div>

      <div class="context-section">
        <label class="context-label">Additional Context (Optional)</label>
        <div class="context-options">
          <label class="context-option">
            <input type="checkbox" v-model="contextOptions.relevant" class="context-checkbox" />
            <span class="context-text">This recommendation was relevant to my current task</span>
          </label>
          <label class="context-option">
            <input type="checkbox" v-model="contextOptions.timely" class="context-checkbox" />
            <span class="context-text">This recommendation came at the right time</span>
          </label>
          <label class="context-option">
            <input type="checkbox" v-model="contextOptions.actionable" class="context-checkbox" />
            <span class="context-text">I was able to act on this recommendation</span>
          </label>
          <label class="context-option">
            <input type="checkbox" v-model="contextOptions.new" class="context-checkbox" />
            <span class="context-text">This recommendation showed me something new</span>
          </label>
        </div>
      </div>

      <div class="follow-up-section" v-if="rating <= 2">
        <label class="follow-up-label">Would you like us to follow up on this feedback?</label>
        <div class="follow-up-options">
          <label class="follow-up-option">
            <input type="radio" v-model="followUp" value="yes" class="follow-up-radio" />
            <span class="follow-up-text">Yes, I'd like to hear about improvements</span>
          </label>
          <label class="follow-up-option">
            <input type="radio" v-model="followUp" value="no" class="follow-up-radio" />
            <span class="follow-up-text">No, thank you</span>
          </label>
        </div>
      </div>

      <div class="action-buttons">
        <button
          aria-label="Submit Feedback"
          @click="submitFeedback"
          :disabled="!isValidFeedback"
          class="submit-btn"
        >
          📤 Submit Feedback
        </button>
        <button aria-label="Skip" @click="skipFeedback" class="skip-btn">⏭️ Skip</button>
      </div>
    </div>

    <div class="thank-you-section" v-else>
      <div class="thank-you-content">
        <div class="thank-you-icon">🎉</div>
        <h5>Thank You for Your Feedback!</h5>
        <p>Your input helps us improve the recommendation system and provide better suggestions.</p>
        <div class="impact-info" v-if="feedbackImpact">
          <span class="impact-label">Your feedback impact:</span>
          <span class="impact-value">{{ feedbackImpact }}</span>
        </div>
        <button aria-label="Close" @click="closeFeedback" class="close-btn">✅ Got it</button>
      </div>
    </div>

    <!-- Quick Feedback Buttons -->
    <div class="quick-feedback" v-if="!showThankYou && !showDetailedForm">
      <button
        :aria-label="quickFeedback.label"
        v-for="quickFeedback in quickFeedbackOptions"
        :key="quickFeedback.type"
        :class="['quick-feedback-btn', quickFeedback.type]"
        @click="handleQuickFeedback(quickFeedback.type)"
      >
        <span class="quick-feedback-icon">{{ quickFeedback.icon }}</span>
        <span class="quick-feedback-text">{{ quickFeedback.label }}</span>
      </button>
      <button
        aria-label="Detailed Feedback"
        class="quick-feedback-btn detailed"
        @click="showDetailedForm = true"
      >
        <span class="quick-feedback-icon">💬</span>
        <span class="quick-feedback-text">Detailed Feedback</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useSelfLearningStore } from "@/store/selfLearning";
import { indexedDBPersistence } from "@/store/indexedDBPersistence";

interface FeedbackData {
  recommendationId: string;
  rating: number;
  feedbackType: string;
  categories: string[];
  comment: string;
  context: any;
  followUp: string;
  timestamp: Date;
  responseTime: number;
  userAgent: string;
}

interface FeedbackCategory {
  id: string;
  name: string;
  icon: string;
}

interface QuickFeedbackOption {
  type: string;
  icon: string;
  label: string;
  sentiment: "positive" | "negative" | "neutral";
}

const props = defineProps<{
  recommendationId: string;
  recommendationType: string;
  autoShow?: boolean;
}>();

const emit = defineEmits<{
  feedbackSubmitted: [feedback: FeedbackData];
  feedbackSkipped: [];
  closeFeedback: [];
}>();

const selfLearningStore = useSelfLearningStore();

// Reactive state
const rating = ref(0);
const hoverRating = ref(0);
const feedbackType = ref("general");
const selectedCategories = ref<string[]>([]);
const comment = ref("");
const contextOptions = ref({
  relevant: false,
  timely: false,
  actionable: false,
  new: false,
});
const followUp = ref("no");
const showThankYou = ref(false);
const showDetailedForm = ref(false);
const feedbackStartTime = ref(Date.now());
const feedbackImpact = ref("");

// Feedback categories
const feedbackCategories: FeedbackCategory[] = [
  { id: "accuracy", name: "Accuracy", icon: "🎯" },
  { id: "relevance", name: "Relevance", icon: "🔍" },
  { id: "timing", name: "Timing", icon: "⏰" },
  { id: "clarity", name: "Clarity", icon: "📝" },
  { id: "usefulness", name: "Usefulness", icon: "💡" },
  { id: "technical", name: "Technical Issue", icon: "⚙️" },
  { id: "ui", name: "UI/UX", icon: "🎨" },
  { id: "performance", name: "Performance", icon: "⚡" },
];

// Quick feedback options
const quickFeedbackOptions: QuickFeedbackOption[] = [
  { type: "helpful", icon: "👍", label: "Helpful", sentiment: "positive" },
  { type: "not-helpful", icon: "👎", label: "Not Helpful", sentiment: "negative" },
  { type: "confusing", icon: "😕", label: "Confusing", sentiment: "neutral" },
  { type: "irrelevant", icon: "❌", label: "Irrelevant", sentiment: "negative" },
];

// Computed properties
const isValidFeedback = computed(() => {
  return rating.value > 0 && (feedbackType.value === "general" || comment.value.trim().length > 0);
});

const responseTime = computed(() => {
  return Date.now() - feedbackStartTime.value;
});

// Methods
const setRating = (value: number) => {
  rating.value = value;

  // Auto-show detailed form for low ratings
  if (value <= 2) {
    showDetailedForm.value = true;
  }
};

const toggleCategory = (categoryId: string) => {
  const index = selectedCategories.value.indexOf(categoryId);
  if (index > -1) {
    selectedCategories.value.splice(index, 1);
  } else {
    selectedCategories.value.push(categoryId);
  }
};

const getRatingText = (ratingValue: number): string => {
  const texts = {
    1: "Very Poor",
    2: "Poor",
    3: "Average",
    4: "Good",
    5: "Excellent",
  };
  return texts[ratingValue as keyof typeof texts] || "";
};

const getCommentLabel = (): string => {
  switch (feedbackType.value) {
    case "specific":
      return "Please describe the specific issue:";
    case "suggestion":
      return "What improvement would you suggest?";
    default:
      return "Share your thoughts (optional):";
  }
};

const getCommentPlaceholder = (): string => {
  switch (feedbackType.value) {
    case "specific":
      return 'e.g., "The recommendation was not relevant to my current task..."';
    case "suggestion":
      return 'e.g., "I would prefer recommendations based on my recent activity..."';
    default:
      return "Tell us what you think about this recommendation...";
  }
};

const handleQuickFeedback = (type: string) => {
  const option = quickFeedbackOptions.find((opt) => opt.type === type);
  if (!option) return;

  // Map quick feedback to rating
  const ratingMap: Record<string, number> = {
    helpful: 5,
    "not-helpful": 2,
    confusing: 3,
    irrelevant: 1,
  };

  rating.value = ratingMap[type] || 3;

  // Set appropriate feedback type
  if (option.sentiment === "negative") {
    feedbackType.value = "specific";
    showDetailedForm.value = true;
  } else {
    feedbackType.value = "general";
  }

  // Auto-submit for positive quick feedback
  if (option.sentiment === "positive") {
    submitFeedback();
  }
};

const submitFeedback = async () => {
  if (!isValidFeedback.value) return;

  try {
    const feedbackData: FeedbackData = {
      recommendationId: props.recommendationId,
      rating: rating.value,
      feedbackType: feedbackType.value,
      categories: selectedCategories.value,
      comment: comment.value.trim(),
      context: { ...contextOptions.value },
      followUp: followUp.value,
      timestamp: new Date(),
      responseTime: responseTime.value,
      userAgent: navigator.userAgent,
    };

    // Save to IndexedDB
    await indexedDBPersistence.saveAnalyticsData({
      type: "user-feedback",
      recommendationId: props.recommendationId,
      feedback: feedbackData,
    });

    // Update ML model with feedback
    selfLearningStore.updateModel({
      recommendationId: props.recommendationId,
      action: rating.value >= 4 ? "accepted" : rating.value <= 2 ? "rejected" : "neutral",
      timestamp: new Date(),
      context: {
        rating: rating.value,
        categories: selectedCategories.value,
        comment: comment.value.trim(),
      },
    });

    // Calculate feedback impact
    feedbackImpact.value = calculateFeedbackImpact(feedbackData);

    // Show thank you message
    showThankYou.value = true;

    // Emit event
    emit("feedbackSubmitted", feedbackData);

    // Log analytics
    await logFeedbackAnalytics(feedbackData);
  } catch (error) {
    console.error("Failed to submit feedback:", error);
  }
};

const skipFeedback = () => {
  emit("feedbackSkipped");
};

const closeFeedback = () => {
  emit("closeFeedback");
};

const calculateFeedbackImpact = (feedback: FeedbackData): string => {
  const impacts = [];

  if (feedback.rating >= 4) {
    impacts.push("Validates current recommendation strategy");
  } else if (feedback.rating <= 2) {
    impacts.push("Helps identify areas for improvement");
  }

  if (feedback.categories.includes("accuracy")) {
    impacts.push("Improves recommendation accuracy");
  }

  if (feedback.comment.length > 100) {
    impacts.push("Provides detailed insights for ML training");
  }

  if (feedback.context.relevant) {
    impacts.push("Confirms contextual relevance");
  }

  return impacts.join(", ") || "Contributes to system improvement";
};

const logFeedbackAnalytics = async (feedback: FeedbackData) => {
  await indexedDBPersistence.saveAnalyticsData({
    type: "feedback-analytics",
    timestamp: new Date(),
    rating: feedback.rating,
    feedbackType: feedback.feedbackType,
    categories: feedback.categories,
    responseTime: feedback.responseTime,
    recommendationType: props.recommendationType,
  });
};

onMounted(() => {
  feedbackStartTime.value = Date.now();

  // Auto-show if requested
  if (props.autoShow) {
    showDetailedForm.value = true;
  }
});
</script>

<style scoped>
.user-feedback-collection {
  background: var(--bg-card, #16161a);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  margin: 1rem auto;
}

.feedback-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.feedback-header h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary, #ffffff);
  font-size: 1.25rem;
}

.feedback-subtitle {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
  margin: 0;
}

.rating-section {
  margin-bottom: 1.5rem;
}

.rating-label {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #ffffff);
  font-weight: 500;
}

.rating-stars {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.star-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: transform 0.2s;
}

.star-btn:hover {
  transform: scale(1.1);
}

.star {
  font-size: 2rem;
  color: var(--text-tertiary, #71717a);
  transition: color 0.2s;
}

.star-btn.active .star,
.star-btn:hover .star {
  color: var(--accent-amber, #ffb547);
}

.rating-text {
  text-align: center;
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.feedback-type-section {
  margin-bottom: 1.5rem;
}

.feedback-type-label {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #ffffff);
  font-weight: 500;
}

.feedback-types {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feedback-type-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.feedback-type-option:hover {
  background-color: var(--bg-elevated, #1a1a1e);
}

.feedback-type-radio {
  accent-color: var(--accent-indigo, #6366f1);
}

.feedback-type-text {
  color: var(--text-secondary, #a1a1aa);
}

.categories-section {
  margin-bottom: 1.5rem;
}

.categories-label {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #ffffff);
  font-weight: 500;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.category-chip {
  background: var(--bg-elevated, #1a1a1e);
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 20px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  color: var(--text-secondary, #a1a1aa);
}

.category-chip:hover {
  background: var(--bg-elevated-hover, #222226);
  color: var(--text-primary, #ffffff);
}

.category-chip.active {
  background: var(--accent-indigo, #6366f1);
  color: white;
  border-color: var(--accent-indigo, #6366f1);
}

.comment-section {
  margin-bottom: 1.5rem;
}

.comment-label {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #ffffff);
  font-weight: 500;
}

.comment-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
  transition: border-color 0.2s;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #ffffff);
}

.comment-textarea:focus {
  outline: none;
  border-color: var(--accent-indigo, #6366f1);
  box-shadow: 0 0 0 3px var(--accent-indigo-light, #6366f133);
}

.character-count {
  text-align: right;
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.context-section {
  margin-bottom: 1.5rem;
}

.context-label {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #ffffff);
  font-weight: 500;
}

.context-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.context-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.context-option:hover {
  background-color: var(--bg-elevated, #1a1a1e);
}

.context-checkbox {
  accent-color: var(--accent-indigo, #6366f1);
}

.context-text {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.follow-up-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--accent-amber-light, #ffb54733);
  border-radius: 6px;
  border: 1px solid var(--accent-amber, #ffb547);
}

.follow-up-label {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--accent-amber-dark, #f59e0b);
  font-weight: 500;
}

.follow-up-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.follow-up-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.follow-up-radio {
  accent-color: var(--accent-amber, #ffb547);
}

.follow-up-text {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.submit-btn {
  background: var(--accent-indigo, #6366f1);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: var(--accent-indigo-dark, #4f46e5);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skip-btn {
  background: transparent;
  color: var(--text-secondary, #a1a1aa);
  border: 1px solid var(--border-subtle, #2a2a2e);
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.skip-btn:hover {
  background: var(--bg-elevated, #1a1a1e);
  border-color: var(--border-strong, #3a3a40);
  color: var(--text-primary, #ffffff);
}

.thank-you-section {
  text-align: center;
  padding: 2rem 1rem;
}

.thank-you-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.thank-you-content h5 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary, #ffffff);
  font-size: 1.25rem;
}

.thank-you-content p {
  color: var(--text-secondary, #a1a1aa);
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.impact-info {
  background: var(--accent-emerald-light, #32d58333);
  border: 1px solid var(--accent-emerald, #32d583);
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.impact-label {
  display: block;
  color: var(--accent-emerald-dark, #059669);
  font-weight: 500;
  font-size: 0.875rem;
}

.impact-value {
  color: var(--accent-emerald-dark, #059669);
  font-size: 0.875rem;
}

.close-btn {
  background: var(--accent-emerald, #32d583);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: var(--accent-emerald-dark, #059669);
}

.quick-feedback {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1rem;
}

.quick-feedback-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 20px;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-secondary, #a1a1aa);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.quick-feedback-btn:hover {
  background: var(--bg-elevated-hover, #222226);
  border-color: var(--border-strong, #3a3a40);
  color: var(--text-primary, #ffffff);
}

.quick-feedback-btn.positive:hover {
  background: var(--accent-emerald-light, #32d58333);
  border-color: var(--accent-emerald, #32d583);
}

.quick-feedback-btn.negative:hover {
  background: var(--accent-coral-light, #e85a4f33);
  border-color: var(--accent-coral, #e85a4f);
}

.quick-feedback-btn.neutral:hover {
  background: var(--accent-amber-light, #ffb54733);
  border-color: var(--accent-amber, #ffb547);
}

.quick-feedback-btn.detailed {
  background: var(--accent-indigo, #6366f1);
  color: white;
  border-color: var(--accent-indigo, #6366f1);
}

.quick-feedback-btn.detailed:hover {
  background: var(--accent-indigo-dark, #4f46e5);
}

.quick-feedback-icon {
  font-size: 1rem;
}

.quick-feedback-text {
  font-weight: 500;
}

/* Responsive Design */
@media (max-width: 768px) {
  .analytics-data-visualization,
  .learning-analytics-dashboard,
  .ab-test-analysis-report,
  .user-feedback-collection {
    padding: 0.5rem;
  }

  .metrics-grid,
  .analytics-grid,
  .summary-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .visualization-controls,
  .header-controls {
    flex-direction: column;
    gap: 0.5rem;
  }

  .chart-canvas {
    height: 200px;
  }
}

@media (max-width: 480px) {
  .metric-card,
  .summary-card,
  .variant-metrics {
    padding: 0.75rem;
  }

  .action-buttons,
  .export-section {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
