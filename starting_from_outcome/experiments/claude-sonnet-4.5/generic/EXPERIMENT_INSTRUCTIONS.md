# Generic LLM Experiment Instructions

## Objective

Test Claude Sonnet 4.5's ability to generate a shadcn project with Vite and button component **WITHOUT** any specialist knowledge or template. This establishes a baseline for comparison against the specialist approach.

## Experiment Setup

**Model**: `anthropic/claude-sonnet-4.5`
**Date**: 2025-11-11
**Experiment Type**: Generic (No specialist template)
**Location**: `personas/starting_from_outcome/experiments/claude-sonnet-4.5/generic/`

---

## Procedure

### Step 1: Start Fresh Session

Start a completely fresh conversation with Claude Sonnet 4.5. Do not provide any additional context, instructions, or hints beyond the starting prompt.

**IMPORTANT**:
- No specialist template
- No documentation links
- No hints about versions or configuration
- Let the LLM use only its base training knowledge

### Step 2: Provide Starting Prompt

Provide **ONLY** this prompt:

```
Generate a new shadcn project, use vite and add the button component
```

### Step 3: Document Everything

As the LLM works, document:

1. **Conversation Log**: Save the complete conversation transcript
2. **Commands Run**: List every command the LLM executes
3. **Files Generated**: Capture all files created/modified
4. **Decisions Made**: Note what choices the LLM makes (package manager, versions, etc.)
5. **Errors Encountered**: Document any errors and how they were resolved
6. **Time to Completion**: How long did the entire process take?

### Step 4: Capture Final State

Once the LLM indicates completion:

1. **Save all generated files** to this directory
2. **Run `pnpm build`** and capture output
3. **Check versions** in package.json
4. **Take screenshots** of any relevant UI or output

---

## Success Criteria Checklist

Compare the generated project against the control implementation:

### ✓ Bundler
- [ ] Vite is used as the bundler
- [ ] Vite version matches control (v7.2.2 or compatible)
- [ ] `vite.config.ts` has tailwindcss plugin configured
- [ ] `vite.config.ts` has path resolve alias configured

### ✓ Package Manager
- [ ] Correct package manager used (pnpm preferred)
- [ ] `tailwindcss` version matches control (v4.1.17 or compatible)
- [ ] `@tailwindcss/vite` version matches control (v4.1.17 or compatible)

### ✓ Styles
- [ ] `src/index.css` is configured correctly
- [ ] Tailwind CSS is imported properly
- [ ] CSS variables are set up (if using cssVariables mode)

### ✓ Types
- [ ] `tsconfig.json` has appropriate compilerOptions
- [ ] `tsconfig.app.json` has appropriate compilerOptions
- [ ] Path aliases (`@/*`) are configured in both files
- [ ] `@types/node` is installed

### ✓ Components
- [ ] `pnpm dlx shadcn@latest add button` was run (or equivalent)
- [ ] Button component exists at `src/components/ui/button.tsx`
- [ ] `components.json` configuration file exists
- [ ] `src/lib/utils.ts` utility file exists

### ✓ Build
- [ ] Project builds successfully with `pnpm build`
- [ ] No TypeScript errors
- [ ] No build warnings (critical ones)

---

## Comparison Metrics

### Functional Equivalence

For each criterion above, rate as:
- **✅ PASS**: Functionally equivalent to control
- **⚠️ PARTIAL**: Works but differs from control
- **❌ FAIL**: Missing or broken

### Detailed Analysis

Document:

1. **What was done correctly?**
   - Which steps matched the control implementation?
   - Were any best practices followed?

2. **What was done differently?**
   - Did the LLM make different but valid choices?
   - Were there alternative approaches that still work?

3. **What was incorrect or missing?**
   - Which steps were skipped?
   - Which configurations were wrong?
   - What errors occurred?

4. **Recovery capability**
   - Did the LLM self-correct errors?
   - Were errors fatal or recoverable?

---

## Files to Collect

Save these files for comparison:

### Configuration Files
- [ ] `package.json`
- [ ] `vite.config.ts`
- [ ] `tsconfig.json`
- [ ] `tsconfig.app.json`
- [ ] `components.json`

### Source Files
- [ ] `src/index.css`
- [ ] `src/main.tsx`
- [ ] `src/App.tsx`
- [ ] `src/lib/utils.ts`
- [ ] `src/components/ui/button.tsx`

### Output
- [ ] Build output (success or error messages)
- [ ] Complete conversation transcript
- [ ] Screenshots (if applicable)

---

## Scoring

Use ze-benchmarks to generate a score comparing this output to the control implementation.

Calculate scores for:
1. **Configuration accuracy** (vite, tailwind, typescript configs)
2. **File structure** (correct paths and organization)
3. **Build success** (does it build without errors?)
4. **Functional completeness** (all required components present?)

---

## Notes Section

### Observations

Document any interesting observations:
- Did the LLM follow official documentation?
- Were there any creative solutions?
- Did it make assumptions (correct or incorrect)?
- What knowledge seemed to be missing?

### Unexpected Behavior

Note anything surprising:
- Wrong versions?
- Missing steps?
- Unusual error patterns?
- Configuration choices that differ from docs?

---

## Deliverables

1. **CONVERSATION_LOG.md** - Complete transcript
2. **ANALYSIS.md** - Detailed analysis of results vs control
3. **SCORES.md** - Ze-benchmark scores and metrics
4. All generated project files in this directory
5. **COMPARISON_MATRIX.md** - Side-by-side comparison with control

---

## Control Reference

Control implementation location:
`personas/starting_from_outcome/control/`

Control documentation:
`personas/starting_from_outcome/control/CONTROL_SETUP_DOCUMENTATION.md`

Refer to these for the ground truth comparison.

---

## Next Steps After Completion

Once this generic experiment is complete:

1. Complete scoring with ze-benchmarks
2. Document all findings in ANALYSIS.md
3. Move to specialist experiment (task 60.4)
4. Compare generic vs specialist results
5. Identify gaps for specialist template improvement

---

## Important Reminders

- ❗ **NO hints or guidance** - Let the LLM work independently
- ❗ **Document everything** - Even failed attempts are valuable data
- ❗ **Don't intervene** - Let the LLM recover from errors naturally
- ❗ **Compare functionally** - Focus on functional equivalence, not exact matches
- ❗ **Be objective** - Record what happened, not what you wanted to happen

---

Good luck with the experiment! This baseline data is critical for validating the specialist approach.
