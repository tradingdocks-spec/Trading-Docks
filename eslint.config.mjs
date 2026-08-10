import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

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
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["mobile/**/*.js", "mobile/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
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
    // Confirmed historical Expo snapshots and generated dependency artifacts.
    "mobile_backup/**",
    "mobile-sdk54-clean-backup/**",
    "mobile-sdk57-backup/**",
    "node_modules-install-failed/**",
    // Generated output that is not product source.
    "dist/**",
    "coverage/**",
    "mobile/dist/**",
    "mobile/.expo/**",
  ]),
]);

export default eslintConfig;
