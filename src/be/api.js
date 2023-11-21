const level = require("classic-level");
const { createHash } = require("crypto");
import createLogger from "./log";

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
          });
        }
      });
    return projs;
  },
  async loadTrack(_, projname, path) {
    if (!require("fs").existsSync(path)) {
      throw new Error("not exists!");
    }
    const buff = require("fs").readFileSync(path);
    const hash = createHash("md5").update(buff).digest("hex");
    const trackPath = require("path").join(PROJ_BASE, projname, "tracks", hash);
    if (require("fs").existsSync(trackPath)) {
      throw new Error("dup track");
    }
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
};

export default api;
