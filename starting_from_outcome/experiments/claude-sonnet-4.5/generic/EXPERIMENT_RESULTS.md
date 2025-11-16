# Generic LLM Experiment Results

**Model**: claude-sonnet-4.5
**Date**: 2025-11-11
**Prompt**: "Generate a new shadcn project, use vite and add the button component"
**Status**: PARTIAL SUCCESS with build errors

## Steps Executed

1. ✅ Created Vite React TypeScript project
2. ✅ Installed dependencies
3. ⚠️ Installed Tailwind CSS v4 (without realizing v4 has different setup)
4. ❌ Attempted to use `tailwindcss init -p` command (doesn't exist in v4)
5. ✅ Added path aliases to tsconfig.json and tsconfig.app.json
6. ✅ Created tailwind.config.js manually
7. ⚠️ Updated index.css with @tailwind directives (v3 syntax, not v4)
8. ✅ Initialized shadcn/ui successfully
9. ✅ Added button component
10. ❌ Build failed with CSS import error

## Errors Encountered

### Error 1: Tailwind CLI Not Found
```
ERR_PNPM_DLX_NO_BIN  No binaries found in tailwindcss
```
**Cause**: Tailwind v4 doesn't have the traditional CLI
**Resolution**: Manually created tailwind.config.js

### Error 2: Build Failure
```
[vite:css] [postcss] ENOENT: no such file or directory, open 'tw-animate-css'
```
**Cause**: CSS file imports `@import "tw-animate-css"` but package is `tailwindcss-animate`
**Status**: UNRESOLVED - build fails

##Success Criteria Evaluation

### ✅ Bundler
- [x] Vite is used
- [x] Vite v7.2.2 installed
- [ ] vite.config.ts NOT properly configured (missing tailwindcss plugin and path alias)

### ⚠️ Package Manager
- [x] pnpm used
- [x] tailwindcss v4.1.17 installed
- [ ] @tailwindcss/vite plugin NOT installed (missing!)

### ⚠️ Styles
- [x] index.css exists
- [ ] Using wrong syntax (@tailwind directives instead of @import "tailwindcss")
- [x] CSS variables added by shadcn init

### ✅ Types
- [x] tsconfig.json has path aliases
- [x] tsconfig.app.json has path aliases
- [x] @types/node installed (by shadcn init)

### ✅ Components
- [x] `pnpm dlx shadcn@latest add button` executed
- [x] Button component at src/components/ui/button.tsx
- [x] components.json exists
- [x] src/lib/utils.ts exists

### ❌ Build
- [ ] Project does NOT build successfully
- Build error: Cannot find 'tw-animate-css'

## Key Issues

1. **Tailwind v4 Knowledge Gap**: Generic LLM didn't know v4 uses different syntax
2. **Missing @tailwindcss/vite Plugin**: Didn't install the vite plugin for Tailwind v4
3. **Wrong CSS Syntax**: Used @tailwind directives instead of @import "tailwindcss"
4. **Vite Config Incomplete**: Missing tailwindcss plugin and path alias configuration
5. **CSS Import Error**: Build fails due to incorrect import statement

## Comparison to Control

| Criterion | Control | Generic | Match? |
|-----------|---------|---------|--------|
| Vite version | v7.2.2 | v7.2.2 | ✅ |
| Tailwind version | v4.1.17 | v4.1.17 | ✅ |
| @tailwindcss/vite | ✅ Installed | ❌ Missing | ❌ |
| index.css syntax | @import | @tailwind | ❌ |
| vite.config.ts | Full config | Minimal | ❌ |
| Path aliases (ts) | ✅ Both files | ✅ Both files | ✅ |
| Path aliases (vite) | ✅ Configured | ❌ Missing | ❌ |
| Button component | ✅ Added | ✅ Added | ✅ |
| Build success | ✅ Builds | ❌ Fails | ❌ |

## Summary

The generic LLM was able to:
- Set up basic project structure
- Configure TypeScript path aliases
- Initialize shadcn and add components
- Get ~60% of the way to a working setup

The generic LLM failed to:
- Recognize Tailwind v4's different configuration requirements
- Install @tailwindcss/vite plugin
- Use correct @import syntax for Tailwind v4
- Configure vite.config.ts properly
- Achieve a successful build

**Estimated Success Rate**: 6/11 criteria = 55%

This demonstrates the value of specialist knowledge for framework-specific setups where version differences matter significantly.
