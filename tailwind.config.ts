import type { Config } from "tailwindcss"

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "Segoe UI", "Inter", "sans-serif"],
      },
      colors: { brand: { 500: "#8A7CFF", 600: "#6E61FF", 700: "#5A4DF5" } },
      boxShadow: { glow: "0 0 40px rgba(138,124,255,0.35)" },
      backgroundImage: {
        "radial-dark":
          "radial-gradient(1200px 600px at 50% 20%, rgba(138,124,255,0.25), rgba(0,0,0,0))"
      }
    },
  },
  plugins: [],
} satisfies Config