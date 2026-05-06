// Custom hook for backend health checking
import { ref, onMounted, onUnmounted } from "vue";

export const useBackendHealth = () => {
  const isBackendOnline = ref(false);
  const lastChecked = ref<Date | null>(null);

  const checkBackend = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      isBackendOnline.value = data.status === 'ok';
      lastChecked.value = new Date();
    } catch (error) {
      console.error('Backend health check failed:', error);
      isBackendOnline.value = false;
      lastChecked.value = new Date();
    }
  };

  const startHealthChecks = () => {
    // Check immediately
    checkBackend();
    
    // Then check every 30 seconds
    const interval = setInterval(checkBackend, 30000);
    
    return () => {
      clearInterval(interval);
    };
  };

  onMounted(() => {
    const stopHealthChecks = startHealthChecks();
    
    onUnmounted(() => {
      stopHealthChecks();
    });
  });

  return {
    isBackendOnline,
    lastChecked,
    checkBackend,
    startHealthChecks,
  };
};
