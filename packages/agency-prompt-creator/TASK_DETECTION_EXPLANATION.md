# Task Detection Explanation

## How It Currently Works

The task detection system uses **keyword-based pattern matching** to identify the type of task from a user's prompt.

### Current Flow

1. **Pattern Matching**: Each task type has an array of regex patterns
2. **Priority Order**: Task types are checked in a specific order (project_setup → component_generation → migration → etc.)
3. **First Match Wins**: The first task type that matches returns immediately
4. **Default Fallback**: If no patterns match, returns `'default'`

### Example

```typescript
// User prompt: "Setup a new React project"
detectTaskType("Setup a new React project")
// 1. Normalizes: "setup a new react project"
// 2. Checks 'project_setup' patterns:
//    - /\b(setup|scaffold|initialize|create).*(project|app|application|workspace)\b/i
//    - ✅ Matches! Returns 'project_setup'
```

### Current Limitations

1. **Hardcoded Task Types**: Only 7 predefined task types + 'default'
2. **Fixed Patterns**: Patterns are hardcoded in the source code
3. **No Customization**: Templates can't define their own task types
4. **Priority is Fixed**: Can't change the order of detection

## How to Make It Extensible

### Option 1: Template-Based Task Detection (Recommended)

Allow templates to define their own task types and patterns:

```json5
{
  "name": "shadcn-specialist",
  "task_detection": {
    "patterns": {
      "component_add": [
        "add.*component",
        "install.*component",
        "shadcn.*add"
      ],
      "theme_setup": [
        "setup.*theme",
        "configure.*theme",
        "dark.*mode"
      ],
      "troubleshoot": [
        "fix.*issue",
        "debug.*problem",
        "error.*resolving"
      ]
    },
    "priority": [
      "component_add",
      "theme_setup",
      "troubleshoot"
    ]
  }
}
```

### Option 2: Plugin-Based Detection

Allow registering custom detection functions:

```typescript
registerTaskDetector('custom_task', (prompt) => {
  // Custom detection logic
  return prompt.includes('custom keyword');
});
```

### Option 3: Hybrid Approach

Combine built-in patterns with template-defined patterns:

1. Built-in patterns for common tasks (backward compatible)
2. Template-specific patterns override/extend built-ins
3. Priority can be customized per template

## Implementation Strategy

The best approach is **Option 1 (Template-Based)** because:
- ✅ Templates can define domain-specific tasks
- ✅ No code changes needed for new task types
- ✅ Maintains backward compatibility
- ✅ Works with the existing prompt selection system

