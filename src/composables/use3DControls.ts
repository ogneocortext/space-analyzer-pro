import { ref, computed } from 'vue';

export interface ControlConfig {
  mode: 'tree' | 'sphere' | 'grid' | 'force';
  colorMode: 'size' | 'type' | 'date' | 'category';
  animationSpeed: number;
}

export function use3DControls() {
  // Control state
  const config = ref<ControlConfig>({
    mode: 'tree',
    colorMode: 'size',
    animationSpeed: 50
  });
  
  const isRotating = ref(false);

  // Computed properties
  const modeOptions = computed(() => [
    { value: 'tree', label: 'Tree View' },
    { value: 'sphere', label: 'Sphere View' },
    { value: 'grid', label: 'Grid View' },
    { value: 'force', label: 'Force Graph' }
  ]);

  const colorOptions = computed(() => [
    { value: 'size', label: 'File Size' },
    { value: 'type', label: 'File Type' },
    { value: 'date', label: 'Modified Date' },
    { value: 'category', label: 'Category' }
  ]);

  // Methods
  const resetCamera = () => {
    console.warn('Camera reset - feature coming soon');
  };

  const toggleRotation = () => {
    isRotating.value = !isRotating.value;
  };

  const exportVisualization = () => {
    console.warn('Export visualization - feature coming soon');
  };

  const updateConfig = (updates: Partial<ControlConfig>) => {
    config.value = { ...config.value, ...updates };
  };

  return {
    // State
    config,
    isRotating,
    modeOptions,
    colorOptions,
    
    // Methods
    resetCamera,
    toggleRotation,
    exportVisualization,
    updateConfig
  };
}
