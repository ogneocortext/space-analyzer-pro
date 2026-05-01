import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./styles/index.css";
import performancePlugin from "./plugins/performance";

console.warn("Starting Vue app...");

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(performancePlugin, {
  enableMonitoring: true,
  enableVirtualScrolling: true,
  enableLazyLoading: true,
  maxCacheSize: 100,
});

app.mount("#app");

console.warn("Vue app mounted successfully with performance optimizations");
