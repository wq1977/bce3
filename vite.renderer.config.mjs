import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Component from "unplugin-vue-components/vite";
import RadixVueResolver from "radix-vue/resolver";
// https://vitejs.dev/config
export default defineConfig({
  define: {
    "import.meta.vitest": "undefined",
  },
  plugins: [
    vue(),
    Component({
      dts: true,
      resolvers: [RadixVueResolver()],
    }),
  ],
});
