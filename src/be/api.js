const { shell, dialog, BrowserWindow } = require("electron");
const level = require("classic-level");
const { createHash } = require("crypto");
import createLogger from "./log";
import { shares } from "./shares";
import { VIEW_PORT } from "../common/common";

let db;
let PROJ_BASE;
const RESOURCE_ROOT = require("path").join(__dirname, "..", "..");
const log = createLogger("api");
const api = {
  versions() {
    return process.versions;
  },
  async cfgGet(path, def) {
    try {
      return await db.get(`config-${path}`);
    } catch (err) {
      return def;
    }
  },
  async listShare(event, cfg) {
    return await Promise.all(
      shares.map(async (s) => ({
        id: s.id,
        name: s.name,
        status: await s.publishStatus(cfg),
      }))
    );
  },
  async cfgSet(path, value) {
    await db.set(`config-${path}`, value);
  },
  init(dbpath) {
    db = new level.ClassicLevel(dbpath, {
      valueEncoding: "json",
    });
    PROJ_BASE = require("path").join(
      require("electron").app.getPath("userData"),
      "projects"
    );
    const Koa = require("koa");
    const serve = require("koa-static");
    const app = new Koa();
    app.use(serve(require("path").join(PROJ_BASE, "www")));
    app.listen(VIEW_PORT);
  },
  async save2mp3(event, projname, path, channels) {
    let abspath;
    if (!channels) {
      //支持少一个参数绝对值路径模式
      if (projname.indexOf("\\") >= 0 || projname.indexOf("/") >= 0) {
        abspath = projname;
      } else {
        abspath = require("path").join(PROJ_BASE, projname);
      }
      channels = path;
    } else {
      abspath = require("path").join(PROJ_BASE, projname, path);
    }
    return new Promise((r) => {
      event.sender.send("mp3-progress", { running: true, progress: 0 });
      const { Worker } = require("worker_threads");
      const worker = new Worker(require("path").join(__dirname, "wav2mp3.js"), {
        workerData: { path: abspath, channels },
      });
      worker.on("message", (p) => {
        event.sender.send("mp3-progress", { running: true, ...p });
      });
      worker.on("exit", (code) => {
        event.sender.send("mp3-progress", { running: false, code });
        r();
      });
    });
  },
  async publish(event, album, projectid) {
    const indexPathBase = require("path").join(PROJ_BASE, "www", album.id);
    if (!require("fs").existsSync(indexPathBase)) {
      require("fs").mkdirSync(indexPathBase, { recursive: true });
    }
    const assetsPath = require("path").join(__dirname, "..", "..", "assets");
    const templateBase = require("path").join(assetsPath, "templates", "plain");
    const indexTemplatePath = require("path").join(templateBase, "index.html");
    const targetAssetsBase = require("path").join(indexPathBase);
    const srcAssetsBase = require("path").join(templateBase);
    require("fs").cpSync(srcAssetsBase, targetAssetsBase, { recursive: true });
    const indexTemplate = require("fs")
      .readFileSync(indexTemplatePath)
      .toString();
    const mp3Path = require("path").join(PROJ_BASE, projectid, "final.mp3");
    const mp3target = require("path").join(indexPathBase, `${projectid}.mp3`);
    require("fs").cpSync(mp3Path, mp3target);

    const targetIndexPath = require("path").join(indexPathBase, "index.html");
    require("fs").writeFileSync(
      targetIndexPath,
      indexTemplate.replace("__PRE_DATA__", JSON.stringify(album))
    );

    const { episodes, ...other } = album;
    for (let episode of album.episodes) {
      const projectPage = require("path").join(
        indexPathBase,
        `${episode.id}.html`
      );
      require("fs").writeFileSync(
        projectPage,
        indexTemplate.replace(
          "__PRE_DATA__",
          JSON.stringify({
            ...episode,
            album: {
              ...other,
            },
          })
        )
      );
    }
  },
  async save2file(event, projname, path, content) {
    let abspath;
    if (content && !projname) {
      throw new Error("projname not found");
    }
    if (!content) {
      //支持少一个参数绝对值路径模式
      if (projname.indexOf("\\") >= 0 || projname.indexOf("/") >= 0) {
        abspath = projname;
      } else {
        abspath = require("path").join(PROJ_BASE, projname);
      }
      content = path;
    } else {
      abspath = require("path").join(PROJ_BASE, projname, path);
    }
    const dirname = require("path").dirname(abspath);
    if (!require("fs").existsSync(dirname)) {
      require("fs").mkdirSync(dirname, { recursive: true });
    }
    if (content.constructor.name == "ArrayBuffer") {
      content = Buffer.from(content);
      require("fs").writeFileSync(abspath, content);
    } else if (content[0] && content[0].constructor.name == "ArrayBuffer") {
      const writeStream = require("fs").createWriteStream(abspath);
      content.forEach((buffer) => {
        writeStream.write(Buffer.from(buffer));
      });
      writeStream.end();
    } else {
      content = JSON.stringify(content);
      require("fs").writeFileSync(abspath, content);
    }
  },
  readfile(_, proj, path) {
    let realpath;
    if (!path && proj.startsWith("/")) {
      realpath = proj;
    } else {
      realpath = require("path").join(PROJ_BASE, proj);
      if (path) {
        realpath = require("path").join(realpath, path);
      }
    }
    if (require("fs").existsSync(realpath)) {
      return require("fs").readFileSync(realpath);
    }
    return null;
  },
  async listProjects() {
    if (!require("fs").existsSync(PROJ_BASE)) {
      require("fs").mkdirSync(PROJ_BASE);
    }
    const projs = [];
    require("fs")
      .readdirSync(PROJ_BASE)
      .forEach((file) => {
        const projPath = require("path").join(PROJ_BASE, file, "proj.json");
        if (require("fs").existsSync(projPath)) {
          const proj = JSON.parse(
            require("fs").readFileSync(projPath).toString()
          );
          projs.push({
            ...proj,
            id: file,
            cfg: proj.cfg || {},
          });
        }
      });
    return projs;
  },
  async deleteProject(_, id) {
    const projBase = require("path").join(PROJ_BASE, id);
    await shell.trashItem(projBase);
  },
  async loadTrack(_, projname, path) {
    if (!require("fs").existsSync(path)) {
      throw new Error("not exists!");
    }
    const buff = require("fs").readFileSync(path);
    const hash = createHash("md5").update(buff).digest("hex");
    const trackPath = require("path").join(PROJ_BASE, projname, "tracks", hash);
    const dirname = require("path").dirname(trackPath);
    if (!require("fs").existsSync(dirname)) {
      require("fs").mkdirSync(dirname, { recursive: true });
    }
    require("fs").cpSync(path, trackPath);
    return {
      path: require("path").join("tracks", hash),
      buffer: require("fs").readFileSync(trackPath),
    };
  },
  async saveDialog(event, options) {
    return dialog.showSaveDialogSync(
      BrowserWindow.fromWebContents(event.sender),
      options
    );
  },
  recognition(event, proj, buffer) {
    const tmppath = require("path").join(
      PROJ_BASE,
      proj,
      "__recognition__.wav"
    );
    require("fs").writeFileSync(tmppath, Buffer.from(buffer));
    const { spawn } = require("node:child_process");
    let appRoot = RESOURCE_ROOT;
    if (RESOURCE_ROOT.endsWith("app.asar")) {
      appRoot += ".unpacked";
    }
    const python = require("path").join(
      appRoot,
      "whisper",
      process.platform === "win32" ? "work.exe" : "work/work"
    );
    let model = require("path").join(appRoot, "whisper", "models", "base");
    model = model.replace(/\\/g, "/");
    const target = tmppath;
    const cp = spawn(python, [model, target], {
      env: {
        OMP_NUM_THREADS: Math.max(1, require("os").cpus.length - 1),
      },
    });
    let result = "";
    return new Promise((resolve) => {
      cp.stdout.on("data", (data) => {
        result += `${data}`;
      });
      cp.stderr.on("data", (data) => {
        const lines = `${data}`.split("\n");
        for (let line of lines) {
          if (!line.trim()) continue;
          try {
            const p = JSON.parse(line);
            event.sender.send("recognition-progress", p);
          } catch (err) {
            console.log(err, line);
          }
        }
      });
      cp.on("close", (code) => {
        const lines = result.split("\n");
        for (let l of lines) {
          try {
            resolve(JSON.parse(l));
            return;
          } catch (err) {
            console.log(result);
          }
        }
        resolve();
      });
    });
  },
};

export default api;
