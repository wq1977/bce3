import { defineStore } from "pinia";

export const useRuntimeStore = defineStore("runtime", {
  state: () => ({}),
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
