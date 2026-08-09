import type { Config } from "tailwindcss";
import adminUiPreset from "../../packages/admin-ui/tailwind-preset.cjs";

const config: Config = {
  presets: [adminUiPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/admin-ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
