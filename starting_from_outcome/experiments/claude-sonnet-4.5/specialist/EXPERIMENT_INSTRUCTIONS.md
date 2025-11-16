# Specialist LLM Experiment Instructions

## Objective

Test Claude Sonnet 4.5's ability to generate a shadcn project with Vite and button component **WITH** the shadcn specialist template. This evaluates whether outcome-driven persona creation improves LLM performance.

## Experiment Setup

**Model**: `anthropic/claude-sonnet-4.5`
**Date**: 2025-11-11
**Experiment Type**: Specialist (With specialist template)
**Location**: `personas/starting_from_outcome/experiments/claude-sonnet-4.5/specialist/`
**Specialist Template**: `personas/starting_from_outcome/shadcn-specialist.json5`

---

## Procedure

### Step 1: Start Fresh Session

Start a completely fresh conversation with Claude Sonnet 4.5.

### Step 2: Load Specialist Template

Load the shadcn specialist agent snapshot and provide the appropriate `spawnerPrompt` as system context or initial prompt. The specialist template contains comprehensive knowledge about shadcn/ui setup, best practices, and common patterns.

**Specialist Template Location**:
`personas/starting_from_outcome/shadcn-specialist.json5`

**Prompt to Use**: Extract the `prompts.model_specific["claude-sonnet-4.5"].spawnerPrompt` from the JSON5 file and provide it as the initial system context/instruction before the user prompt.

### Step 3: Provide Starting Prompt

After loading the specialist template, provide the same starting prompt used in the generic experiment:

```
Generate a new shadcn project, use vite and add the button component
```

### Step 4: Document Everything

As the LLM works, document:

1. **Conversation Log**: Save the complete conversation transcript
2. **Commands Run**: List every command the LLM executes
3. **Files Generated**: Capture all files created/modified
4. **Decisions Made**: Note what choices the LLM makes
5. **Template Usage**: How did the specialist template influence decisions?
6. **Errors Encountered**: Document any errors and how they were resolved
7. **Time to Completion**: How long did the entire process take?

### Step 5: Capture Final State

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

### Specialist Template Impact

Analyze how the specialist template influenced the outcome:

1. **Improvements over generic**
   - Which criteria did specialist pass that generic failed?
   - Were errors avoided that occurred in generic?
   - Was the process more efficient?

2. **Template utilization**
   - Which sections of the template were most useful?
   - Were any template instructions ignored or misunderstood?
   - Did the template introduce any new issues?

3. **Accuracy to documentation**
   - Did specialist follow official docs more closely?
   - Were best practices applied?
   - Were version constraints respected?

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

Use ze-benchmarks to generate scores comparing:

1. **Specialist vs Control** - How close is specialist to the ground truth?
2. **Specialist vs Generic** - How much did the specialist template improve results?

Calculate scores for:
1. **Configuration accuracy** (vite, tailwind, typescript configs)
2. **File structure** (correct paths and organization)
3. **Build success** (does it build without errors?)
4. **Functional completeness** (all required components present?)
5. **Best practices adherence** (follows official recommendations?)

---

## Comparative Analysis

### Generic vs Specialist Comparison

Create a detailed comparison matrix:

| Criterion | Generic Result | Specialist Result | Improvement |
|-----------|---------------|-------------------|-------------|
| Bundler config | ✅/⚠️/❌ | ✅/⚠️/❌ | +/=/- |
| Package versions | ✅/⚠️/❌ | ✅/⚠️/❌ | +/=/- |
| TypeScript config | ✅/⚠️/❌ | ✅/⚠️/❌ | +/=/- |
| ... | ... | ... | ... |

### Key Findings

Document:

1. **What did specialist do better?**
   - Specific improvements over generic
   - Errors avoided
   - Better alignment with control

2. **What was the same?**
   - Areas where specialist didn't improve
   - Both got right or wrong

3. **Unexpected results**
   - Did specialist introduce new issues?
   - Were there surprising improvements?

4. **Template gaps**
   - What knowledge was missing from the template?
   - Which instructions could be clearer?
   - What should be added for next iteration?

---

## Notes Section

### Specialist Template Effectiveness

Document observations about the template itself:
- Was it comprehensive enough?
- Were instructions clear and actionable?
- Did it contain the right level of detail?
- Were there any conflicting instructions?

### Recommendations for Iteration

Based on results, suggest improvements to the specialist template:
- What knowledge should be added?
- Which sections need clarification?
- Are there redundant sections?
- Should organization be improved?

---

## Deliverables

1. **CONVERSATION_LOG.md** - Complete transcript
2. **ANALYSIS.md** - Detailed analysis of results vs control
3. **SPECIALIST_VS_GENERIC.md** - Comparative analysis
4. **SCORES.md** - Ze-benchmark scores and metrics
5. All generated project files in this directory
6. **TEMPLATE_EVALUATION.md** - Assessment of specialist template effectiveness
7. **RECOMMENDATIONS.md** - Suggestions for template improvement

---

## Control Reference

Control implementation location:
`personas/starting_from_outcome/control/`

Control documentation:
`personas/starting_from_outcome/control/CONTROL_SETUP_DOCUMENTATION.md`

Generic experiment results:
`personas/starting_from_outcome/experiments/claude-sonnet-4.5/generic/`

---

## Next Steps After Completion

Once this specialist experiment is complete:

1. Complete scoring with ze-benchmarks for both comparisons
2. Document all findings in analysis files
3. Create comprehensive comparison of generic vs specialist
4. Evaluate specialist template effectiveness
5. Identify gaps and improvements for template iteration
6. Decide on next steps: template refinement, additional models, or new scenarios

---

## Success Indicators

The specialist approach is successful if:

1. **Higher ze-benchmark scores** vs generic
2. **More criteria passing** vs generic
3. **Fewer errors** during execution
4. **Closer alignment** with control implementation
5. **Better adherence** to official documentation
6. **More efficient** process (fewer iterations to success)

---

## Important Reminders

- ✅ **Load specialist template** - This is what differentiates from generic
- ❗ **Same starting prompt** - Must be identical to generic for fair comparison
- ❗ **Document template usage** - Note how the LLM leverages the template
- ❗ **Compare functionally** - Focus on functional equivalence
- ❗ **Identify gaps** - Use results to improve the template
- ❗ **Be objective** - Record actual results, not desired outcomes

---

## Validation Questions

After completion, answer:

1. **Did the specialist template improve results?** Yes/No/Partially
2. **By how much?** Quantify with ze-benchmark delta
3. **Was the improvement significant?** Is it worth the additional context?
4. **Is outcome-driven persona creation effective?** Does this approach work?
5. **What's the ROI?** Template creation cost vs improvement gained
6. **Should we iterate?** Is refinement likely to yield better results?

---

This experiment validates the outcome-driven persona approach. Good data here will inform whether this methodology should be applied to other specialist domains.
