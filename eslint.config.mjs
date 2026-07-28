import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /*
     * Keep legacy quality debt visible without making beta release checks fail.
     * New code should still avoid these patterns, and the warnings can be
     * reduced incrementally without risky, release-wide behavioral rewrites.
     */
    plugins: {
      react: reactPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Historical release bundles are not part of the root application.
    "Trading Docks Active/**",
    "Trading-Docks-v79/**",
    "Trading-Docks-Settings-Center-v61/**",
    "Trading-Docks-Landing-Pricing-v56/**",
    "feedback-package/**",
    "feedback-visibility-v65/**",
    "plan_preview_nav_release/**",
  ]),
]);

export default eslintConfig;
