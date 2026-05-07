import { ref, watch } from "vue";

/**
 * Custom hook for debounced search
 */
export const useDebouncedValue = (value: string, delay: number): string => {
  const debouncedValue = ref(value);

  watch(
    value,
    (newValue) => {
      const handler = setTimeout(() => {
        debouncedValue.value = newValue;
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    },
    { immediate: true }
  );

  return debouncedValue.value;
};
