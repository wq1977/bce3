import { createRouter, createWebHashHistory } from "vue-router";
import Home from "./screens/Home.vue";
import Editor from "./screens/Editor.vue";
import ParagraphEditor from "./screens/ParagraphEditor.vue";
import TrackEditor from "./screens/TrackEditor.vue";
import ProjectEditor from "./screens/ProjectEditor.vue";
import Publisher from "./screens/Publish.vue";
import Viewer from "./screens/Viewer.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/view", component: Viewer },
  {
    path: "/editor",
    component: Editor,
    children: [
      {
        path: "track",
        component: TrackEditor,
      },
      {
        path: "paragraph",
        component: ParagraphEditor,
      },
      {
        path: "project",
        component: ProjectEditor,
      },
      {
        path: "publish",
        component: Publisher,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
