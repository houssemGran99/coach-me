import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "public/sw.js", "next-env.d.ts"],
  },
  {
    rules: {
      // No browser dialogs: build in-page confirmations instead.
      "no-alert": "error",
      "no-restricted-globals": ["error", "confirm", "prompt", "alert"],
    },
  },
];

export default config;
