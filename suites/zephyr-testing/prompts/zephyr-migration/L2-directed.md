Update dependencies across the workspace.

Constraints and goals:
- Respect the existing package manager and workspace setup.
- Keep Nx build tooling pinned to its current minor unless a migration is run.
- Align companion packages (node ↔ @types/node, react ↔ @types/react).
- Replace deprecated packages when there is a maintained successor.
- After changes: install, run tests, lint, and typecheck. Do not worsen baseline failures.

If major upgrades are required, ask before proceeding.
