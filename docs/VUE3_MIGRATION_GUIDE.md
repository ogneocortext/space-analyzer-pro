# Vue 3 Migration Guide

## Overview
This document outlines the migration process from React to Vue 3 for the Space Analyzer application. The goal is to achieve 60fps performance while maintaining feature parity.

## Why Vue 3?
- **Better Performance**: Optimized virtual DOM, better than React for large lists
- **Built-in Transitions**: CSS-based animations (no framer-motion overhead)
- **Composition API**: Similar to React hooks, easy migration
- **Mature Ecosystem**: Vue Router, Pinia, Vuetify, Element Plus
- **Excellent Documentation**: Comprehensive guides and examples

## Branch Structure
- `main` - Current React version (stable)
- `feature/vue3-migration` - Vue 3 migration work in progress
- `feature/react-optimizations` - React performance optimizations (backup)

## Migration Steps

### Phase 1: Setup
1. Install Vue 3 dependencies
   ```bash
   npm install vue@3 vue-router@4 pinia
   npm install -D @vitejs/plugin-vue
   ```

2. Update Vite config
   ```javascript
   import { defineConfig } from 'vite'
   import vue from '@vitejs/plugin-vue'
   
   export default defineConfig({
     plugins: [vue()]
   })
   ```

3. Create Vue entry point (`src/main.ts`)
   ```typescript
   import { createApp } from 'vue'
   import { createPinia } from 'pinia'
   import App from './App.vue'
   import router from './router'
   import './styles/index.css'
   
   const app = createApp(App)
   app.use(createPinia())
   app.use(router)
   app.mount('#app')
   ```

### Phase 2: Component Migration (One at a Time)

#### React to Vue Syntax Mapping

**State Management**
```javascript
// React
const [count, setCount] = useState(0)
const [user, setUser] = useState({ name: '' })

// Vue 3
const count = ref(0)
const user = ref({ name: '' })
// Access with .value: count.value
```

**Effects**
```javascript
// React
useEffect(() => {
  console.log('mounted')
  return () => console.log('cleanup')
}, [dependency])

// Vue 3
onMounted(() => console.log('mounted'))
onUnmounted(() => console.log('cleanup'))
watch(dependency, (newVal) => console.log(newVal))
```

**Computed Values**
```javascript
// React
const doubled = useMemo(() => count * 2, [count])

// Vue 3
const doubled = computed(() => count.value * 2)
```

**Event Handlers**
```javascript
// React
<button onClick={handleClick}>Click</button>

// Vue 3
<button @click="handleClick">Click</button>
```

**Conditional Rendering**
```javascript
// React
{condition && <div>Content</div>}
{condition ? <div>A</div> : <div>B</div>}

// Vue 3
<div v-if="condition">Content</div>
<div v-if="condition">A</div>
<div v-else>B</div>
```

**Lists**
```javascript
// React
{items.map(item => <div key={item.id}>{item.name}</div>)}

// Vue 3
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

### Phase 3: Component Conversion Order

1. **Simple components first** (no state, just UI)
   - `AppHeader`
   - `StorageGauge`

2. **Stateful components** (hooks → Composition API)
   - `LandingPage`
   - `RealTimeFileScanner`

3. **Complex components** (multiple hooks, effects)
   - `ViewRouter`
   - `AppSidebar`

4. **Context/Providers** (Pinia stores)
   - `AIContext` → Pinia store
   - `AccessibilityContext` → Pinia store

### Phase 4: Animation Migration

Replace framer-motion with Vue's built-in transitions:

```vue
<!-- React with framer-motion -->
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>

<!-- Vue 3 with built-in transitions -->
<Transition name="fade">
  <div v-if="show">Content</div>
</Transition>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
```

### Phase 5: Virtualization

Install and configure virtual scrolling:

```bash
npm install vue-virtual-scroller
```

```vue
<template>
  <RecycleScroller
    :items="files"
    :item-size="50"
    key-field="id"
    v-slot="{ item }"
  >
    <div>{{ item.name }}</div>
  </RecycleScroller>
</template>
```

### Phase 6: Testing

1. Run existing Playwright tests
2. Update test selectors for Vue syntax
3. Verify performance metrics (target 60fps)

## Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Min FPS | 14.3 | 55+ |
| Avg FPS | 61.6 | 60 |
| Page Load | 3526ms | <2000ms |
| Button Response | 979ms | <100ms |

## Rollback Plan

If Vue 3 migration has issues:
```bash
git checkout main
# React version is preserved
```

To continue Vue work:
```bash
git checkout feature/vue3-migration
```

## Resources

- [Vue 3 Documentation](https://vuejs.org/)
- [Vue Router](https://router.vuejs.org/)
- [Pinia](https://pinia.vuejs.org/)
- [Vue 3 React Migration Guide](https://vuejs.org/guide/extras/rendering-mechanism.html)
- [VueUse](https://vueuse.org/) - Composition utilities

## Timeline Estimate

- Phase 1 (Setup): 2 hours
- Phase 2 (Component Migration): 16-24 hours
- Phase 3 (Animation Migration): 4 hours
- Phase 4 (Virtualization): 4 hours
- Phase 5 (Testing): 4 hours

**Total: 30-38 hours**
