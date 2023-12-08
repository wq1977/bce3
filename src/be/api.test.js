const { it, vi, describe, expect } = import.meta.vitest;
import api from "./api";
it("render rss", () => {
  const str = api.renderRSS(null, {
    id: "123",
    name: "四十不惑",
    hostname: "ssbh.wqiang.fun",
    desc: "**1**",
    episodes: [
      {
        id: "222",
        title: "第一期",
        updateat: 1000,
        duration: 100,
        bytes: 13000,
      },
    ],
  });
});
