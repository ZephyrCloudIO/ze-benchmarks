# Repository Fixture

This directory contains the starting state of the repository before agent execution.

## What is a Repository Fixture?

A repository fixture is a complete codebase snapshot that represents the initial state of your benchmark scenario. When a benchmark runs, this fixture is copied to a temporary workspace directory where the AI agent will work.

## What Should Go Here?

Your `repo-fixture` directory should contain:

1. **Complete Project Structure**
   - `package.json` (or `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`)
   - Source code files (e.g., `src/`, `lib/`, `app/`)
   - Configuration files (e.g., `tsconfig.json`, `vite.config.ts`, `eslint.config.js`)
   - Test files (if applicable)

2. **Intentional Issues to Test**
   - Outdated dependencies that need updating
   - Missing dependencies
   - Configuration issues
   - Code that needs to be modified according to your scenario
   - Any other intentional problems that the agent should fix

## Example Structure

```
repo-fixture/
├── package.json              # Root package.json with outdated dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Build configuration (if applicable)
├── src/                     # Source files
│   ├── App.tsx
│   ├── index.tsx
│   └── components/
├── tests/                   # Test files (if applicable)
│   └── App.test.tsx
└── README.md               # This file
```

## Best Practices

1. **Keep it Realistic**: Use a structure that mirrors real-world projects
2. **Include Intentional Issues**: The fixture should have problems that the agent needs to solve
3. **Ensure Baseline Works**: The fixture should be able to run baseline commands (install, build, test) without errors
4. **Minimal but Complete**: Include enough to test the scenario, but keep it manageable

## For Monorepos

If your scenario is for a monorepo:

```
repo-fixture/
├── package.json             # Root workspace package.json
├── pnpm-workspace.yaml      # Workspace configuration
├── apps/
│   └── app/
│       └── package.json
└── libs/
    └── util/
        └── package.json
```

## Next Steps

1. Create your `package.json` with the starting dependencies
2. Add source files that demonstrate the task
3. Include configuration files as needed
4. Ensure the baseline commands in `scenario.yaml` can run successfully
5. Test your fixture by manually copying it and running baseline commands

For more information, see:
- `docs/ADDING-BENCHMARKS.md`
- `CONTRIBUTING.md`

