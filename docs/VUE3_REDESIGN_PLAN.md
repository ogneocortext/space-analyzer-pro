# Vue 3 Complete Redesign Plan

## Overview
Complete migration from mixed React/Vue codebase to pure Vue 3 with TypeScript.

## Goals
1. **Single Framework**: Remove all React components (150 files)
2. **Type Safety**: Eliminate 588+ TypeScript/ESLint suppressions
3. **Simplified UX**: Clean, focused interface
4. **Performance**: Leverage Vue 3's optimized reactivity

## Phase 1: Foundation (Days 1-3)

### 1.1 Cleanup React Artifacts
- [ ] Remove `src/components/react/` (150 components)
- [ ] Remove React dependencies from package.json
- [ ] Remove React type declarations
- [ ] Update build configuration

### 1.2 Design System Setup
Create `src/design-system/`:
```
src/design-system/
├── tokens/
│   ├── colors.ts
│   ├── spacing.ts
│   ├── typography.ts
│   └── shadows.ts
├── components/
│   ├── Button/
│   ├── Card/
│   ├── Input/
│   ├── Select/
│   ├── Modal/
│   ├── Toast/
│   └── Loading/
└── composables/
    ├── useTheme.ts
    ├── useToast.ts
    └── useLoading.ts
```

### 1.3 Core Layout Architecture
```
src/layout/
├── AppLayout.vue          # Root layout wrapper
├── NavigationSidebar.vue  # Collapsible nav
├── TopBar.vue            # Breadcrumbs, actions
└── ContentArea.vue       # Main content slot
```

## Phase 2: Core Features (Days 4-7)

### 2.1 Dashboard (Simplified)
Single view with 4 tabs:

**Overview Tab:**
- Total files count (big number)
- Total size (big number with unit)
- Scan progress (if running)
- Quick scan button
- Recent scans list

**Files Tab:**
- Search/filter bar
- Sortable file list
- Pagination
- Category filter chips

**Insights Tab:**
- Top 5 largest files
- Duplicate detection
- Storage warnings (simplified)

**Settings Tab:**
- Scan depth
- Include hidden files
- AI settings toggle

### 2.2 Scanning Interface
```
src/features/scanning/
├── ScanProgress.vue      # Real-time progress display
├── DirectoryPicker.vue   # Folder selection
└── ScanResults.vue       # Post-scan summary
```

### 2.3 File Browser
```
src/features/browser/
├── FileList.vue
├── FileGrid.vue
├── FileDetails.vue
├── Breadcrumbs.vue
└── FilterPanel.vue
```

## Phase 3: Data Layer (Days 8-10)

### 3.1 Store Restructure
```typescript
// src/stores/analysis.ts
export const useAnalysisStore = defineStore('analysis', () => {
  // State
  const currentScan = ref<ScanResult | null>(null)
  const isScanning = ref(false)
  const progress = ref<ScanProgress>({ files: 0, percentage: 0 })
  
  // Getters
  const totalFiles = computed(() => currentScan.value?.totalFiles || 0)
  const totalSize = computed(() => currentScan.value?.totalSize || 0)
  const filesByCategory = computed(() => {
    return groupBy(currentScan.value?.files || [], 'category')
  })
  
  // Actions
  async function startScan(path: string, options: ScanOptions) {
    // Implementation
  }
  
  return {
    currentScan,
    isScanning,
    progress,
    totalFiles,
    totalSize,
    filesByCategory,
    startScan
  }
})
```

### 3.2 API Service Cleanup
- Consolidate AnalysisBridge
- Remove duplicate type definitions
- Proper error handling

## Phase 4: Polish (Days 11-12)

### 4.1 Animations
- Vue `<Transition>` for page changes
- `<TransitionGroup>` for lists
- Loading skeletons

### 4.2 Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation
- Focus management
- Screen reader testing

### 4.3 Testing
- Unit tests for composables
- Component tests with Vue Test Utils
- E2E with Playwright

## Component Inventory

### Keep (Vue - migrate if needed):
- RealTimeFileScanner.vue ✓
- AnalysisResults.vue (simplify)
- DirectoryPickerFixed.vue (refactor)

### Remove (React - rebuild in Vue):
- SpaceAnalyzerDashboard.tsx → Dashboard.vue (new)
- EnhancedAIChat.tsx → AIChat.vue (simplified)
- NeuralView*.tsx → (remove or simplify)
- SmartAnalysisPanel.tsx → AnalysisPanel.vue
- All "Enhanced" components → Simplify to core features

### New Components:
- DesignSystem/Button.vue
- DesignSystem/Card.vue
- DesignSystem/Toast.vue
- Layout/AppShell.vue
- Features/Dashboard/OverviewCard.vue
- Features/Dashboard/StorageChart.vue (simple)

## File Structure After
```
src/
├── design-system/     # Shared UI components
├── layout/           # Layout components
├── features/         # Feature modules
│   ├── scanning/
│   ├── browser/
│   ├── dashboard/
│   └── settings/
├── stores/           # Pinia stores
├── services/         # API services
├── composables/      # Shared logic
├── utils/           # Utilities
├── types/           # TypeScript types
└── App.vue          # Root
```

## Dependencies to Remove
- react
- react-dom
- @types/react
- @types/react-dom
- framer-motion (if not used in Vue)

## Dependencies to Add
- @vueuse/core (utilities)
- vue-router (if not present)
- pinia (already have)

## Migration Checklist

### Week 1: Foundation
- [ ] Delete react components
- [ ] Create design system
- [ ] Build layout shell
- [ ] Setup navigation

### Week 2: Features  
- [ ] Dashboard overview
- [ ] File browser
- [ ] Scan interface
- [ ] Settings panel

### Week 3: Polish
- [ ] Animations
- [ ] Accessibility
- [ ] Testing
- [ ] Documentation

## Success Metrics
1. Zero React imports
2. Zero `@ts-ignore` suppressions
3. 100% TypeScript coverage
4. Lighthouse score >90
5. Bundle size reduced by 40%
