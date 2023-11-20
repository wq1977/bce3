import { createRouter, createWebHashHistory } from "vue-router";
import Home from "./screens/Home.vue";
import Editor from "./screens/Editor.vue";
import ParagraphEditor from "./screens/ParagraphEditor.vue";
import TrackEditor from "./screens/TrackEditor.vue";
import ProjectEditor from "./screens/ProjectEditor.vue";

const routes = [
  { path: "/", component: Home },
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
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
