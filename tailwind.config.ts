import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./features/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#05070b",
        panel: "#10141d",
        line: "#232a36",
        accent: "#05c46b",
        mint: "#31d0aa",
        danger: "#ff6b6b"
      },
      boxShadow: {
        wallet: "0 22px 70px rgba(0,0,0,0.38)"
      }
    }
  },
  plugins: []
};

export default config;
