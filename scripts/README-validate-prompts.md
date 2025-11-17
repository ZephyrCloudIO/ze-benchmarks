# Prompt Validation Tool

## Overview

The prompt validation tool (`validate-prompts.ts`) verifies that specialist prompts contain the expected template content. This is useful for:

- Ensuring specialist templates are being properly applied
- Debugging prompt generation issues
- Validating that specialist-specific content is present in agent prompts

## Usage

### Validate from batch ID

```bash
pnpm validate:prompts <batch-id> <template-path>
```

Example:
```bash
pnpm validate:prompts abc123 starting_from_outcome/shadcn-specialist.json5
```

### Validate from exported prompts file

```bash
pnpm validate:prompts --prompts-file <prompts-json> <template-path>
```

Example:
```bash
# First export prompts
pnpm export:prompts abc123 batch-prompts.json

# Then validate
pnpm validate:prompts --prompts-file batch-prompts.json starting_from_outcome/shadcn-specialist.json5
```

## What it validates

The tool checks that specialist prompts contain:

1. **Purpose** - Content from `template.persona.purpose`
2. **Values** - Content from `template.persona.values` (expects >50% match)
3. **Attributes** - Content from `template.persona.attributes` (tracked but not required)
4. **Spawner Prompt** - Content from `template.prompts.model_specific[].spawnerPrompt` or `template.prompts.default.spawnerPrompt`

## Exit codes

- `0` - All specialist prompts passed validation
- `1` - One or more specialist prompts failed validation, or an error occurred

## Output

The tool provides:

- Overall pass/fail statistics
- Findings summary (how many runs found each type of content)
- Detailed failure information (which content is missing)
- Success summary (what content was found in passing runs)

### Example output

```
🔍 Validating specialist prompts

Database: /path/to/benchmarks.db
Batch ID: abc123

✓ Found batch: 4 runs
✓ Loaded 4 runs from database

Template: /path/to/shadcn-specialist.json5
✓ Loaded template: shadcn/ui Expert v0.0.1

Validating 2 specialist runs...

Validation Results:

Overall:
  Total specialist runs: 2
  Passed: 2
  Failed: 0

Findings Summary:
  Purpose found: 2/2 runs
  Values found: 7.0/8 avg per run
  Attributes found: 5.5/7 avg per run
  Spawner prompt found: 2/2 runs

Passed Runs:

✓ Run run_abc123_001 (claude-sonnet-4.5)
  Specialist: @zephyr-cloud/shadcn-specialist
  Found: Purpose=true, Values=7/8, Spawner=true
✓ Run run_abc123_002 (claude-sonnet-4.5)
  Specialist: @zephyr-cloud/shadcn-specialist
  Found: Purpose=true, Values=7/8, Spawner=true

✨ All specialist prompts validated successfully!
```

## Template format

The tool expects specialist templates to follow this structure:

```json5
{
  "name": "specialist-name",
  "displayName": "Specialist Display Name",
  "version": "0.0.1",
  "persona": {
    "purpose": "Expert specialist for...",
    "values": [
      "Value 1",
      "Value 2"
    ],
    "attributes": [
      "Attribute 1",
      "Attribute 2"
    ]
  },
  "prompts": {
    "default": {
      "spawnerPrompt": "Default spawner prompt..."
    },
    "model_specific": {
      "claude-sonnet-4.5": {
        "spawnerPrompt": "Model-specific spawner prompt..."
      }
    }
  }
}
```

## Notes

- Only validates runs that have a specialist configured
- Skips validation if no specialist runs are found in the batch
- Supports both JSON and JSON5 template files
- Can read prompts directly from the database or from exported JSON files
- Uses fuzzy matching for spawner prompts (checks for substantial portions of the prompt)
