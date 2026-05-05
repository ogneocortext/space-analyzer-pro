import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";

// Import global styles and initialization
import "./styles/index.css";
import "./styles/desktop.css";
import "./installHook.js";
import { vueErrorHandler } from "./services/errorTracking";
import { useKeyboardShortcuts } from "./composables/useKeyboardShortcuts";

console.warn("Starting Vue app...");

// Prevent browser extension interference
if (typeof window !== "undefined") {
  // Only block extensions in browser, not during Vite build
  if (process.env.NODE_ENV === "production") {
    // Override chrome API completely
    (window as any).chrome = {
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
      },
      storage: { local: {}, sync: {}, managed: {} },
      tabs: { query: () => [], sendMessage: () => {} },
      i18n: { getMessage: () => "" },
      webNavigation: { getFrame: () => {}, getAllFrames: () => [] },
    };

    // Freeze chrome object to prevent modifications
    Object.defineProperty(window, "chrome", {
      value: (window as any).chrome,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }

  // Block extension scripts from injecting
  const originalCreateElement = document.createElement;
  document.createElement = function (tagName, ...args) {
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
  const suppressExtensionErrors = (error, event) => {
    const message = error?.message || error || "";
    const filename = error?.filename || event?.filename || "";

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
  (window as any).onerror = function (message, source, lineno, colno, error) {
    if (suppressExtensionErrors(error, { filename: source })) {
      return true;
    }
    return false;
  };

  (window as any).onunhandledrejection = function (event) {
    if (suppressExtensionErrors(event.reason, event)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  // Override console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = function (...args) {
    const message = args.join(" ");
    if (suppressExtensionErrors(message, {})) {
      return; // Completely suppress
    }
    return originalConsoleError.apply(console, args);
  };

  console.warn = function (...args) {
    const message = args.join(" ");
    if (suppressExtensionErrors(message, {})) {
      return; // Completely suppress
    }
    return originalConsoleWarn.apply(console, args);
  };

  // Block content script connections and extension messaging
  const originalPostMessage = window.postMessage;
  window.postMessage = function (...args: any[]) {
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

  // Block extension storage access
  if ((window as any).chrome?.storage) {
    (window as any).chrome.storage = {
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
    };
  }

  // Override addEventListener to block extension events
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function (type: string, listener: any, options?: any) {
    if (type === "message" && listener.toString().includes("chrome-extension://")) {
      console.warn("Blocked extension event listener");
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
}

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

app.mount("#app");

console.warn("Vue app mounted successfully with performance optimizations and desktop features");
