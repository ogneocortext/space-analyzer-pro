import { ref, computed, onMounted, onUnmounted } from "vue";

interface ModelData {
  name: string;
  path: string;
  size: number;
  type: string;
  framework: string;
  accuracy: number;
  parameters: number;
}

export interface UseGPUMemoryVisualizationReturn {
  models: ModelData[];
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  memoryUsagePercentage: number;
  loadModel: (model: ModelData) => void;
  unloadModel: (modelId: string) => void;
  optimizeMemory: () => void;
}

export const useGPUMemoryVisualization = (): UseGPUMemoryVisualizationReturn => {
  const models = ref<ModelData[]>([]);
  const totalMemory = ref(8192); // 8GB default
  const usedMemory = ref(0);
  const availableMemory = computed(() => totalMemory.value - usedMemory.value);
  const memoryUsagePercentage = computed(() => (usedMemory.value / totalMemory.value) * 100);

  const loadModel = (model: ModelData) => {
    if (usedMemory.value + model.size > totalMemory.value) {
      console.warn('Insufficient GPU memory to load model');
      return;
    }

    models.value.push(model);
    usedMemory.value += model.size;
    
    console.log(`Loaded model: ${model.name} (${model.size}MB)`);
  };

  const unloadModel = (modelId: string) => {
    const modelIndex = models.value.findIndex(m => m.path === modelId);
    if (modelIndex === -1) return;

    const model = models.value[modelIndex];
    models.value.splice(modelIndex, 1);
    usedMemory.value -= model.size;
    
    console.log(`Unloaded model: ${model.name} (${model.size}MB)`);
  };

  const optimizeMemory = () => {
    // Simple memory optimization
    const sortedModels = [...models.value].sort((a, b) => b.size - a.size);
    
    // Keep only the most important models if memory is constrained
    if (memoryUsagePercentage.value > 80) {
      const keepCount = Math.floor(totalMemory.value / 1000); // Keep models that fit in 1GB
      const toKeep = sortedModels.slice(0, keepCount);
      const toRemove = models.value.filter(m => !toKeep.includes(m));
      
      toRemove.forEach(model => unloadModel(model.path));
    }
  };

  const checkWebGPUSupport = () => {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported');
      return false;
    }

    const adapter = navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn('No WebGPU adapter available');
      return false;
    }

    return true;
  };

  onMounted(() => {
    if (checkWebGPUSupport()) {
      console.log('WebGPU is supported');
    } else {
      console.log('Falling back to WebGL for memory visualization');
    }
  });

  return {
    models,
    totalMemory,
    usedMemory,
    availableMemory,
    memoryUsagePercentage,
    loadModel,
    unloadModel,
    optimizeMemory,
  };
};
