import { ref } from "vue";
import { defineStore } from "pinia";
function getTrackSource(track, idx, start, end) {
  //start 和 end 是全局的以帧为单位的开始和结束时间，比如 100, 200
  let frameskip = 0,
    duration = end - start,
    offset = start;
  for (let i = 0; i < idx; i++) {
    frameskip += track.origin[i].buffer.length;
  }
  // idx指的是第几个buffer,一个track可能有多个buffer,start和end有可能跨越多个track
  // 将start和end映射到这个buffer的时候，start 有可能小于0，等于0或者大于0
  offset -= frameskip;
  if (offset < 0) {
    duration += offset;
    offset = 0;
  }
  if (offset > track.origin[idx].buffer.length) {
    duration = 0;
  } else if (offset + duration > track.origin[idx].buffer.length) {
    duration -= offset + duration - track.origin[idx].buffer.length;
  }
  return { offset, duration };
}
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
  const stop = ref(null);
  async function load() {
    list.value = await api.call("listProjects");
  }
  async function create() {}
  async function saveParagraph(project) {
    await api.call(
      "save2file",
      project.id,
      "paragraphs.json",
      JSON.parse(
        JSON.stringify(
          project.paragraphs.map((p) => {
            const { pieces, index, ...other } = p;
            return other;
          })
        )
      )
    );
  }

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
    } else {
      const enc = new TextDecoder("utf-8");
      const str = enc.decode(paragraphs);
      project.paragraphs = JSON.parse(str);
      project.paragraphs.forEach(
        (p) => (p.pieces = words2pieces(project, p.start, p.end))
      );
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
      saveParagraph(project);
    }
  }
  async function loadTracks(project) {
    const context = new AudioContext();
    for (let track of project.tracks) {
      for (let idx = 0; idx < track.origin.length; idx++) {
        if (!track.origin[idx].buffer) {
          const fileBuffer = await api.call(
            "readfile",
            project.id,
            track.origin[idx].path
          );
          const buffer = await context.decodeAudioData(fileBuffer.buffer);
          track.origin[idx].buffer = buffer;
        }
      }
    }
  }

  function preparePieceAudioSource(project, piece) {
    if (piece.sources) return;
    if (piece.type == "normal") {
      piece.sources = [];
      for (let track of project.tracks) {
        let when = 0;
        for (let idx = 0; idx < track.origin.length; idx++) {
          const { offset, duration } = getTrackSource(
            track,
            idx,
            piece.frameStart,
            piece.frameEnd
          );
          if (duration > 0) {
            piece.sources.push({
              when,
              offset,
              duration,
              buffer: track.origin[idx].buffer,
            });
            when += duration;
          }
        }
      }
    }
  }
  async function playParagraph(project, idx) {
    await loadTracks(project);
    project.paragraphs[idx].pieces.forEach((piece) =>
      preparePieceAudioSource(project, piece)
    );
    let allsource = [];
    let when = 0;
    for (let piece of project.paragraphs[idx].pieces) {
      allsource = [
        ...allsource,
        ...piece.sources.map((s) => ({ ...s, when: s.when + when })),
      ];
      when += piece.frameEnd - piece.frameStart;
    }
    play(allsource);
  }
  function play(sources) {
    const ctx = new AudioContext();
    let g = ctx.createGain();
    g.gain.value = 0.5;
    g.connect(ctx.destination);
    const nodes = sources.map(({ when, offset, duration, buffer }) => {
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(g);
      return {
        when: when / buffer.sampleRate,
        offset: offset / buffer.sampleRate,
        duration: duration / buffer.sampleRate,
        node,
      };
    });
    nodes.forEach(({ when, offset, duration, node }) => {
      node.start(when, offset, duration);
    });
    stop.value = () => {
      nodes.forEach(({ node }) => {
        node.stop();
      });
    };
  }
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
      saveParagraph(project);
    }
  }
  load();
  return {
    list,
    load,
    stop,
    create,
    prepare,
    words2pieces,
    splitParagraph,
    mergeBackParagraph,
    saveParagraph,
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
    it("getTrackSource", () => {
      expect(
        getTrackSource({ origin: [{ buffer: { length: 100 } }] }, 0, 0, 100)
      ).toStrictEqual({
        offset: 0,
        duration: 100,
      });
      expect(
        getTrackSource(
          {
            origin: [{ buffer: { length: 100 } }, { buffer: { length: 100 } }],
          },
          0,
          0,
          101
        )
      ).toStrictEqual({
        offset: 0,
        duration: 100,
      });
      expect(
        getTrackSource(
          {
            origin: [{ buffer: { length: 100 } }, { buffer: { length: 100 } }],
          },
          0,
          100,
          101
        )
      ).toStrictEqual({
        offset: 100,
        duration: 0,
      });
      expect(
        getTrackSource(
          {
            origin: [{ buffer: { length: 100 } }, { buffer: { length: 100 } }],
          },
          1,
          0,
          90
        )
      ).toStrictEqual({
        offset: 0,
        duration: -10,
      });
      expect(
        getTrackSource(
          {
            origin: [{ buffer: { length: 100 } }, { buffer: { length: 100 } }],
          },
          1,
          120,
          170
        )
      ).toStrictEqual({
        offset: 20,
        duration: 50,
      });
      expect(
        getTrackSource(
          {
            origin: [{ buffer: { length: 100 } }, { buffer: { length: 100 } }],
          },
          1,
          120,
          220
        )
      ).toStrictEqual({
        offset: 20,
        duration: 80,
      });
    });
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
