# Repository Fixture Template Guide

This guide explains how to create repository fixtures for benchmark scenarios. A repository fixture is a complete, self-contained codebase that represents the starting state before an AI agent performs the task.

## Overview

Repository fixtures (`repo-fixture/`) are copied into a temporary workspace directory before each benchmark run. The agent then works within this workspace to complete the task. The fixture should represent a realistic codebase state with intentional issues or outdated configurations that the agent needs to fix.

## Directory Structure

Repository fixtures should be placed in:
```
suites/<suite-name>/scenarios/<scenario-name>/repo-fixture/
```

The system will automatically look for either `repo-fixture/` or `repo/` directories (both are supported).

## Required Files

### 1. package.json (Root)

Every fixture needs a root `package.json` that defines:
- Project metadata
- Dependencies and devDependencies
- Scripts for validation commands
- Package manager configuration

**Example for a simple project:**
```json
{
  "name": "my-project-fixture",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@9.1.0",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^17.0.0",
    "react-dom": "^17.0.0"
  },
  "devDependencies": {
    "@types/react": "^17.0.0",
    "@types/react-dom": "^17.0.0",
    "typescript": "^4.9.0",
    "jest": "^27.0.0"
  }
}
```

**Example for a monorepo (pnpm workspace):**
```json
{
  "name": "monorepo-fixture",
  "private": true,
  "packageManager": "pnpm@9.1.0",
  "devDependencies": {
    "nx": "~20.0.0",
    "typescript": "^5.5.4"
  }
}
```

### 2. Package Manager Lock Files (Optional but Recommended)

Include lock files to ensure reproducible installs:
- `pnpm-lock.yaml` (for pnpm)
- `package-lock.json` (for npm)
- `yarn.lock` (for yarn)

**Note:** Lock files should match the dependency versions in `package.json`. They ensure consistent installs across runs.

### 3. Workspace Configuration (For Monorepos)

For monorepo scenarios, include workspace configuration:

**pnpm-workspace.yaml:**
```yaml
packages:
  - "apps/*"
  - "libs/*"
```

**package.json (workspaces field for npm/yarn):**
```json
{
  "workspaces": ["apps/*", "libs/*"]
}
```

### 4. Application/Workspace Package Files

For monorepos, each workspace package needs its own `package.json`:

**Example: apps/app/package.json**
```json
{
  "name": "@acme/app",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  "devDependencies": {
    "@types/react": "18.2.66",
    "@types/react-dom": "18.2.23"
  }
}
```

## Optional but Recommended Files

### TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Source Code Files

Include minimal but realistic source code that:
- Uses the dependencies that need to be updated
- Has tests that should continue to pass
- Demonstrates the complexity the agent will face

**Example: src/index.ts**
```typescript
import React from 'react';
import { render } from 'react-dom';

function App() {
  return <div>Hello World</div>;
}

render(<App />, document.getElementById('root'));
```

### Test Files

Include test files that verify the codebase works correctly:

**Example: src/index.test.ts**
```typescript
import { describe, it, expect } from 'jest';

describe('App', () => {
  it('should render correctly', () => {
    expect(true).toBe(true);
  });
});
```

### Configuration Files

Include relevant config files your scenario depends on:
- `.eslintrc.json` or `eslint.config.js`
- `jest.config.js` or `vitest.config.ts`
- `.gitignore`
- `README.md` (optional, but helpful for context)

## Best Practices

### 1. Realistic Complexity

Make fixtures realistic but not overly complex:
- ✅ Include real dependency relationships
- ✅ Use actual framework patterns (e.g., React hooks, Next.js structure)
- ✅ Include configuration files that would exist in real projects
- ❌ Avoid unnecessary complexity that doesn't test agent capabilities
- ❌ Don't include large files or binaries

### 2. Intentional Outdated Dependencies

The fixture should have dependencies that need updating:
- Use older versions that should be upgraded
- Include version mismatches (e.g., React 17 with React DOM 18)
- Use deprecated packages that need replacement
- Include security vulnerabilities (for security-focused scenarios)

### 3. Testability

Ensure the fixture can be validated:
- Tests should pass in the baseline state
- Build commands should succeed
- Linting should work (even with warnings)
- Type checking should pass (for TypeScript projects)

### 4. Reproducibility

Make fixtures reproducible:
- Pin dependency versions in lock files
- Use consistent Node.js version requirements
- Document any special setup needed

### 5. Size Considerations

Keep fixtures small and focused:
- Include only files necessary for the task
- Avoid large dependencies or build artifacts
- Don't include `node_modules/` (it will be generated)
- Consider using smaller test frameworks

## Example Repository Fixture Structures

### Simple Single-Package Project

```
repo-fixture/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── src/
│   ├── index.ts
│   └── index.test.ts
└── README.md
```

### Monorepo (pnpm workspaces)

```
repo-fixture/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.json
├── apps/
│   └── app/
│       ├── package.json
│       └── src/
│           └── index.ts
└── libs/
    └── util/
        ├── package.json
        └── src/
            └── index.ts
```

### React Application

```
repo-fixture/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── App.tsx
│   ├── App.test.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
└── public/
    └── favicon.ico
```

## Validation Checklist

Before finalizing your repository fixture, verify:

- [ ] `package.json` is valid JSON
- [ ] All dependencies are intentionally outdated (for update scenarios)
- [ ] Lock files match `package.json` versions
- [ ] Workspace configuration is correct (for monorepos)
- [ ] Baseline commands from `scenario.yaml` work (`baseline.run` commands)
- [ ] Validation commands from `scenario.yaml` would work after updates
- [ ] Source code compiles/transpiles without errors
- [ ] Tests pass in the baseline state
- [ ] No sensitive data (API keys, tokens, etc.)
- [ ] No large files or binaries
- [ ] README explains fixture purpose (optional but helpful)

## Common Pitfalls

### ❌ Missing Lock Files
Lock files ensure consistent installs. Without them, different package manager versions may resolve dependencies differently.

### ❌ Invalid package.json
JSON syntax errors will break the fixture. Always validate JSON before committing.

### ❌ Mismatched Versions
Ensure lock files match `package.json` versions. Run `pnpm install` (or equivalent) in the fixture to regenerate if needed.

### ❌ Circular Dependencies
Workspace packages shouldn't create circular dependencies unless that's what you're testing.

### ❌ Overly Complex Fixtures
Keep fixtures focused on the specific task. Avoid unnecessary files that don't contribute to the test.

### ❌ Including node_modules
Never include `node_modules/` in fixtures. It will be generated during benchmark runs.

## Testing Your Fixture

After creating your fixture, test it locally:

```bash
# Navigate to your fixture
cd suites/<suite>/scenarios/<scenario>/repo-fixture

# Install dependencies
pnpm install  # or npm install, yarn install

# Run baseline commands
pnpm build
pnpm test
pnpm lint

# Verify validation commands would work
# (After simulating the agent's changes)
```

## Integration with scenario.yaml

Your fixture should align with settings in `scenario.yaml`:

- **workspace.manager**: Match the package manager your fixture uses
- **baseline.run**: These commands should succeed with your fixture
- **validation.commands**: These should work after the agent completes the task

Example alignment:

```yaml
# scenario.yaml
workspace:
  manager: pnpm
  workspaces: pnpm

baseline:
  run:
    - cmd: "pnpm install"
    - cmd: "pnpm test"

validation:
  commands:
    install: "pnpm install"
    test: "pnpm test"
    build: "pnpm build"
```

## Next Steps

After creating your repository fixture:

1. **Create prompts**: Write L0, L1, L2 prompt files that describe the task
2. **Write oracle answers**: Define expected responses to agent questions
3. **Test the scenario**: Run `pnpm bench <suite> <scenario> L1 echo` to verify everything works
4. **Iterate**: Refine the fixture based on test results

## Additional Resources

- See existing fixtures in `suites/update-deps/scenarios/nx-pnpm-monorepo/repo-fixture/` for a monorepo example
- Check `docs/ADDING-BENCHMARKS.md` for general benchmark creation guide
- Review `docs/templates/scenario.yaml` for scenario configuration template

