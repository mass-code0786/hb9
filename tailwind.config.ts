import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./features/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#06111f",
        panel: "rgba(11,23,40,0.76)",
        line: "rgba(125,211,252,0.24)",
        accent: "#22d3ee",
        mint: "#7dd3fc",
        danger: "#ff6b6b"
      },
      boxShadow: {
        wallet: "0 0 36px rgba(34,211,238,0.18), 0 24px 80px rgba(14,165,233,0.14), 0 18px 56px rgba(0,0,0,0.42)"
      }
    }
  },
  plugins: []
};

export default config;
