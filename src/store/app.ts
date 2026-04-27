import { defineStore } from "pinia";
import { ref } from "vue";

export const useAppStore = defineStore("app", () => {
  const currentView = ref("landing");
  const recentPaths = ref<string[]>(JSON.parse(localStorage.getItem("recentPaths") || "[]"));
  const showPathPicker = ref(false);
  const isBackendOnline = ref(true);

  const addRecentPath = (path: string) => {
    const filtered = recentPaths.value.filter((p) => p !== path);
    filtered.unshift(path);
    recentPaths.value = filtered.slice(0, 10);
    localStorage.setItem("recentPaths", JSON.stringify(recentPaths.value));
  };

  const togglePathPicker = () => {
    showPathPicker.value = !showPathPicker.value;
  };

  const selectRecentPath = (path: string) => {
    showPathPicker.value = false;
    return path;
  };

  const setView = (view: string) => {
    currentView.value = view;
  };

  return {
    currentView,
    recentPaths,
    showPathPicker,
    isBackendOnline,
    addRecentPath,
    togglePathPicker,
    selectRecentPath,
    setView,
  };
});
