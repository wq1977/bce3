import { createRouter, createWebHashHistory } from "vue-router";
import Home from "./screens/Home.vue";

const routes = [{ path: "/", component: Home }];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
