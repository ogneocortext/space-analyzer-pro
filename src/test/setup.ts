import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock Tauri API
global.__TAURI__ = {
  invoke: vi.fn(),
}

// Configure Vue Test Utils
config.global.mocks = {
  $tauri: {
    invoke: vi.fn(),
  }
}

// Mock chrome API (blocked in production)
global.chrome = {
  runtime: {
    connect: vi.fn(() => { throw new Error("BLOCKED") }),
    sendMessage: vi.fn(() => { throw new Error("BLOCKED") }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getManifest: vi.fn(() => ({})),
    id: "blocked",
    getURL: vi.fn(() => ""),
    onConnect: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn(), removeListener: vi.fn() },
    onSuspend: { addListener: vi.fn(), removeListener: vi.fn() },
    onStartup: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  storage: { local: {}, sync: {}, managed: {} },
  tabs: { query: vi.fn(() => []), sendMessage: vi.fn(() => {}) },
  i18n: { getMessage: vi.fn(() => "") },
  webNavigation: { getFrame: vi.fn(() => {}), getAllFrames: vi.fn(() => []) },
}