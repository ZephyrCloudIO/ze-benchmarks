# Control Implementation

## Purpose

This directory contains the **ground truth** reference implementation created by manually following the official shadcn/ui Vite documentation exactly. It serves as the "correct answer" against which we measure both generic and specialist LLM approaches.

## Creation Process

**Date**: November 11, 2025
**Documentation Source**: https://ui.shadcn.com/docs/installation/vite
**Package Manager**: pnpm (as recommended)

### Steps Followed

1. Created Vite React TypeScript project:
   ```bash
   pnpm create vite@latest . --template react-ts
   pnpm install
   ```

2. Installed Tailwind CSS v4:
   ```bash
   pnpm add tailwindcss @tailwindcss/vite
   ```

3. Replaced `src/index.css` with:
   ```css
   @import "tailwindcss";
   ```

4. Added path aliases to both `tsconfig.json` and `tsconfig.app.json`:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

5. Installed Node types:
   ```bash
   pnpm add -D @types/node
   ```

6. Updated `vite.config.ts`:
   ```typescript
   import path from "path"
   import tailwindcss from "@tailwindcss/vite"
   import react from "@vitejs/plugin-react"
   import { defineConfig } from "vite"

   export default defineConfig({
     plugins: [react(), tailwindcss()],
     resolve: {
       alias: {
         "@": path.resolve(__dirname, "./src"),
       },
     },
   })
   ```

7. Initialized shadcn/ui:
   ```bash
   pnpm dlx shadcn@latest init
   # Selected: Neutral base color
   ```

8. Added button component:
   ```bash
   pnpm dlx shadcn@latest add button
   ```

9. Verified build:
   ```bash
   pnpm build
   # ✓ built in 430ms
   ```

## Key Characteristics

### Versions Used
- **Vite**: v7.2.2
- **React**: v19.2.0
- **Tailwind CSS**: v4.1.17
- **@tailwindcss/vite**: v4.1.17
- **TypeScript**: v5.9.3
- **Node.js**: v18+ (via @types/node v24.10.0)

### Configuration Highlights

**Tailwind v4 Syntax**:
- Uses `@import "tailwindcss"` (not `@tailwind` directives)
- Requires `@tailwindcss/vite` plugin
- No separate `tailwind.config.js` needed for v4

**Path Aliases**:
- Configured in THREE places:
  1. `tsconfig.json` - Base config
  2. `tsconfig.app.json` - App-specific config
  3. `vite.config.ts` - Build tool config

**shadcn/ui Setup**:
- Uses CSS variables approach (`cssVariables: true`)
- Neutral base color palette
- Components copied to `src/components/ui/`
- Utilities in `src/lib/utils.ts`

## Build Output

```bash
> pnpm build

vite v7.2.2 building client environment for production...
transforming...
✓ 32 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/react-CHdo91hT.svg    4.13 kB │ gzip:  2.05 kB
dist/assets/index-DRH2eUZZ.css   16.41 kB │ gzip:  3.77 kB
dist/assets/index-tvqjzOBc.js   194.05 kB │ gzip: 60.96 kB
✓ built in 430ms
```

**Status**: ✅ Builds successfully with zero errors

## Success Criteria

All 20 criteria met:

### Bundler (4/4)
- [x] Vite v7.2.2 used
- [x] tailwindcss plugin in vite.config.ts
- [x] Path alias resolver in vite.config.ts

### Package Manager (3/3)
- [x] pnpm used
- [x] tailwindcss v4.1.17 installed
- [x] @tailwindcss/vite v4.1.17 installed

### Styles (3/3)
- [x] index.css with @import "tailwindcss"
- [x] CSS variables configured
- [x] Dark mode tokens defined

### Types (3/3)
- [x] tsconfig.json path aliases
- [x] tsconfig.app.json path aliases
- [x] @types/node installed

### Components (4/4)
- [x] shadcn init completed
- [x] Button component added
- [x] components.json exists
- [x] src/lib/utils.ts exists

### Build (3/3)
- [x] `pnpm build` succeeds
- [x] Zero TypeScript errors
- [x] Zero build warnings

## Documentation

See `CONTROL_SETUP_DOCUMENTATION.md` for complete details including:
- Exact package versions
- Full configuration file contents
- Step-by-step installation log
- Validation checklist

## Purpose in Experiment

This control implementation serves three critical functions:

1. **Ground Truth**: Defines what "correct" looks like
2. **Comparison Baseline**: Both generic and specialist are measured against this
3. **Objective Standard**: Removes subjective judgment from evaluation

By creating the control manually following official docs, we ensure:
- No LLM bias in what's considered "correct"
- Reproducible reference implementation
- Clear success/failure criteria
- Confidence in comparison results

## Notes

- This was created by a human following official documentation
- No LLM assistance was used for the control
- Represents the expected outcome when following docs perfectly
- Intentionally kept simple (no extra features beyond task requirements)
- Focus is on correct setup, not on building a full application

## Replication

To replicate this control:
1. Visit https://ui.shadcn.com/docs/installation/vite
2. Follow each step exactly as documented
3. Use pnpm as package manager
4. Select Neutral color when prompted
5. Add button component as specified
6. Verify build succeeds

The result should match this control implementation exactly in terms of configuration, dependencies, and build success.
