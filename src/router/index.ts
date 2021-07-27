import { createRouter, createWebHashHistory } from "vue-router";
import routes from "./constant";
export default createRouter({
  // 指定路由模式
  history: createWebHashHistory(),
  // 路由地址
  routes: routes,
});
