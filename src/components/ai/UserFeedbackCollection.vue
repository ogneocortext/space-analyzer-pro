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
          <button aria-label
            v-for="star in 5"
            :key="star"
            :class="['star-btn', { active: star <= rating }]"
            @click="setRating(star)"
            @mouseenter="hoverRating = star"
            @mouseleave="hoverRating = 0"
          >
            <span class="star">{{ star <= (hoverRating || rating) ? '★' : '☆' }}</span>
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
            >
            <span class="feedback-type-text">General Feedback</span>
          </label>
          <label class="feedback-type-option">
            <input
              type="radio"
              v-model="feedbackType"
              value="specific"
              class="feedback-type-radio"
            >
            <span class="feedback-type-text">Specific Issue</span>
          </label>
          <label class="feedback-type-option">
            <input
              type="radio"
              v-model="feedbackType"
              value="suggestion"
              class="feedback-type-radio"
            >
            <span class="feedback-type-text">Improvement Suggestion</span>
          </label>
        </div>
      </div>

      <div class="categories-section" v-if="feedbackType === 'specific'">
        <label class="categories-label">What category best describes your feedback?</label>
        <div class="category-chips">
          <button aria-label
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
        <div class="character-count">
          {{ comment.length }}/500 characters
        </div>
      </div>

      <div class="context-section">
        <label class="context-label">Additional Context (Optional)</label>
        <div class="context-options">
          <label class="context-option">
            <input
              type="checkbox"
              v-model="contextOptions.relevant"
              class="context-checkbox"
            >
            <span class="context-text">This recommendation was relevant to my current task</span>
          </label>
          <label class="context-option">
            <input
              type="checkbox"
              v-model="contextOptions.timely"
              class="context-checkbox"
            >
            <span class="context-text">This recommendation came at the right time</span>
          </label>
          <label class="context-option">
            <input
              type="checkbox"
              v-model="contextOptions.actionable"
              class="context-checkbox"
            >
            <span class="context-text">I was able to act on this recommendation</span>
          </label>
          <label class="context-option">
            <input
              type="checkbox"
              v-model="contextOptions.new"
              class="context-checkbox"
            >
            <span class="context-text">This recommendation showed me something new</span>
          </label>
        </div>
      </div>

      <div class="follow-up-section" v-if="rating <= 2">
        <label class="follow-up-label">Would you like us to follow up on this feedback?</label>
        <div class="follow-up-options">
          <label class="follow-up-option">
            <input
              type="radio"
              v-model="followUp"
              value="yes"
              class="follow-up-radio"
            >
            <span class="follow-up-text">Yes, I'd like to hear about improvements</span>
          </label>
          <label class="follow-up-option">
            <input
              type="radio"
              v-model="followUp"
              value="no"
              class="follow-up-radio"
            >
            <span class="follow-up-text">No, thank you</span>
          </label>
        </div>
      </div>

      <div class="action-buttons">
        <button aria-label
          @click="submitFeedback"
          :disabled="!isValidFeedback"
          class="submit-btn"
        >
          📤 Submit Feedback
        </button>
        <button aria-label
          @click="skipFeedback"
          class="skip-btn"
        >
          ⏭️ Skip
        </button>
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
        <button aria-label @click="closeFeedback" class="close-btn">
          ✅ Got it
        </button>
      </div>
    </div>

    <!-- Quick Feedback Buttons -->
    <div class="quick-feedback" v-if="!showThankYou && !showDetailedForm">
      <button aria-label
        v-for="quickFeedback in quickFeedbackOptions"
        :key="quickFeedback.type"
        :class="['quick-feedback-btn', quickFeedback.type]"
        @click="handleQuickFeedback(quickFeedback.type)"
      >
        <span class="quick-feedback-icon">{{ quickFeedback.icon }}</span>
        <span class="quick-feedback-text">{{ quickFeedback.label }}</span>
      </button>
      <button aria-label
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
import { ref, computed, onMounted } from 'vue'
import { useSelfLearningStore } from '@/store/selfLearning'
import { indexedDBPersistence } from '@/store/indexedDBPersistence'

interface FeedbackData {
  recommendationId: string
  rating: number
  feedbackType: string
  categories: string[]
  comment: string
  context: any
  followUp: string
  timestamp: Date
  responseTime: number
  userAgent: string
}

interface FeedbackCategory {
  id: string
  name: string
  icon: string
}

interface QuickFeedbackOption {
  type: string
  icon: string
  label: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

const props = defineProps<{
  recommendationId: string
  recommendationType: string
  autoShow?: boolean
}>()

const emit = defineEmits<{
  feedbackSubmitted: [feedback: FeedbackData]
  feedbackSkipped: []
  closeFeedback: []
}>()

const selfLearningStore = useSelfLearningStore()

// Reactive state
const rating = ref(0)
const hoverRating = ref(0)
const feedbackType = ref('general')
const selectedCategories = ref<string[]>([])
const comment = ref('')
const contextOptions = ref({
  relevant: false,
  timely: false,
  actionable: false,
  new: false
})
const followUp = ref('no')
const showThankYou = ref(false)
const showDetailedForm = ref(false)
const feedbackStartTime = ref(Date.now())
const feedbackImpact = ref('')

// Feedback categories
const feedbackCategories: FeedbackCategory[] = [
  { id: 'accuracy', name: 'Accuracy', icon: '🎯' },
  { id: 'relevance', name: 'Relevance', icon: '🔍' },
  { id: 'timing', name: 'Timing', icon: '⏰' },
  { id: 'clarity', name: 'Clarity', icon: '📝' },
  { id: 'usefulness', name: 'Usefulness', icon: '💡' },
  { id: 'technical', name: 'Technical Issue', icon: '⚙️' },
  { id: 'ui', name: 'UI/UX', icon: '🎨' },
  { id: 'performance', name: 'Performance', icon: '⚡' }
]

// Quick feedback options
const quickFeedbackOptions: QuickFeedbackOption[] = [
  { type: 'helpful', icon: '👍', label: 'Helpful', sentiment: 'positive' },
  { type: 'not-helpful', icon: '👎', label: 'Not Helpful', sentiment: 'negative' },
  { type: 'confusing', icon: '😕', label: 'Confusing', sentiment: 'neutral' },
  { type: 'irrelevant', icon: '❌', label: 'Irrelevant', sentiment: 'negative' }
]

// Computed properties
const isValidFeedback = computed(() => {
  return rating.value > 0 && (feedbackType.value === 'general' || comment.value.trim().length > 0)
})

const responseTime = computed(() => {
  return Date.now() - feedbackStartTime.value
})

// Methods
const setRating = (value: number) => {
  rating.value = value
  
  // Auto-show detailed form for low ratings
  if (value <= 2) {
    showDetailedForm.value = true
  }
}

const toggleCategory = (categoryId: string) => {
  const index = selectedCategories.value.indexOf(categoryId)
  if (index > -1) {
    selectedCategories.value.splice(index, 1)
  } else {
    selectedCategories.value.push(categoryId)
  }
}

const getRatingText = (ratingValue: number): string => {
  const texts = {
    1: 'Very Poor',
    2: 'Poor',
    3: 'Average',
    4: 'Good',
    5: 'Excellent'
  }
  return texts[ratingValue as keyof typeof texts] || ''
}

const getCommentLabel = (): string => {
  switch (feedbackType.value) {
    case 'specific':
      return 'Please describe the specific issue:'
    case 'suggestion':
      return 'What improvement would you suggest?'
    default:
      return 'Share your thoughts (optional):'
  }
}

const getCommentPlaceholder = (): string => {
  switch (feedbackType.value) {
    case 'specific':
      return 'e.g., "The recommendation was not relevant to my current task..."'
    case 'suggestion':
      return 'e.g., "I would prefer recommendations based on my recent activity..."'
    default:
      return 'Tell us what you think about this recommendation...'
  }
}

const handleQuickFeedback = (type: string) => {
  const option = quickFeedbackOptions.find(opt => opt.type === type)
  if (!option) return

  // Map quick feedback to rating
  const ratingMap: Record<string, number> = {
    helpful: 5,
    'not-helpful': 2,
    confusing: 3,
    irrelevant: 1
  }

  rating.value = ratingMap[type] || 3
  
  // Set appropriate feedback type
  if (option.sentiment === 'negative') {
    feedbackType.value = 'specific'
    showDetailedForm.value = true
  } else {
    feedbackType.value = 'general'
  }

  // Auto-submit for positive quick feedback
  if (option.sentiment === 'positive') {
    submitFeedback()
  }
}

const submitFeedback = async () => {
  if (!isValidFeedback.value) return

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
      userAgent: navigator.userAgent
    }

    // Save to IndexedDB
    await indexedDBPersistence.saveAnalyticsData({
      type: 'user-feedback',
      recommendationId: props.recommendationId,
      feedback: feedbackData
    })

    // Update ML model with feedback
    selfLearningStore.updateModel({
      recommendationId: props.recommendationId,
      action: rating.value >= 4 ? 'accepted' : rating.value <= 2 ? 'rejected' : 'neutral',
      timestamp: new Date(),
      context: {
        rating: rating.value,
        categories: selectedCategories.value,
        comment: comment.value.trim()
      }
    })

    // Calculate feedback impact
    feedbackImpact.value = calculateFeedbackImpact(feedbackData)

    // Show thank you message
    showThankYou.value = true

    // Emit event
    emit('feedbackSubmitted', feedbackData)

    // Log analytics
    await logFeedbackAnalytics(feedbackData)
  } catch (error) {
    console.error('Failed to submit feedback:', error)
  }
}

const skipFeedback = () => {
  emit('feedbackSkipped')
}

const closeFeedback = () => {
  emit('closeFeedback')
}

const calculateFeedbackImpact = (feedback: FeedbackData): string => {
  const impacts = []

  if (feedback.rating >= 4) {
    impacts.push('Validates current recommendation strategy')
  } else if (feedback.rating <= 2) {
    impacts.push('Helps identify areas for improvement')
  }

  if (feedback.categories.includes('accuracy')) {
    impacts.push('Improves recommendation accuracy')
  }

  if (feedback.comment.length > 100) {
    impacts.push('Provides detailed insights for ML training')
  }

  if (feedback.context.relevant) {
    impacts.push('Confirms contextual relevance')
  }

  return impacts.join(', ') || 'Contributes to system improvement'
}

const logFeedbackAnalytics = async (feedback: FeedbackData) => {
  await indexedDBPersistence.saveAnalyticsData({
    type: 'feedback-analytics',
    timestamp: new Date(),
    rating: feedback.rating,
    feedbackType: feedback.feedbackType,
    categories: feedback.categories,
    responseTime: feedback.responseTime,
    recommendationType: props.recommendationType
  })
}

onMounted(() => {
  feedbackStartTime.value = Date.now()
  
  // Auto-show if requested
  if (props.autoShow) {
    showDetailedForm.value = true
  }
})
</script>

<style scoped>
.user-feedback-collection {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  margin: 1rem auto;
}

.feedback-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.feedback-header h4 {
  margin: 0 0 0.5rem 0;
  color: #111827;
  font-size: 1.25rem;
}

.feedback-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.rating-section {
  margin-bottom: 1.5rem;
}

.rating-label {
  display: block;
  margin-bottom: 0.75rem;
  color: #374151;
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
  color: #d1d5db;
  transition: color 0.2s;
}

.star-btn.active .star,
.star-btn:hover .star {
  color: #fbbf24;
}

.rating-text {
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}

.feedback-type-section {
  margin-bottom: 1.5rem;
}

.feedback-type-label {
  display: block;
  margin-bottom: 0.75rem;
  color: #374151;
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
  background-color: #f9fafb;
}

.feedback-type-radio {
  accent-color: #3b82f6;
}

.feedback-type-text {
  color: #374151;
}

.categories-section {
  margin-bottom: 1.5rem;
}

.categories-label {
  display: block;
  margin-bottom: 0.75rem;
  color: #374151;
  font-weight: 500;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.category-chip {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.category-chip:hover {
  background: #e5e7eb;
}

.category-chip.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.comment-section {
  margin-bottom: 1.5rem;
}

.comment-label {
  display: block;
  margin-bottom: 0.75rem;
  color: #374151;
  font-weight: 500;
}

.comment-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
  transition: border-color 0.2s;
}

.comment-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.character-count {
  text-align: right;
  color: #6b7280;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.context-section {
  margin-bottom: 1.5rem;
}

.context-label {
  display: block;
  margin-bottom: 0.75rem;
  color: #374151;
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
  background-color: #f9fafb;
}

.context-checkbox {
  accent-color: #3b82f6;
}

.context-text {
  color: #374151;
  font-size: 0.875rem;
}

.follow-up-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #fef3c7;
  border-radius: 6px;
  border: 1px solid #fbbf24;
}

.follow-up-label {
  display: block;
  margin-bottom: 0.75rem;
  color: #92400e;
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
  accent-color: #f59e0b;
}

.follow-up-text {
  color: #374151;
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.submit-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #2563eb;
}

.submit-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.skip-btn {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.skip-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
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
  color: #111827;
  font-size: 1.25rem;
}

.thank-you-content p {
  color: #6b7280;
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.impact-info {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.impact-label {
  display: block;
  color: #166534;
  font-weight: 500;
  font-size: 0.875rem;
}

.impact-value {
  color: #15803d;
  font-size: 0.875rem;
}

.close-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #059669;
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
  border: 1px solid #d1d5db;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.quick-feedback-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.quick-feedback-btn.positive:hover {
  background: #f0fdf4;
  border-color: #86efac;
}

.quick-feedback-btn.negative:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

.quick-feedback-btn.neutral:hover {
  background: #fefce8;
  border-color: #fde047;
}

.quick-feedback-btn.detailed {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.quick-feedback-btn.detailed:hover {
  background: #2563eb;
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
