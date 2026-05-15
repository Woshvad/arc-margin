/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        roast: "var(--roast)",
        gold: "var(--gold)",
        cream: "var(--cream)",
      },
    },
  },
  plugins: [],
};
