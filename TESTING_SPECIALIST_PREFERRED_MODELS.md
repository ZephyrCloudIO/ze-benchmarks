# Testing Specialist Preferred Models Integration

This guide explains how to test the new auto-detection feature for specialist preferred models.

## Prerequisites

1. Ensure you have API keys set up:
   ```bash
   # For Anthropic (if testing claude models)
   export ANTHROPIC_API_KEY="your-key"
   
   # For OpenRouter (if testing gpt models)
   export OPENROUTER_API_KEY="your-key"
   ```

2. Verify the specialist templates exist:
   ```bash
   ls templates/shadcn-specialist-template.json5
   ls templates/nextjs-specialist-template.json5
   ```

## Available Specialists

- **shadcn-specialist**: For shadcn/ui component setup and configuration
- **nextjs-specialist**: For Next.js App Router development and migrations

## Test Cases

### Test 1: Auto-detect Model and Agent from Specialist

**Expected Behavior:** When you provide a specialist but no agent/model, it should:
- Load the template and find `preferred_models: ["claude-sonnet-4.5", ...]`
- Auto-detect provider as "anthropic" from "claude-sonnet-4.5"
- Auto-detect agent as "anthropic"
- Use the first preferred model

**Command:**
```bash
# Use a simple test scenario
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist
```

**What to Look For:**
- Console output should show:
  ```
  [DEBUG] createAgentAdapter()
    Agent: auto-detect
    Model: auto-detect
    Specialist: shadcn-specialist
    Auto-detecting model and agent from specialist template...
    ℹ️  Using preferred model from template: claude-sonnet-4.5
    ℹ️  Auto-detected agent from model: anthropic (provider: anthropic)
  ```

### Test 2: Explicit Model Override

**Expected Behavior:** When you provide both specialist and explicit model, it should:
- Use the explicit model (not the preferred one)
- Still auto-detect agent from the explicit model

**Command:**
```bash
# Override with a different model
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model gpt-4o
```

**What to Look For:**
- Console output should show:
  ```
  [DEBUG] createAgentAdapter()
    Agent: auto-detect
    Model: gpt-4o
    Specialist: shadcn-specialist
    Auto-detecting model and agent from specialist template...
    ℹ️  Auto-detected agent from model: openrouter (provider: openrouter)
  ```
- Should NOT show "Using preferred model from template" (since model was explicitly provided)

### Test 3: Explicit Agent Override

**Expected Behavior:** When you provide both specialist and explicit agent, it should:
- Use the explicit agent
- Still use preferred model if model not provided

**Command:**
```bash
# Override agent but let model auto-detect
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --agent openrouter
```

**What to Look For:**
- Console output should show:
  ```
  [DEBUG] createAgentAdapter()
    Agent: openrouter
    Model: auto-detect
    Specialist: shadcn-specialist
    Auto-detecting model and agent from specialist template...
    ℹ️  Using preferred model from template: claude-sonnet-4.5
  ```
- Should NOT show "Auto-detected agent" (since agent was explicitly provided)

### Test 4: Both Agent and Model Explicit

**Expected Behavior:** When both are explicitly provided, it should:
- Use both explicit values
- Skip auto-detection entirely

**Command:**
```bash
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --agent anthropic --model claude-sonnet-3.5
```

**What to Look For:**
- Console output should show:
  ```
  [DEBUG] createAgentAdapter()
    Agent: anthropic
    Model: claude-sonnet-3.5
    Specialist: shadcn-specialist
  ```
- Should NOT show any auto-detection messages

### Test 5: Specialist with No Preferred Models

**Expected Behavior:** If a specialist template has no `preferred_models`, it should:
- Warn that no preferred models were found
- Default to a fallback agent (openrouter)

**To Test:** Create a temporary template without preferred_models, or modify the existing one temporarily.

**What to Look For:**
- Console output should show:
  ```
  ⚠️  No preferred models found in template, using default agent
  ⚠️  Could not determine agent, defaulting to openrouter
  ```

### Test 6: Model Name Pattern Matching

**Test different model name formats:**

```bash
# Test Anthropic models
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model claude-sonnet-4.5
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model anthropic/claude-sonnet-4.5

# Test OpenRouter models
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model gpt-4o
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model openai/gpt-4o
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model openrouter/openai/gpt-4o
```

**What to Look For:**
- All should correctly detect the provider and agent
- Anthropic models → `anthropic` agent
- GPT models → `openrouter` agent

### Test 7: Without Specialist (Backward Compatibility)

**Expected Behavior:** Should work exactly as before when no specialist is provided.

**Command:**
```bash
pnpm bench test-suite test-scenario --tier L1 --agent anthropic --model claude-sonnet-4.5
```

**What to Look For:**
- Should work normally
- No auto-detection messages
- Agent defaults to 'echo' if not provided

## Verification Checklist

After running tests, verify:

- [ ] Auto-detection works when specialist provided without agent/model
- [ ] Explicit model overrides preferred model
- [ ] Explicit agent overrides auto-detection
- [ ] Both explicit values skip auto-detection
- [ ] Model name pattern matching works for various formats
- [ ] Backward compatibility maintained (works without specialist)
- [ ] Console logs show correct information
- [ ] Benchmark actually runs and completes

## Debugging Tips

1. **Check template loading:**
   ```bash
   # Verify template path resolution
   cat templates/shadcn-specialist-template.json5 | grep -A 3 "preferred_models"
   ```

2. **Enable verbose logging:**
   - The implementation already includes debug logs
   - Look for `[DEBUG]` prefixed messages

3. **Check agent adapter creation:**
   - Look for messages starting with `[DEBUG] createAgentAdapter()`
   - Verify the final agent/model values used

4. **Test with echo agent first:**
   ```bash
   # Quick test without API calls
   pnpm bench test-suite test-scenario --tier L1 --agent echo
   ```

## Example Test Session

### With shadcn-specialist:
```bash
# 1. Test auto-detection (should use claude-sonnet-4.5 → anthropic)
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist

# 2. Test with explicit model (should use gpt-4o → openrouter)
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --model gpt-4o

# 3. Test with explicit agent (should use preferred model with openrouter)
pnpm bench test-suite test-scenario --tier L1 --specialist shadcn-specialist --agent openrouter
```

### With nextjs-specialist:
```bash
# 1. Test auto-detection with Next.js specialist (should use claude-sonnet-4.5 → anthropic)
pnpm bench next.js 001-server-component --tier L1 --specialist nextjs-specialist

# 2. Test App Router migration scenario
pnpm bench next.js 000-app-router-migration-simple --tier L3 --specialist nextjs-specialist

# 3. Test with explicit model override
pnpm bench next.js 002-client-component --tier L1 --specialist nextjs-specialist --model gpt-4o
```

### Backward compatibility:
```bash
# Test without specialist (should work as before)
pnpm bench test-suite test-scenario --tier L1 --agent anthropic --model claude-sonnet-4.5
```

## Expected Console Output Examples

### Successful Auto-Detection:
```
[DEBUG] createAgentAdapter()
  Agent: auto-detect
  Model: auto-detect
  Specialist: shadcn-specialist
  Workspace root: /path/to/workspace
  Auto-detecting model and agent from specialist template...
  ℹ️  Using preferred model from template: claude-sonnet-4.5
  ℹ️  Auto-detected agent from model: anthropic (provider: anthropic)
  Creating AnthropicAdapter...
  ✓ AnthropicAdapter created
  Resolving specialist template path...
  ℹ️  Using specialist: shadcn-specialist
     Template: /path/to/templates/shadcn-specialist-template.json5
```

### With Explicit Override:
```
[DEBUG] createAgentAdapter()
  Agent: openrouter
  Model: gpt-4o
  Specialist: shadcn-specialist
  Workspace root: /path/to/workspace
  Creating OpenRouterAdapter...
  ✓ OpenRouterAdapter created
```

