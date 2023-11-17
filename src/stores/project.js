import { ref } from "vue";
import { defineStore } from "pinia";

function words2pieces(project, start, end) {
  const words = project.words.slice(start, end + 1);
  const pieces = [];
  let currentPiece;
  for (let idx = 0; idx < words.length; idx++) {
    const wordType = words[idx].type || "normal";
    if (currentPiece && wordType == currentPiece.type) {
      currentPiece.frameEnd = words[idx].end;
      currentPiece.text = `${currentPiece.text}${words[idx].word}`;
    } else {
      if (currentPiece) pieces.push(currentPiece);
      currentPiece = {
        type: wordType,
        frameStart: words[idx].start,
        frameEnd: words[idx].end,
        wordStart: idx + start,
        text: words[idx].word,
      };
    }
  }
  if (currentPiece) pieces.push(currentPiece);
  return pieces;
}

function getWordIndex(project, piece, position) {
  let len = 0,
    idx = piece.wordStart;
  while (len < position && idx < project.words.length) {
    len += project.words[idx++].word.length;
  }
  return idx;
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
    }
    const paragraphs = await api.call(
      "readfile",
      project.id,
      "paragraphs.json"
    );
    if (!paragraphs && project.words) {
      project.paragraphs = [
        {
          start: 0,
          end: words.length - 1,
          comment: "",
          pieces: words2pieces(project, 0, words.length - 1),
        },
      ];
    }
    project.loading = false;
    console.log(project);
  }
  function splitParagraph(project, paragraphIdx, piece, position) {
    const wordidx = getWordIndex(project, piece, position);
    if (wordidx >= 0) {
      const pstart = project.paragraphs[paragraphIdx].start;
      const pend = project.paragraphs[paragraphIdx].end;
      project.paragraphs[paragraphIdx] = {
        start: pstart,
        end: wordidx - 1,
        comment: project.paragraphs[paragraphIdx].comment,
        pieces: words2pieces(project, pstart, wordidx - 1),
      };
      if (wordidx <= pend) {
        project.paragraphs.splice(paragraphIdx + 1, 0, {
          start: wordidx,
          end: pend,
          comment: "",
          pieces: words2pieces(project, wordidx, pend + 1),
        });
      }
    }
  }
  async function playParagraph(project, idx) {}
  function mergeBackParagraph(project, idx) {
    if (idx > 0) {
      const start = project.paragraphs[idx - 1].start;
      const end = project.paragraphs[idx].end;
      const comment = project.paragraphs[idx - 1].comment;
      project.paragraphs.splice(idx - 1, 2, {
        start,
        end,
        comment,
        pieces: words2pieces(project, start, end),
      });
    }
  }
  load();
  async function saveProject(project) {}
  return {
    list,
    load,
    create,
    save,
    prepare,
    words2pieces,
    splitParagraph,
    saveProject,
    mergeBackParagraph,
    playParagraph,
  };
});

if (import.meta.vitest) {
  const { it, describe, expect } = import.meta.vitest;
  describe("", async () => {
    const { setActivePinia, createPinia } = await import("pinia");
    setActivePinia(createPinia());
    global.api = { call: () => {} };
    const store = useProjectStore();
    it("splitParagraph", () => {
      const project = {
        words: [
          { word: "a", start: 0, end: 1 },
          { word: "b", start: 1, end: 2 },
        ],
        paragraphs: [
          {
            start: 0,
            end: 1,
            comment: "1",
          },
        ],
      };
      store.splitParagraph(project, 0, { wordStart: 0 }, 1);
      expect(project.paragraphs).toStrictEqual([
        {
          start: 0,
          end: 0,
          comment: "1",
          pieces: [
            {
              frameStart: 0,
              frameEnd: 1,
              text: "a",
              type: "normal",
              wordStart: 0,
            },
          ],
        },
        {
          start: 1,
          end: 1,
          comment: "",
          pieces: [
            {
              frameStart: 1,
              frameEnd: 2,
              text: "b",
              type: "normal",
              wordStart: 1,
            },
          ],
        },
      ]);
    });
    it("getWordIndex", () => {
      expect(
        getWordIndex(
          { words: [{ word: "a" }, { word: "b" }] },
          { wordStart: 0 },
          1
        )
      ).toBe(1);
    });
    it("words2pieces", () => {
      expect(
        words2pieces(
          {
            words: [
              { start: 1, end: 2, word: "a" },
              { start: 2, end: 3, word: "b" },
            ],
          },
          0,
          1
        )
      ).toStrictEqual([
        {
          frameStart: 1,
          frameEnd: 3,
          text: "ab",
          type: "normal",
          wordStart: 0,
        },
      ]);
      expect(
        words2pieces(
          {
            words: [
              { start: 1, end: 2, word: "a" },
              { start: 2, end: 3, word: "b", type: "delete" },
            ],
          },
          0,
          1
        )
      ).toStrictEqual([
        {
          frameStart: 1,
          frameEnd: 2,
          text: "a",
          type: "normal",
          wordStart: 0,
        },
        {
          frameStart: 2,
          frameEnd: 3,
          text: "b",
          type: "delete",
          wordStart: 1,
        },
      ]);
    });
  });
}
