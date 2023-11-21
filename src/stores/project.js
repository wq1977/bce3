import { ref, watch } from "vue";
import { defineStore } from "pinia";
import toWav from "audiobuffer-to-wav";

const PARAGRAPH_DELAY = 44100 * 3;

let beepBuffer = null;
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
      if (currentPiece) {
        pieces.push({
          ...currentPiece,
          duration:
            currentPiece.type == "delete"
              ? 0
              : currentPiece.frameEnd - currentPiece.frameStart,
        });
      }
      currentPiece = {
        type: wordType,
        frameStart: words[idx].start,
        frameEnd: words[idx].end,
        wordStart: idx + start,
        text: words[idx].word,
      };
    }
  }
  if (currentPiece) {
    pieces.push({
      ...currentPiece,
      duration:
        currentPiece.type == "delete"
          ? 0
          : currentPiece.frameEnd - currentPiece.frameStart,
    });
  }
  return pieces;
}

export const useProjectStore = defineStore("project", () => {
  const list = ref([]);
  const stop = ref(null);
  watch(stop, (_, old) => {
    if (old) {
      old();
    }
  });
  async function load() {
    list.value = await api.call("listProjects");
  }
  async function create() {}
  async function saveWords(project) {
    await api.call(
      "save2file",
      project.id,
      "words.json",
      JSON.parse(JSON.stringify(project.words))
    );
  }
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
  async function buildBeepBuffer() {
    const offlineCtx = new OfflineAudioContext(1, 100, 44100);
    let g = offlineCtx.createGain();
    g.gain.value = 0.5;
    g.connect(offlineCtx.destination);

    var oscillator = offlineCtx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 441;
    oscillator.connect(g);
    oscillator.start();
    return await offlineCtx.startRendering();
  }
  async function loadTracks(project) {
    if (!beepBuffer) beepBuffer = await buildBeepBuffer();
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
    if (!piece.type || piece.type == "normal") {
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
    } else if (piece.type == "delete") {
      piece.sources = [];
      piece.duration = 0;
    } else if (piece.type == "beep") {
      piece.sources = [
        {
          buffer: beepBuffer,
          when: 0,
          offset: 0,
          duration: piece.frameEnd - piece.frameStart,
          loop: true,
        },
      ];
    }
  }

  async function doExport(project) {
    await loadTracks(project);
    const validParagraphs = project.paragraphs
      .filter((p) => p.comment)
      .sort((a, b) => a.sequence - b.sequence);
    for (let paragraph of validParagraphs) {
      paragraph.pieces.forEach((piece) =>
        preparePieceAudioSource(project, piece)
      );
    }
    let allsource = [];
    let when = 0;
    for (let paragraph of validParagraphs) {
      for (let piece of paragraph.pieces) {
        allsource = [
          ...allsource,
          ...piece.sources.map((s) => ({ ...s, when: s.when + when })),
        ];
        when += isNaN(piece.duration)
          ? piece.frameEnd - piece.frameStart
          : piece.duration;
      }
      when += PARAGRAPH_DELAY;
    }
    const buffer = await getSourcesBuffer(allsource);
    await api.call(
      "save2file",
      `/Users/wwq/Desktop/${project.id}.wav`,
      toWav(buffer)
    );
  }

  async function playParagraph(project, paragraph) {
    await loadTracks(project);
    paragraph.pieces.forEach((piece) =>
      preparePieceAudioSource(project, piece)
    );
    let allsource = [];
    let when = 0;
    for (let piece of paragraph.pieces) {
      allsource = [
        ...allsource,
        ...piece.sources.map((s) => ({ ...s, when: s.when + when })),
      ];
      when += isNaN(piece.duration)
        ? piece.frameEnd - piece.frameStart
        : piece.duration;
    }
    play(allsource);
  }
  function playTracks(project, seek = 0) {
    const sources = [];
    let projectLength = 0;
    for (let track of project.tracks) {
      let trackLength = 0;
      for (let origin of track.origin) {
        trackLength += origin.buffer.length;
      }
      if (trackLength > projectLength) projectLength = trackLength;
    }
    seek = Math.round(seek * projectLength);
    console.log("play in", seek, projectLength);

    for (let track of project.tracks) {
      let seekLeft = seek;
      let when = 0;
      for (let origin of track.origin) {
        if (seekLeft > 0) {
          const offset = seekLeft;
          seekLeft -= origin.buffer.length;
          if (seekLeft < 0) {
            const duration = origin.buffer.length - offset;
            seekLeft = 0;
            sources.push({
              when,
              offset,
              duration,
              buffer: origin.buffer,
            });
            when += duration;
          }
        } else {
          sources.push({
            when,
            offset: 0,
            duration: origin.buffer.length,
            buffer: origin.buffer,
          });
          when += origin.buffer.length;
        }
      }
      if (when > projectLength) projectLength = when;
    }
    play(sources);
  }

  function play(sources) {
    const ctx = new AudioContext();
    let g = ctx.createGain();
    g.gain.value = 0.5;
    g.connect(ctx.destination);
    const nodes = sources.map(({ when, offset, duration, buffer, loop }) => {
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = !!loop;
      node.connect(g);
      return {
        when: when / buffer.sampleRate,
        offset: offset / buffer.sampleRate,
        duration: duration / buffer.sampleRate,
        node,
      };
    });
    nodes.sort((a, b) => a.when + a.duration - b.when - b.duration);
    nodes.forEach(({ when, offset, duration, node }) => {
      node.start(when, offset, duration);
    });
    nodes[nodes.length - 1].node.onended = function () {
      stop.value && stop.value();
      stop.value = null;
    };
    stop.value = () => {
      nodes.forEach(({ node }) => {
        node.stop();
      });
    };
  }
  function getWordIndex(project, piece, position) {
    let len = 0,
      idx = piece.wordStart;
    while (len < position && idx < project.words.length) {
      len += project.words[idx++].word.length;
    }
    return idx;
  }

  function getPieceDuration(piece) {
    return isNaN(piece.duration)
      ? piece.frameEnd - piece.frameStart
      : piece.duration;
  }

  function getParagraphDuration(paragraph) {
    return (
      paragraph.pieces.reduce((r, i) => r + getPieceDuration(i), 0) +
      PARAGRAPH_DELAY
    );
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

  async function playWords(project, from, to) {
    const dummyParagraph = {
      start: from,
      end: to,
      pieces: words2pieces(project, from, to),
    };
    await playParagraph(project, dummyParagraph);
  }

  async function playWordsRaw(project, from, to) {
    const buffer = await getWordsBuffer(project, from, to);
    if (buffer) {
      const ctx = new AudioContext();
      let g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(g);
      node.start();
    }
  }

  async function getSourcesBuffer(sources) {
    sources.sort((a, b) => a.when + a.duration - b.when - b.duration);
    const lastSource = sources[sources.length - 1];
    const offlineCtx = new OfflineAudioContext(
      2,
      lastSource.when + lastSource.duration,
      lastSource.buffer.sampleRate
    );
    const g = offlineCtx.createGain();
    g.gain.value = 1;
    g.connect(offlineCtx.destination);
    const nodes = [];
    for (let src of sources) {
      const { when, offset, duration, buffer, loop } = src;
      const node = offlineCtx.createBufferSource();
      node.buffer = buffer;
      node.loop = !!loop;
      node.connect(g);
      nodes.push({
        when: when / buffer.sampleRate,
        offset: offset / buffer.sampleRate,
        duration: duration / buffer.sampleRate,
        node,
      });
    }
    for (let { when, offset, duration, node } of nodes) {
      node.start(when, offset, duration);
    }
    return await offlineCtx.startRendering();
  }

  async function getWordsBuffer(project, from, to) {
    await loadTracks(project);
    const piece = {
      frameStart: project.words[from].start,
      frameEnd: project.words[to].end,
    };
    preparePieceAudioSource(project, piece);
    // console.log(piece);
    if (piece.sources.length) {
      return getSourcesBuffer(piece.sources);
    }
  }

  async function setTag(project, paragraphIdx, wordstart, wordend, tag) {
    if (project.paragraphs[paragraphIdx].start > wordstart) return;
    if (project.paragraphs[paragraphIdx].end < wordend) return;
    for (let i = wordstart; i <= wordend; i++) {
      project.words[i].type = tag;
    }
    project.paragraphs[paragraphIdx].pieces = words2pieces(
      project,
      project.paragraphs[paragraphIdx].start,
      project.paragraphs[paragraphIdx].end
    );
    saveWords(project);
    saveParagraph(project);
  }
  function updateParagraphsPieces(project, idx) {
    project.paragraphs[idx].pieces = words2pieces(
      project,
      project.paragraphs[idx].start,
      project.paragraphs[idx].end
    );
  }
  async function appendNewTracks(project, files) {
    const decodeContext = new AudioContext();
    const audioBuffers = await Promise.all(
      [...files].map(async (file) => {
        const { path, buffer } = await api.call(
          "loadTrack",
          project.id,
          file.path
        );
        const audioBuffer = await decodeContext.decodeAudioData(buffer.buffer);
        return {
          name: file.name,
          path,
          buffer: audioBuffer,
        };
      })
    );
    let idx = 0;
    if (!project.tracks) {
      project.tracks = [
        {
          name: "track1",
        },
      ];
    }
    for (let audio of audioBuffers) {
      const track = project.tracks[idx % project.tracks.length];
      if (!track.origin) {
        track.origin = [];
      }
      track.origin = [
        ...track.origin,
        {
          ...audio,
        },
      ];
      idx++;
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
    getWordIndex,
    setTag,
    getWordsBuffer,
    playWords,
    playWordsRaw,
    saveWords,
    updateParagraphsPieces,
    getParagraphDuration,
    doExport,
    loadTracks,
    playTracks,
    appendNewTracks,
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
