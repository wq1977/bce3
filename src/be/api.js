const level = require("classic-level");
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
};

export default api;
