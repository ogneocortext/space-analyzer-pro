import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./styles/index.css";

// Create and mount app immediately - defer everything else
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");

// Load non-critical stuff after app is mounted
setTimeout(() => {
  import("./utils/sourcemap-fix");
}, 500);
