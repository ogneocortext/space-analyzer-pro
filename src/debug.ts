// Debug logging utility - stub version for simplified app
export const debug = {
  log: (...args: any[]) => {
    console.warn("[DEBUG]", ...args);
  },
  error: (...args: any[]) => {
    console.error("[DEBUG]", ...args);
  },
  warn: (...args: any[]) => {
    console.warn("[DEBUG]", ...args);
  },
};

// Global error handler - minimal version
window.addEventListener("error", (event) => {
  console.error("Global error:", event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
