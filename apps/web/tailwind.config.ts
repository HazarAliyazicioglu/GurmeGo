import type { Config } from "tailwindcss";
import { PRIMITIVE_COLORS, SEMANTIC_COLORS } from "./src/lib/colors";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ...PRIMITIVE_COLORS, ...SEMANTIC_COLORS },
      fontFamily: {
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
