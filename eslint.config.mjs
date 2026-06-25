import next from "eslint-config-next";

// Next.js 16 + ESLint 9 flat config.
// `eslint-config-next` je nativní flat config (zahrnuje core-web-vitals,
// typescript-eslint, react, react-hooks, jsx-a11y a import pluginy).
const eslintConfig = [
  ...next,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "convex/_generated/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
