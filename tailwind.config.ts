import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#080810",
        panel: "#0d0d1a",
        "panel-light": "#121220",
        border: "#1e1e35",
        "border-light": "#2a2a45",
        accent: "#6c5ce7",
        "accent-hover": "#7c6cf7",
        "accent-soft": "rgba(108, 92, 231, 0.15)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(ellipse at top, #1a1040 0%, #080810 60%)",
        "gradient-accent": "linear-gradient(135deg, #6c5ce7, #a78bfa)",
      },
    },
  },
  plugins: [],
};

export default config;
