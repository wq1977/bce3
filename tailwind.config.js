/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{vue,css}"],
  theme: {
    extend: {
      animation: {
        flow: "flow 2s linear infinite",
      },
    },
  },
  plugins: [],
};
