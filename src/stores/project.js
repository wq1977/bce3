import { ref, watch } from "vue";
import { defineStore } from "pinia";
import moment from "moment";
import toWav from "audiobuffer-to-wav";

const PARAGRAPH_DEFAULT_DELAY = 3;
const S2T_SAMPLE_RATE = 44100;
const GENURATE_SAMPLE_RATE = 44100;

let beepBuffer = null;
const loading = ref(false);
const playProgress = ref(0);
const buffers = {};

//某个track的某个buffer如果全局start和end的时候的offset和duration
function getTrackSource(track, idx, start, end) {
  console.log("get track source", idx, start, end);
  //start 和 end 是全局的以秒为单位的开始和结束时间，比如 1.01, 2
  let secondSkip = 0,
    duration = end - start,
    offset = start;

  for (let i = 0; i < idx; i++) {
    secondSkip += track.origin[i].buffer.duration;
  }
  // idx指的是第几个buffer,一个track可能有多个buffer,start和end有可能跨越多个track
  // 将start和end映射到这个buffer的时候，start 有可能小于0，等于0或者大于0
  offset -= secondSkip;
  if (offset < 0) {
    duration += offset;
    offset = 0;
  }
  if (offset > track.origin[idx].buffer.duration) {
    duration = 0;
  } else if (offset + duration > track.origin[idx].buffer.duration) {
    duration -= offset + duration - track.origin[idx].buffer.duration;
  }
  return { offset, duration };
}
function words2pieces(project, start, end) {
  const words = project.words.slice(start, end + 1);
  const pieces = [];
  let currentPiece;
  for (let idx = 0; idx < words.length; idx++) {
    const wordType = words[idx].type || "normal";
    if (
      currentPiece &&
      wordType == currentPiece.type &&
      !!words[idx].ishot == currentPiece.ishot
    ) {
      currentPiece.frameEnd = words[idx].end;
      currentPiece.end = words[idx].end / S2T_SAMPLE_RATE;
      currentPiece.text = `${currentPiece.text}${words[idx].word}`;
    } else {
      if (currentPiece) {
        pieces.push({
          ...currentPiece,
          duration:
            currentPiece.type == "delete"
              ? 0
              : (currentPiece.frameEnd - currentPiece.frameStart) /
                S2T_SAMPLE_RATE,
        });
      }
      currentPiece = {
        type: wordType,
        ishot: !!words[idx].ishot,
        frameStart: words[idx].start,
        frameEnd: words[idx].end,
        start: words[idx].start / S2T_SAMPLE_RATE,
        end: words[idx].end / S2T_SAMPLE_RATE,
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
          : (currentPiece.frameEnd - currentPiece.frameStart) / S2T_SAMPLE_RATE,
    });
  }
  return pieces;
}

export const useProjectStore = defineStore("project", () => {
  const list = ref([]);
  const shareList = ref([]);
  const stop = ref(null);
  watch(stop, (_, old) => {
    if (old) {
      old();
    }
  });
  async function load() {
    list.value = (await api.call("listProjects")) || [];
    for (let proj of list.value) {
      prepare(proj);
    }
  }
  async function refreshShareList(project) {
    shareList.value =
      (await api.call("listShare", JSON.parse(JSON.stringify(project.cfg)))) ||
      [];
  }
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
    const words = await api.call("readfile", project.id, "words.json");
    if (words) {
      const enc = new TextDecoder("utf-8");
      const str = enc.decode(words);
      project.words = JSON.parse(str);
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
    }
  }
  //把某个段落从某个piece的position的位置分为两段
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
    const offlineCtx = new OfflineAudioContext(1, 100, GENURATE_SAMPLE_RATE);
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
    const context = new AudioContext();
    if (!beepBuffer) beepBuffer = await buildBeepBuffer();
    if (project.cfg.piantou && !buffers[project.cfg.piantou.name]) {
      const fileBuffer = await api.call(
        "readfile",
        project.id,
        project.cfg.piantou.path
      );
      const buffer = await context.decodeAudioData(fileBuffer.buffer);
      buffers[project.cfg.piantou.name] = buffer;
    }
    if (project.cfg.bgm && !buffers[project.cfg.bgm.name]) {
      const fileBuffer = await api.call(
        "readfile",
        project.id,
        project.cfg.bgm.path
      );
      const buffer = await context.decodeAudioData(fileBuffer.buffer);
      buffers[project.cfg.bgm.name] = buffer;
    }
    if (project.cfg.pianwei && !buffers[project.cfg.pianwei.name]) {
      const fileBuffer = await api.call(
        "readfile",
        project.id,
        project.cfg.pianwei.path
      );
      const buffer = await context.decodeAudioData(fileBuffer.buffer);
      buffers[project.cfg.pianwei.name] = buffer;
    }
    for (let track of project.tracks) {
      for (let idx = 0; idx < track.origin.length; idx++) {
        if (!track.origin[idx].buffer) {
          loading.value = true;
          const fileBuffer = await api.call(
            "readfile",
            project.id,
            track.origin[idx].path
          );
          const buffer = await context.decodeAudioData(fileBuffer.buffer);
          loading.value = false;
          track.origin[idx].buffer = buffer;
        }
      }
    }
  }

  function bufferReady(project) {
    for (let i = 0; i < project.tracks.length; i++) {
      for (let j = 0; j < project.tracks[i].origin.length; j++) {
        if (!project.tracks[i].origin[j].buffer) return false;
      }
    }
    return true;
  }

  function preparePieceAudioSource(project, piece) {
    if (!bufferReady(project)) {
      return;
    }
    if (!piece.type || piece.type == "normal") {
      piece.sources = [];
      for (let track of project.tracks) {
        let when = 0;
        for (let idx = 0; idx < track.origin.length; idx++) {
          const { offset, duration } = getTrackSource(
            track,
            idx,
            piece.start,
            piece.end
          );
          if (duration > 0) {
            piece.sources.push({
              type: "content",
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
          type: "content",
          when: 0,
          offset: 0,
          duration: piece.duration,
          loop: true,
        },
      ];
    }
  }

  async function doExport(project) {
    const path = await api.call("saveDialog", {
      title: "保存文件",
      defaultPath: `${project.id}.wav`,
      filters: [
        {
          name: "wav",
          extensions: [".wav"],
        },
      ],
    });
    if (path) {
      await loadTracks(project);
      const allsource = getProjectSources(project);
      const buffer = await getSourcesBuffer(allsource);
      await api.call("save2file", path, toWav(buffer));
    }
  }

  function prepareParagraphPieceForPlay(project, paragraph) {
    paragraph.pieces.forEach((piece) =>
      preparePieceAudioSource(project, piece)
    );
    let when = 0;
    for (let piece of paragraph.pieces) {
      (piece.sources || []).forEach((s) => {
        s.when = s.when + when;
      });
      when += isNaN(piece.duration) ? piece.end - piece.start : piece.duration;
    }
  }

  async function playParagraph(project, paragraph) {
    await loadTracks(project);
    prepareParagraphPieceForPlay(project, paragraph);
    let allsource = paragraph.pieces.reduce((r, p) => [...r, ...p.sources], []);
    play(allsource);
  }

  //返回最长的那个track的长度，支持不同的sampleRate
  function projectTrackLen(project) {
    let projectLength = 0;
    if (project) {
      for (let track of project.tracks) {
        let trackLength = 0;
        for (let origin of track.origin) {
          trackLength += origin.buffer ? origin.buffer.length : 0;
        }
        if (trackLength > projectLength) projectLength = trackLength;
      }
    }
    return projectLength;
  }

  function playTracks(project, seek = 0, ctx = null) {
    const sources = [];
    for (let track of project.tracks) {
      let when = 0;
      for (let origin of track.origin) {
        sources.push({
          when,
          offset: 0,
          duration: origin.buffer.duration,
          buffer: origin.buffer,
        });
        when += origin.buffer.duration;
      }
    }
    play(sources, seek, ctx);
  }

  //source是一个包含内容和播放信息的片段
  //在when的时间播放buffer的offset位置，播放duration这么长，而且要loop
  function getProjectSources(project) {
    if (!project) return [];
    if (!bufferReady(project)) return [];
    const validParagraphs = (project.paragraphs || [])
      .filter((p) => p.comment)
      .sort((a, b) => a.sequence - b.sequence);
    for (let paragraph of validParagraphs) {
      prepareParagraphPieceForPlay(project, paragraph);
    }
    const CHANGE_VOLUMN_DURATION = 1;
    let allsource = [];
    let when = 0;
    let paragraphDelay = PARAGRAPH_DEFAULT_DELAY;
    // 整个工程的播放顺序如下，如果使用片头曲，就先播放片头曲，如果定义了hotline，就把hotline插入到片头曲中
    // 片头曲不会重复播放，如果hotline的长度超过了片头曲，超出的部分将没有音乐
    // 片头曲的音量将按照hotline的长度自动变化
    // 如果没有指定片头曲，无论是否指定hotline，都不会播放hotline
    if (project.cfg) {
      paragraphDelay = project.cfg.paragraphDelta || PARAGRAPH_DEFAULT_DELAY;
      if (project.cfg.usePianTou && project.cfg.piantou) {
        if (!buffers[project.cfg.piantou.name]) return [];
        const highVol = project.cfg.piantou.highVol || 0.9;
        const lowVol = project.cfg.piantou.lowVol || 0.1;
        const piantouSource = {
          when,
          type: "piantou",
          offset: 0,
          duration: buffers[project.cfg.piantou.name].duration,
          buffer: buffers[project.cfg.piantou.name],
          volumns: [{ at: when, volumn: highVol }],
        };
        allsource.push(piantouSource);
        const HOTLINE_PADDING_LEFT = paragraphDelay;
        //hotline是type是hot的piece
        const hotlines = getHotLines(project);
        let currentHotEndAt = 0;
        when += HOTLINE_PADDING_LEFT;
        if (project.cfg.showHots) {
          for (let piece of hotlines) {
            if (!piece.sources.length) continue;
            let pieceEndAt = piece.wordStart;
            while (
              pieceEndAt < project.words.length &&
              project.words[pieceEndAt].ishot
            ) {
              pieceEndAt++;
            }

            if (pieceEndAt != currentHotEndAt) {
              if (currentHotEndAt != 0) {
                piantouSource.volumns.push({
                  at: when + CHANGE_VOLUMN_DURATION,
                  volumn: lowVol,
                });
                piantouSource.volumns.push({
                  at: when + CHANGE_VOLUMN_DURATION * 2,
                  volumn: highVol,
                });
                when += HOTLINE_PADDING_LEFT;
              }
              piantouSource.volumns.push({
                at: when - CHANGE_VOLUMN_DURATION * 2,
                volumn: highVol,
              });
              piantouSource.volumns.push({
                at: when - CHANGE_VOLUMN_DURATION,
                volumn: lowVol,
              });
              currentHotEndAt = pieceEndAt;
            }
            for (let source of piece.sources) {
              allsource.push({
                ...source,
                type: "hot",
                when,
              });
            }
            when += piece.sources[0].duration;
          }
          piantouSource.volumns.push({
            at: when + CHANGE_VOLUMN_DURATION,
            volumn: lowVol,
          });
          piantouSource.volumns.push({
            at: when + CHANGE_VOLUMN_DURATION * 2,
            volumn: highVol,
          });
          if (when < piantouSource.when + piantouSource.duration) {
            when = piantouSource.when + piantouSource.duration;
          }
        }
        if (when < piantouSource.when + piantouSource.duration) {
          when = piantouSource.when + piantouSource.duration;
        }
        if (when < paragraphDelay) when = paragraphDelay;
      }
    }

    // 然后会按顺序播放段落，每个段落之前有默认的间隔，可以给每个段落单独指定段前间隔
    // 背景音乐的时长会跟各个段落的时长一致，可以指定当段落间隔大于3秒时，是否自动增大bgm的音量
    let bgmSource;
    const bgmHighVol = project.cfg.bgm ? project.cfg.bgm.highVol || 0.9 : 0.9;
    const bgmLowVol = project.cfg.bgm ? project.cfg.bgm.lowVol || 0.1 : 0.1;
    if (project.cfg.useBGM && project.cfg.bgm) {
      if (!buffers[project.cfg.bgm.name]) return [];
      bgmSource = {
        type: "bgm",
        when: project.cfg.bgm.margin ? when + 1 : when,
        offset: 0,
        buffer: buffers[project.cfg.bgm.name],
        loop: true,
        volumns: [
          {
            at: project.cfg.bgm.margin ? when + 1 : when,
            volumn: project.cfg.bgm.snake ? bgmHighVol : bgmLowVol,
          },
        ],
      };
      allsource.push(bgmSource);
    }

    let lastParagraphDuration = 0;
    //播放主要内容
    for (let idx = 0; idx < validParagraphs.length; idx++) {
      const paragraph = validParagraphs[idx];
      lastParagraphDuration = getParagraphDuration(paragraph);
      when += paragraphDelay;
      if (project.cfg.bgm && project.cfg.bgm.snake) {
        bgmSource.volumns.push({
          at: when - 2 * CHANGE_VOLUMN_DURATION,
          volumn: bgmHighVol,
        });
        bgmSource.volumns.push({
          at: when - CHANGE_VOLUMN_DURATION,
          volumn: bgmLowVol,
        });
      }
      for (let piece of paragraph.pieces) {
        allsource = [
          ...allsource,
          ...(piece.sources || []).map((s) => ({ ...s, when: s.when + when })),
        ];
      }
      when += lastParagraphDuration;
      if (
        project.cfg.bgm &&
        project.cfg.bgm.snake &&
        idx !== validParagraphs.length - 1
      ) {
        bgmSource.volumns.push({
          at: when + CHANGE_VOLUMN_DURATION,
          volumn: bgmLowVol,
        });
        bgmSource.volumns.push({
          at: when + 2 * CHANGE_VOLUMN_DURATION,
          volumn: bgmHighVol,
        });
      }
    }

    if (bgmSource) {
      if (project.cfg.pianwei && project.cfg.pianwei.fadein) {
        bgmSource.duration =
          when -
          bgmSource.when -
          Math.min(lastParagraphDuration, paragraphDelay);
      } else {
        bgmSource.duration = when - bgmSource.when;
      }
      bgmSource.duration -= project.cfg.bgm.margin ? 1 : 0;
    }

    // 片尾曲（如果有）将完整播放，可以指定一个提前播放量，如果有提前播放，音乐将自动控制
    if (project.cfg.usePianWei && project.cfg.pianwei) {
      if (!buffers[project.cfg.pianwei.name]) return [];
      const highVol = project.cfg.pianwei.highVol || 0.9;
      const lowVol = project.cfg.pianwei.lowVol || 0.1;
      const pianwei = {
        type: "pianwei",
        when: project.cfg.pianwei.fadein
          ? when - Math.min(lastParagraphDuration, paragraphDelay)
          : when,
        offset: 0,
        buffer: buffers[project.cfg.pianwei.name],
        duration: buffers[project.cfg.pianwei.name].duration,
        volumns: project.cfg.pianwei.fadein
          ? [
              {
                at: when - Math.min(lastParagraphDuration, paragraphDelay),
                volumn: lowVol,
              },
              { at: when, volumn: lowVol },
              { at: when + 1, volumn: highVol },
            ]
          : [{ at: when, volumn: highVol }],
      };
      allsource.push(pianwei);
    }
    return allsource;
  }

  function getSourcesLen(sources) {
    sources = sources.sort((a, b) => a.when + a.duration - b.when - b.duration);
    const last = sources[sources.length - 1];
    return last.when + last.duration;
  }

  function trim(sources, seek = 0) {
    const totalLen = getSourcesLen(sources);
    const seekPosition = totalLen * seek;
    const newsources = [];
    for (let source of sources) {
      const begin = source.when;
      const end = source.when + source.duration;
      if (source.volumns) {
        source.volumns = source.volumns.map((v) => ({
          ...v,
          at: v.at - seekPosition,
        }));
        const newVolumns = [];
        for (let i = 0; i < source.volumns.length; i++) {
          if (source.volumns[i].at < 0) {
            if (i == source.volumns.length - 1) {
              newVolumns.push({ ...source.volumns[i], at: 0 });
            } else if (source.volumns[i + 1].at >= 0) {
              newVolumns.push({
                ...source.volumns[i],
                at: 0,
                volumn:
                  source.volumns[i].volumn +
                  ((source.volumns[i + 1].volumn - source.volumns[i].volumn) *
                    (0 - source.volumns[i].at)) /
                    (source.volumns[i + 1].at - source.volumns[i].at),
              });
            } else {
              //no need this volumn setting, skip
            }
          } else {
            newVolumns.push(source.volumns[i]);
          }
        }
        source.volumns = newVolumns;
      }
      if (end > seekPosition) {
        if (begin <= seekPosition) {
          const needTrim = seekPosition - begin;
          newsources.push({
            ...source,
            when: 0,
            offset: source.offset + needTrim,
            duration: source.duration - needTrim,
          });
        } else {
          newsources.push({
            ...source,
            when: (source.when -= seekPosition),
          });
        }
      }
    }
    return newsources;
  }

  function play(sources, seek = 0, ctx = null) {
    const deepClone = sources.map((s) => ({ ...s }));
    const totalLen = getSourcesLen(deepClone);
    const seekPosition = totalLen * seek;
    sources = trim(deepClone, seek);
    if (!ctx) {
      ctx = new AudioContext();
    }
    let g = ctx.createGain();
    g.gain.value = 0.5;
    g.connect(ctx.destination);
    const nodes = getPlayNodes(ctx, g, sources);
    nodes.forEach(({ when, offset, duration, node }) => {
      node.start(when, offset, duration);
    });
    function outputTimestamps() {
      const ts = ctx.currentTime;
      playProgress.value = (ts + seekPosition) / totalLen;
      rAF = requestAnimationFrame(outputTimestamps);
    }
    let rAF = requestAnimationFrame(outputTimestamps);
    nodes[nodes.length - 1].node.onended = function () {
      stop.value && stop.value();
      stop.value = null;
    };
    stop.value = () => {
      nodes.forEach(({ node }) => {
        node.stop();
      });
      cancelAnimationFrame(rAF);
    };
  }
  //获取某个piece某个position的单词的索引
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
      ? (piece.frameEnd - piece.frameStart) / S2T_SAMPLE_RATE
      : piece.duration;
  }

  function getParagraphDuration(paragraph) {
    return paragraph.pieces.reduce((r, i) => r + getPieceDuration(i), 0);
  }
  /***
   * 一个播客由多个音轨组成，最主要的就是内容音轨，它是根据项目内容自动生成的
   * 默认的内容包括已经分段好的段落内容和已经设置好的金句段落，可以统一设置金句的
   * 起始终止间隔时间，金句间隔时间，段落的起始终止间隔时间和段落的间隔时间
   */
  function getContentBlocks(project) {
    if (!project) return [];
    if (!project.paragraphs) return [];

    const result = [];
    for (let index = 0; index < project.paragraphs.length; index++) {
      const p = project.paragraphs[index];
      if (p.comment) {
        result.push({
          title: p.comment,
          index,
          sequence: p.sequence,
        });
      }
    }
    const list = result.sort(
      (a, b) => (a.sequence || a.index) - (b.sequence || b.index)
    );
    for (let value of list) {
      value.duration = getParagraphDuration(project.paragraphs[value.index]);
    }
    return list;
  }
  //合并两个段落
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

  // 不用考虑word类型，只要有word就播放
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

  function getPlayNodes(ctx, dest, sources) {
    return sources.map(({ when, offset, duration, buffer, loop, volumns }) => {
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = !!loop;
      if (volumns) {
        let localG = ctx.createGain();
        localG.gain.value = volumns[volumns.length - 1].volumn;
        for (let idx = 0; idx < volumns.length; idx++) {
          let volumn = volumns[idx];
          if (idx == 0) {
            localG.gain.setValueAtTime(volumn.volumn, volumn.at);
          } else {
            localG.gain.linearRampToValueAtTime(volumn.volumn, volumn.at);
          }
        }
        localG.connect(dest);
        node.connect(localG);
      } else {
        node.connect(dest);
      }
      return {
        when,
        offset,
        duration,
        node,
      };
    });
  }

  async function getSourcesBuffer(sources) {
    const totalLen = getSourcesLen(sources);
    const offlineCtx = new OfflineAudioContext(
      2,
      Math.ceil(totalLen * GENURATE_SAMPLE_RATE),
      GENURATE_SAMPLE_RATE
    );
    const g = offlineCtx.createGain();
    g.gain.value = 1;
    g.connect(offlineCtx.destination);
    const nodes = getPlayNodes(offlineCtx, g, sources);
    for (let { when, offset, duration, node } of nodes) {
      node.start(when, offset, duration);
    }
    return await offlineCtx.startRendering();
  }

  async function getWordsBuffer(project, from, to) {
    await loadTracks(project);
    const piece = {
      start: project.words[from].start / S2T_SAMPLE_RATE,
      end: project.words[to].end / S2T_SAMPLE_RATE,
    };
    preparePieceAudioSource(project, piece);
    if (piece.sources.length) {
      return getSourcesBuffer(piece.sources);
    }
  }

  async function setTag(project, paragraphIdx, wordstart, wordend, tag) {
    if (project.paragraphs[paragraphIdx].start > wordstart) return;
    if (project.paragraphs[paragraphIdx].end < wordend) return;
    if (tag == "hot") {
      for (let i = wordstart; i <= wordend; i++) {
        project.words[i].ishot = true;
      }
    } else {
      for (let i = wordstart; i <= wordend; i++) {
        project.words[i].type = tag;
      }
    }
    project.paragraphs[paragraphIdx].pieces = words2pieces(
      project,
      project.paragraphs[paragraphIdx].start,
      project.paragraphs[paragraphIdx].end
    );
    saveWords(project);
    saveParagraph(project);
  }

  async function setHot(project, paragraphIdx, wordstart, wordend, value) {
    if (project.paragraphs[paragraphIdx].start > wordstart) return;
    if (project.paragraphs[paragraphIdx].end < wordend) return;
    for (let i = wordstart; i <= wordend; i++) {
      project.words[i].ishot = value;
    }
    saveWords(project);
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
        loading.value = true;
        const { path, buffer } = await api.call(
          "loadTrack",
          project.id,
          file.path
        );
        const audioBuffer = await decodeContext.decodeAudioData(buffer.buffer);
        loading.value = false;
        return {
          name: file.name,
          path,
          buffer: audioBuffer,
        };
      })
    );
    let idx = 0;
    if (!project.tracks || !project.tracks.length) {
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
    await saveProject(project);
  }
  function newProject() {
    const id = moment().format("YYYYMMDDHHmmss");
    list.value.push({
      id,
      name: "",
      modified: new Date().getTime(),
      tracks: [],
    });
    return id;
  }
  async function deleteProject(project) {
    await api.call("deleteProject", project.id);
    list.value = list.value.filter((p) => p.id != project.id);
  }
  async function saveProject(project) {
    const { words, paragraphs, ...others } = project;
    const json = JSON.parse(JSON.stringify(others));
    for (let track of json.tracks || []) {
      for (let origin of track.origin) {
        if (origin.buffer) {
          delete origin.buffer;
        }
      }
    }
    await api.call("save2file", project.id, "proj.json", json);
  }
  function formatWords(s2t, lenlimit) {
    // 将所有的时间转换成整数(frame position)的格式
    // 将所有的时间分配给每个word，如果中间不连续需要插入连接符
    // word的frame应该不包括end
    const words = [];
    let framePos = 0;
    for (let segment of s2t.segments) {
      for (let word of segment.words) {
        const frameStart = Math.round(word.start * 44100);
        const frameEnd = Math.round(word.end * 44100);
        if (frameStart > framePos) {
          words.push({
            start: framePos,
            end: frameStart,
            word: "⟷",
          });
        } else if (frameStart < framePos || frameEnd < frameStart) {
          continue;
        }
        words.push({
          start: frameStart,
          end: frameEnd,
          word: word.word,
        });
        framePos = frameEnd;
      }
      words.push({
        start: framePos,
        end: framePos,
        word: ",",
      });
    }
    if (framePos < lenlimit) {
      words.push({
        start: framePos,
        end: lenlimit,
        word: "⟷",
      });
    }
    return words;
  }
  const recognitionProgress = ref(-1);
  async function recognition(project) {
    recognitionProgress.value = 0;
    let screenLock = await navigator.wakeLock.request("screen");
    const lenlimit = projectTrackLen(project);
    const offlineCtx = new OfflineAudioContext(1, lenlimit, S2T_SAMPLE_RATE);
    playTracks(project, 0, offlineCtx);
    const buffer = await offlineCtx.startRendering();
    const s2t = await api.call("recognition", project.id, toWav(buffer));
    project.words = formatWords(s2t, Math.round(lenlimit * S2T_SAMPLE_RATE));
    await saveWords(project);
    screenLock.release();
    recognitionProgress.value = -1;
  }

  function getHotLines(project) {
    if (!project || !project.paragraphs) return [];
    const lines = project.paragraphs.reduce(
      (r, p) => [
        ...r,
        ...p.pieces.filter((l) => l.ishot && l.type !== "delete"),
      ],
      []
    );
    return lines;
  }
  function resetMusicBuffer(arr) {
    for (let key of arr) {
      delete buffers[key];
    }
  }
  load();
  api.on("recognition-progress", "project-store", function (p) {
    recognitionProgress.value = p.end / p.duration;
  });
  return {
    list,
    shareList,
    stop,
    loading,
    playProgress,
    recognitionProgress,
    load,
    play,
    prepare,
    words2pieces,
    splitParagraph,
    mergeBackParagraph,
    saveParagraph,
    playParagraph,
    getWordIndex,
    setTag,
    setHot,
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
    newProject,
    deleteProject,
    saveProject,
    recognition,
    projectTrackLen,
    getHotLines,
    getContentBlocks,
    getProjectSources,
    resetMusicBuffer,
    refreshShareList,
  };
});

if (import.meta.vitest) {
  const { it, describe, expect } = import.meta.vitest;
  describe("", async () => {
    const { setActivePinia, createPinia } = await import("pinia");
    setActivePinia(createPinia());
    global.api = { call: () => {}, on: () => {} };
    const store = useProjectStore();
    it("getTrackSource", () => {
      expect(
        getTrackSource({ origin: [{ buffer: { duration: 100 } }] }, 0, 0, 100)
      ).toStrictEqual({
        offset: 0,
        duration: 100,
      });
      expect(
        getTrackSource(
          {
            origin: [
              { buffer: { duration: 100 } },
              { buffer: { duration: 100 } },
            ],
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
            origin: [
              { buffer: { duration: 100 } },
              { buffer: { duration: 100 } },
            ],
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
            origin: [
              { buffer: { duration: 100 } },
              { buffer: { duration: 100 } },
            ],
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
            origin: [
              { buffer: { duration: 100 } },
              { buffer: { duration: 100 } },
            ],
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
            origin: [
              { buffer: { duration: 100 } },
              { buffer: { duration: 100 } },
            ],
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
      for (let p of project.paragraphs) {
        for (let i in p.pieces) {
          const { start, end, duration, ...others } = p.pieces[i];
          p.pieces[i] = others;
        }
      }
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
              ishot: false,
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
              ishot: false,
              wordStart: 1,
            },
          ],
        },
      ]);
    });
    it("getWordIndex", () => {
      expect(
        store.getWordIndex(
          { words: [{ word: "a" }, { word: "b" }] },
          { wordStart: 0 },
          1
        )
      ).toBe(1);
    });
    it("getProjectSources", async () => {
      global.AudioContext = class {};
      beepBuffer = {};
      const allsources = store.getProjectSources({
        cfg: {},
        tracks: [{ origin: [{ buffer: { duration: 5 } }] }],
        paragraphs: [
          {
            comment: "test",
            pieces: [
              {
                start: 1,
                end: 2,
              },
            ],
          },
        ],
      });
      expect(allsources.length).toBe(1);
    });
    it("words2pieces", () => {
      var list = words2pieces(
        {
          words: [
            { start: 1, end: 2, word: "a" },
            { start: 2, end: 3, word: "b" },
          ],
        },
        0,
        1
      );
      const { start, end, duration, ...others } = list[0];
      expect([others]).toStrictEqual([
        {
          frameStart: 1,
          frameEnd: 3,
          text: "ab",
          type: "normal",
          ishot: false,
          wordStart: 0,
        },
      ]);
      list = words2pieces(
        {
          words: [
            { start: 1, end: 2, word: "a" },
            { start: 2, end: 3, word: "b", type: "delete" },
          ],
        },
        0,
        1
      );
      for (let i in list) {
        const { start, end, duration, ...others } = list[i];
        list[i] = others;
      }
      expect(list).toStrictEqual([
        {
          frameStart: 1,
          frameEnd: 2,
          text: "a",
          type: "normal",
          ishot: false,
          wordStart: 0,
        },
        {
          frameStart: 2,
          frameEnd: 3,
          text: "b",
          type: "delete",
          ishot: false,
          wordStart: 1,
        },
      ]);
    });
  });
}
