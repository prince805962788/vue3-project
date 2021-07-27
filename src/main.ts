import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index";
import store from "./store/index";

import { components, plugins } from "./plugins/element-plus";
import "element-plus/lib/theme-chalk/index.css";

const app = createApp(App);

// 按需导入组件和插件
components.forEach((component) => {
  app.component(component.name, component);
});
plugins.forEach((plugin) => {
  app.use(plugin);
});
app.use(router);
app.use(store);
app.mount("#app");
