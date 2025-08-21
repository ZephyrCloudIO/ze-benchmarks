You're in an Nx monorepo using PNPM. We want to upgrade React 18 → 19 and fix breaking changes.

Do this:
1) Detect & document the current workspace layout.
2) Plan the upgrade: react, react-dom, @types/react, @types/react-dom, testing libs, eslint/react plugins.
3) Use built-in tooling and codemods where applicable (e.g., Nx migrate, react update scripts).
4) Update imports and deprecated APIs; adjust config as needed.
5) Install, then run tests, lint, and typecheck. Fix regressions.

Keep Nx builders pinned unless an official migration covers them. If a package changed namespace, migrate usages.
