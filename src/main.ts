import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import { useAnalysisStore } from "./store/analysis";

// Import global styles and initialization
import "./styles/index.css";
import "./styles/desktop.css";
import "./installHook.js";
import { vueErrorHandler } from "./services/errorTracking";

console.warn("Starting Vue app...");

// Only apply browser extension blocking in production
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  // Override chrome API completely
  (window as Record<string, unknown>).chrome = {
    runtime: {
      connect: () => {
        throw new Error("BLOCKED");
      },
      sendMessage: () => {
        throw new Error("BLOCKED");
      },
      onMessage: { addListener: () => {}, removeListener: () => {} },
      getManifest: () => ({}),
      id: "blocked",
      getURL: () => "",
      onConnect: { addListener: () => {}, removeListener: () => {} },
      onInstalled: { addListener: () => {}, removeListener: () => {} },
      onSuspend: { addListener: () => {}, removeListener: () => {} },
      onSuspendCanceled: { addListener: () => {}, removeListener: () => {} },
      onStartup: { addListener: () => {}, removeListener: () => {} },
    } as Record<string, unknown>,
    storage: { local: {}, sync: {}, managed: {} } as Record<string, unknown>,
    tabs: { query: () => [], sendMessage: () => {} } as Record<string, unknown>,
    i18n: { getMessage: () => "" } as Record<string, unknown>,
    webNavigation: { getFrame: () => {}, getAllFrames: () => [] } as Record<string, unknown>,
  };

  // Freeze chrome object to prevent modifications
  Object.defineProperty(window, "chrome", {
    value: (window as Record<string, unknown>).chrome,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}

// Only apply extension blocking in production
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  // Block extension scripts from injecting
  const originalCreateElement = document.createElement;
  document.createElement = function (tagName: string, ...args: unknown[]) {
    const element = originalCreateElement.call(this, tagName, ...args);
    if (tagName === "script") {
      Object.defineProperty(element, "src", {
        set: function (value) {
          if (value && value.includes("chrome-extension://")) {
            throw new Error("Extension script blocked");
          }
          this._src = value;
        },
        get: function () {
          return this._src;
        },
      });
    }
    return element;
  };

  // Override all error handling to suppress extension errors
  const suppressExtensionErrors = (error: Error | Event | unknown, event?: Event) => {
    const message = (error as Error)?.message || String(error) || "";
    const filename = (error as Error)?.filename || event?.filename || "";

    const extensionPatterns = [
      "chrome-extension://",
      "Could not establish connection",
      "Receiving end does not exist",
      "runtime.lastError",
      "document-start.js",
      "content.js",
    ];

    return extensionPatterns.some(
      (pattern) => message.includes(pattern) || filename.includes(pattern)
    );
  };

  // Override all error handlers
  window.addEventListener(
    "error",
    (event) => {
      if (suppressExtensionErrors(event.error, event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (suppressExtensionErrors(event.reason, event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    },
    true
  );

  // Override global error handlers
  (window as Record<string, EventHandler>).onerror = function (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ) {
    if (suppressExtensionErrors(error, { filename: source })) {
      return true;
    }
    return false;
  };

  (window as Record<string, EventHandler>).onunhandledrejection = function (
    event: PromiseRejectionEvent
  ) {
    if (suppressExtensionErrors(event.reason, event)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  // Override console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = function (...args: unknown[]) {
    const message = args.join(" ");
    if (suppressExtensionErrors(message, {})) {
      return; // Completely suppress
    }
    return originalConsoleError.apply(console, args);
  };

  console.warn = function (...args: unknown[]) {
    const message = args.join(" ");
    if (suppressExtensionErrors(message, {})) {
      return; // Completely suppress
    }
    return originalConsoleWarn.apply(console, args);
  };

  // Block content script connections and extension messaging
  const originalPostMessage = window.postMessage;
  window.postMessage = function (...args: unknown[]) {
    if (args[1] && typeof args[1] === "string" && args[1].includes("chrome-extension://")) {
      console.warn("Blocked browser extension postMessage");
      return;
    }
    if (
      args[0] &&
      typeof args[0] === "object" &&
      args[0].source &&
      args[0].source.includes("chrome-extension://")
    ) {
      console.warn("Blocked browser extension message source");
      return;
    }
    return originalPostMessage.apply(this, args);
  };
}

// Block extension storage access
if ((window as Record<string, unknown>).chrome?.storage) {
  const currentChrome = (window as Record<string, unknown>).chrome as Record<string, unknown>;
  (window as Record<string, unknown>).chrome = {
    ...currentChrome,
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
      sync: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
      managed: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
    },
  } as Record<string, unknown>;
}

// Override addEventListener to block extension events
const originalAddEventListener = window.addEventListener;
window.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
) {
  if (type === "message" && listener.toString().includes("chrome-extension://")) {
    console.warn("Blocked extension event listener");
    return;
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// Create app instance
const app = createApp(App);
const pinia = createPinia();

// Configure Vue error handling
app.config.errorHandler = vueErrorHandler;
app.config.warnHandler = (msg, instance, trace) => {
  // Log warnings in development
  if (import.meta.env.DEV) {
    console.warn(`[Vue Warning] ${msg}`, trace);
  }
};

app.use(pinia);
app.use(router);

// Initialize stores
const analysisStore = useAnalysisStore();
analysisStore.initialize();

app.mount("#app");

console.warn("Vue app mounted successfully with performance optimizations and desktop features");
