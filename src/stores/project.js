import { ref } from "vue";
import { defineStore } from "pinia";

function words2paragraphs(words) {
  const paragraphs = [];
  let currentParagraph = null;
  for (let idx in words) {
    const wordType = words[idx].type || "normal";
    if (currentParagraph && wordType == currentParagraph.type) {
      currentParagraph.end = words[idx].end;
      currentParagraph.text += words[idx].word;
    } else {
      if (currentParagraph) paragraphs.push(currentParagraph);
      currentParagraph = {
        type: wordType,
        start: words[idx].start,
        end: words[idx].end,
        text: words[idx].word,
      };
    }
  }
  if (currentParagraph) paragraphs.push(currentParagraph);
  return paragraphs;
}
export const useProjectStore = defineStore("project", () => {
  const list = ref([]);
  async function load() {
    list.value = await api.call("listProjects");
  }
  async function create() {}
  async function save(project) {}

  // 加载Track,Words等
  async function prepare(project) {
    project.words = [];
    project.loading = true;
    const words = await api.call("readfile", project.id, "words.json");
    if (words) {
      const enc = new TextDecoder("utf-8");
      const str = enc.decode(words);
      project.words = JSON.parse(str);
      project.paragraphs = words2paragraphs(project.words);
    }
    console.log(project);
    project.loading = false;
  }
  load();
  return { list, load, create, save, prepare, words2paragraphs };
});

if (import.meta.vitest) {
  const { it, describe, expect } = import.meta.vitest;
  describe("", async () => {
    const { setActivePinia, createPinia } = await import("pinia");
    setActivePinia(createPinia());
    global.api = { call: () => {} };
    const store = useProjectStore();
    it("words2paragraphs", () => {
      expect(
        words2paragraphs([
          { start: 1, end: 2, word: "a" },
          { start: 2, end: 3, word: "b" },
        ])
      ).toStrictEqual([{ start: 1, end: 3, text: "ab", type: "normal" }]);
      expect(
        words2paragraphs([
          { start: 1, end: 2, word: "a" },
          { start: 2, end: 3, word: "b", type: "delete" },
        ])
      ).toStrictEqual([
        { start: 1, end: 2, text: "a", type: "normal" },
        { start: 2, end: 3, text: "b", type: "delete" },
      ]);
    });
  });
}
