import { createRouter, createWebHashHistory } from "vue-router";
import Home from "./screens/Home.vue";
import Editor from "./screens/Editor.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/editor", component: Editor },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
