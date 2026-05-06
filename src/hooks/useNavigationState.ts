// Custom hook for managing navigation state
import { ref, computed } from "vue";

type ViewType =
  | "dashboard"
  | "neural"
  | "chat"
  | "treemap"
  | "export"
  | "browser"
  | "timeline"
  | "settings"
  | "help";

export interface UseNavigationStateReturn {
  currentView: ViewType;
  viewHistory: ViewType[];
  isLoading: boolean;
  navigateTo: (view: ViewType) => void;
  goBack: () => void;
  goForward: () => void;
  clearHistory: () => void;
}

export const useNavigationState = (): UseNavigationStateReturn => {
  const currentView = ref<ViewType>("dashboard");
  const viewHistory = ref<ViewType[]>([]);
  const isLoading = ref(false);

  const navigateTo = (view: ViewType) => {
    isLoading.value = true;
    
    // Simulate navigation delay
    setTimeout(() => {
      currentView.value = view;
      viewHistory.value.push(view);
      isLoading.value = false;
    }, 300);
  };

  const goBack = () => {
    if (viewHistory.value.length > 1) {
      const previousView = viewHistory.value[viewHistory.value.length - 2];
      navigateTo(previousView);
    }
  };

  const goForward = () => {
    const currentIndex = viewHistory.value.indexOf(currentView.value);
    if (currentIndex < viewHistory.value.length - 1) {
      const nextView = viewHistory.value[currentIndex + 1];
      navigateTo(nextView);
    }
  };

  const clearHistory = () => {
    viewHistory.value = [];
  };

  return {
    currentView,
    viewHistory,
    isLoading,
    navigateTo,
    goBack,
    goForward,
    clearHistory,
  };
};
