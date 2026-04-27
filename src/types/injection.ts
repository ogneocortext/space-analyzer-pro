import { type InjectionKey } from 'vue'
import { useAnalysisStore } from '../store/analysis'
import { useAppStore } from '../store/app'

// Define injection keys for type-safe dependency injection
export const analysisStoreKey: InjectionKey<ReturnType<typeof useAnalysisStore>> = Symbol('analysisStore')
export const appStoreKey: InjectionKey<ReturnType<typeof useAppStore>> = Symbol('appStore')
export const handlePathChangeKey: InjectionKey<(path: string) => void> = Symbol('handlePathChange')
export const toggleAIKey: InjectionKey<() => void> = Symbol('toggleAI')
export const handleSelectRecentPathKey: InjectionKey<(path: string) => void> = Symbol('handleSelectRecentPath')
export const navigateToDashboardKey: InjectionKey<() => void> = Symbol('navigateToDashboard')
export const navigateToBrowserKey: InjectionKey<() => void> = Symbol('navigateToBrowser')
export const navigateToVisualizationKey: InjectionKey<() => void> = Symbol('navigateToVisualization')
export const exportReportKey: InjectionKey<() => void> = Symbol('exportReport')
export const cleanupSuggestionsKey: InjectionKey<() => void> = Symbol('cleanupSuggestions')
export const getCategoryColorKey: InjectionKey<(category: string) => string> = Symbol('getCategoryColor')
