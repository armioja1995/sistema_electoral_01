import type { Config } from "tailwindcss";

// Paleta institucional sobria: tinta azul-pizarra sobre papel frío.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#1B2A3A", soft: "#44536A", muted: "#6B7788" },
        paper: { DEFAULT: "#F3F5F7", raised: "#FFFFFF", sunken: "#E9EDF1" },
        line: { DEFAULT: "#D6DCE3", strong: "#B7C1CC" },
        brand: { DEFAULT: "#1F4E79", dark: "#163A5B", soft: "#E3ECF5" },
        danger: { DEFAULT: "#B42318", soft: "#FDECEA" },
        ok: { DEFAULT: "#15803D", soft: "#E7F5EC" },
      },
      borderRadius: { md: "6px", lg: "8px" },
    },
  },
  plugins: [],
};
export default config;
