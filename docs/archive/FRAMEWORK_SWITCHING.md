# Framework Switching Guide

This application supports both Vue 3 and React implementations. You can switch between them using an environment variable.

## Switching Frameworks

### To Use Vue (Default)

Set the environment variable in `.env`:
```env
VITE_FRAMEWORK=vue
```

Then start the dev server:
```bash
npm run dev
```

### To Use React

Set the environment variable in `.env`:
```env
VITE_FRAMEWORK=react
```

Then start the dev server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── vue/          # Vue 3 components (.vue files)
│   │   ├── layout/
│   │   └── dashboard/
│   └── react/        # React components (.tsx files)
│       ├── layout/
│       ├── dashboard/
│       └── ...
├── main.ts           # Vue entry point
├── main-react.tsx    # React entry point
├── App.vue           # Vue app root
└── App.tsx           # React app root
```

## How It Works

1. **index.html** contains both mount points (`#app` for Vue, `#root` for React)
2. A script reads the `VITE_FRAMEWORK` environment variable
3. Based on the value, it loads either `main.ts` (Vue) or `main-react.tsx` (React)
4. The appropriate mount point is shown while the other is hidden

## Component Organization

- **Vue components** are in `src/components/vue/` with `.vue` extension
- **React components** are in `src/components/react/` with `.tsx` extension
- Shared utilities, hooks, and services are in `src/utils/`, `src/hooks/`, `src/services/`

## Development Workflow

When developing for a specific framework:

1. Set `VITE_FRAMEWORK` to your target framework
2. Work in the appropriate component directory (`vue/` or `react/`)
3. The build system will only load the necessary dependencies

## Notes

- Both implementations share the same backend API
- State management differs: Vue uses Pinia, React uses custom hooks/contexts
- Styling is shared via Tailwind CSS
- The backend is framework-agnostic
