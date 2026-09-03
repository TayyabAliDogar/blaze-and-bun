import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F5EFE4",
        "cream-text": "#F7F0E4",
        espresso: "#1C120C",
        "espresso-alt": "#2A1B12",
        orange: "#E8542A",
        "orange-hover": "#FF6A3D",
        gold: "#F2B33D",
        "charcoal-text": "#241B14",
        "muted-text": "#8A7F72",
      },
    },
  },
  plugins: [],
};
export default config;
