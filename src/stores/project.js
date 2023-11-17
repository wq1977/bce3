import { ref } from "vue";
import { defineStore } from "pinia";

export const useProjectStore = defineStore("project", () => {
  const list = ref([]);
  async function load() {
    console.log("load project ...");
    list.value = await api.call("listProjects");
    console.log(list.value);
  }
  async function create() {}
  async function save(project) {}
  load();
  return { list, load, create, save };
});

if (import.meta.vitest) {
  const { it, describe, expect } = import.meta.vitest;
  describe("", async () => {
    const { setActivePinia, createPinia } = await import("pinia");
    setActivePinia(createPinia());
    const store = useRuntimeStore();
    it("hello", () => {
      expect(1 + 1).toBe(2);
    });
  });
}
