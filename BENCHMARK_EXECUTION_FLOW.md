# ze-benchmarks: Complete Execution Flow Documentation

This document explains the complete data flow and execution process in ze-benchmarks, from when a specialist template is added through to when benchmark results are generated and stored.

## Table of Contents

1. [Entry Point: CLI](#entry-point-cli)
2. [Argument Parsing](#argument-parsing)
3. [Specialist Template Discovery](#specialist-template-discovery)
4. [Template Enrichment (Optional)](#template-enrichment-optional)
5. [Benchmark Execution Pipeline](#benchmark-execution-pipeline)
6. [Agent Adapter Creation](#agent-adapter-creation)
7. [Specialist Adapter Prompt Transformation](#specialist-adapter-prompt-transformation)
8. [Tool Loading](#tool-loading)
9. [Agent Execution](#agent-execution)
10. [Validation & Evaluation](#validation--evaluation)
11. [Results Submission](#results-submission)

---

## Entry Point: CLI

**File**: `packages/harness/src/cli.ts`

The execution starts when a user runs `pnpm bench` or uses the interactive CLI.

```typescript
// Line 97: Main entry point
async function run() {
  // Load environment variables from .env file
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const envPath = resolve(workspaceRoot, '.env');
  config({ path: envPath });
  
  // Parse command-line arguments
  const args = parseArgs(process.argv);
  
  // Route to appropriate handler
  if (args.cmd === 'bench') {
    // Execute benchmark...
  }
}
```

**Key Steps:**
1. Finds workspace root by looking for `pnpm-workspace.yaml`
2. Loads `.env` file for API keys and configuration
3. Parses command-line arguments
4. Routes to benchmark execution or other commands

---

## Argument Parsing

**File**: `packages/harness/src/cli/args.ts`

The CLI parses arguments to extract:
- Suite name (e.g., `next.js`)
- Scenario name (e.g., `000-app-router-migration-simple`)
- Tier (e.g., `L0`, `L1`, `L2`)
- Agent type (e.g., `openrouter`, `anthropic`, `echo`)
- Model name (optional)
- **Specialist name** (e.g., `nextjs-specialist`)
- Template enrichment flag (`--enrich-template`)
- Other flags (`--quiet`, `--llm-judge-only`, etc.)

```typescript
// Lines 67-97: Parse benchmark command arguments
const cmd = 'bench';
const suite = args[0];
const scenario = args[1];
const rest = args.slice(2);

const specialistIndex = rest.indexOf('--specialist');
const specialist = specialistIndex !== -1 ? rest[specialistIndex + 1] : undefined;

const enrichTemplateIndex = rest.indexOf('--enrich-template');
const enrichTemplate = enrichTemplateIndex !== -1 ? rest[enrichTemplateIndex + 1] : undefined;
```

**Data Flow:**
- Raw CLI arguments → Parsed arguments object
- Passed to `executeBenchmark()` or `executeMultipleBenchmarks()`

---

## Specialist Template Discovery

**File**: `packages/harness/src/domain/agent.ts`

When a specialist name is provided (e.g., `--specialist nextjs-specialist`), the system resolves it to a template file path.

### Template Path Resolution

```typescript
// Lines 145-166: resolveSpecialistTemplatePath()
export function resolveSpecialistTemplatePath(specialistName: string, workspaceRoot: string): string {
  // Strip namespace prefix if present (e.g., @zephyr-cloud/)
  const templateName = specialistName.replace(/^@[^/]+\//, '');
  
  // Construct template path: templates/{name}-template.json5
  const templatePath = `templates/${templateName}-template.json5`;
  const absolutePath = resolve(workspaceRoot, templatePath);
  
  // Verify template exists
  if (!existsSync(absolutePath)) {
    throw new Error(`Specialist template not found: ${templatePath}`);
  }
  
  return absolutePath;
}
```

**Example:**
- Input: `--specialist nextjs-specialist`
- Resolved: `templates/nextjs-specialist-template.json5`

### Enriched Template Discovery

**File**: `packages/agent-adapters/src/specialist.ts`

Before loading a template, the system checks for enriched versions:

```typescript
// Lines 433-470: getLatestEnrichedTemplatePath()
private static getLatestEnrichedTemplatePath(templatePath: string, version: string): string | null {
  const enrichedDir = SpecialistAdapter.getEnrichedDir(templatePath, version);
  
  // Look for files matching: {specialist-name}.enriched.{number}.json5
  // e.g., nextjs-specialist.enriched.001.json5
  const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);
  
  // Find all enriched files and sort by number (descending)
  const enrichedFiles = files
    .filter(f => filePattern.test(f))
    .map(f => { /* extract number */ })
    .sort((a, b) => b.number - a.number);
  
  // Return the highest numbered file (latest enrichment)
  return join(enrichedDir, enrichedFiles[0].filename);
}
```

**Priority:**
1. If enriched template exists → Use enriched version
2. Otherwise → Use base template

**Naming Convention:**
- Base: `{specialist-name}-template.json5`
- Enriched: `{specialist-name}.enriched.{number}.json5` (e.g., `nextjs-specialist.enriched.001.json5`)

---

## Template Enrichment (Optional)

**File**: `packages/specialist-mint/src/enrich-template.ts`

If `--enrich-template` is provided, enrichment runs **after** all benchmark iterations complete.

### Enrichment Process

```typescript
// Lines 71-198: enrichTemplate()
export async function enrichTemplate(
  templatePath: string,
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  // 1. Load base template
  const template: SpecialistTemplate = loadJSON5(resolvedTemplatePath);
  
  // 2. Extract specialist name from path
  const specialistName = templateBasename.replace(/-template$/, '');
  
  // 3. Generate enriched template path
  const enrichedPath = getEnrichedTemplatePath(resolvedTemplatePath, template.version, specialistName);
  
  // 4. Initialize LLM client (OpenRouter or Anthropic)
  const llmClient = createLLMClient(provider);
  
  // 5. Process each documentation resource
  for (const doc of template.documentation || []) {
    // Fetch documentation content
    const content = await fetchDocumentation(doc);
    
    // Build enrichment prompt
    const prompt = buildEnrichmentPrompt(doc, content, template);
    
    // Call LLM to generate enrichment metadata
    const response = await llmClient.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });
    
    // Parse response and attach to doc
    doc.enrichment = parseEnrichmentResponse(responseContent, model);
  }
  
  // 6. Write enriched template
  writeJSON5(enrichedPath, enrichedTemplate);
}
```

**What Enrichment Does:**
- Analyzes documentation resources in the template
- Uses LLM to extract:
  - Keywords
  - Relevant code snippets
  - Usage examples
  - Technical details
- Stores this metadata in `doc.enrichment` for intelligent injection during prompt creation

**When It Runs:**
- After all benchmark iterations complete
- Only if `--enrich-template` flag is provided
- Can be triggered from CLI or interactive mode

---

## Benchmark Execution Pipeline

**File**: `packages/harness/src/execution/benchmark.ts`

The main orchestration function that runs through all stages:

```typescript
// Lines 54-791: executeBenchmark()
export async function executeBenchmark(
  suite: string,
  scenario: string,
  tier: string,
  agent: string | undefined,
  model?: string,
  batchId?: string,
  quiet?: boolean,
  specialist?: string,
  skipWarmup?: boolean,
  llmJudgeOnly: boolean = true
) {
  // Initialize logger and start run
  const logger = BenchmarkLogger.getInstance();
  const runId = logger.startRun(suite, scenario, tier, agentName, model, batchId);
  
  // Stage 1: Setup
  const scenarioCfg = loadScenario(suite, scenario);
  const promptContent = loadPrompt(suite, scenario, tier);
  
  // Stage 1.5: Warmup (optional)
  if (!skipWarmup) {
    const warmupResult = await executeWarmup(...);
  }
  
  // Stage 2: Workspace Preparation
  const workspacePrep = prepareWorkspaceFromFixture(suite, scenario, getScenarioDir);
  const workspaceDir = workspacePrep.workspaceDir;
  const fixtureDir = workspacePrep.fixtureDir;
  
  // Stage 3: Agent Execution
  const agentAdapter = await createAgentAdapter(agent, model, specialist, workspaceRoot);
  const response = await agentAdapter.send(request);
  
  // Stage 4: Validation
  const commandLog = runValidationCommands(workspaceDir, scenarioCfg.validation?.commands);
  const diffArtifacts = buildDiffArtifacts(fixtureDir, workspaceDir);
  
  // Stage 5: Evaluation
  const { scoreCard, results: evaluatorResults } = await runEvaluators(ctx, llmJudgeOnly);
  
  // Stage 6: Results Submission
  logger.completeRun({ /* full run data */ });
}
```

**Data Structures:**
- `runData`: Run metadata (runId, batchId, suite, scenario, tier, agent, model, startedAt)
- `telemetryData`: Agent telemetry (toolCalls, tokensIn, tokensOut, costUsd, durationMs, workspaceDir, promptSent)
- `evaluationsData`: Array of evaluation results

---

## Agent Adapter Creation

**File**: `packages/harness/src/domain/agent.ts`

### Auto-Detection from Specialist Template

When `specialist` is provided but `agent`/`model` are not, the system auto-detects from the template:

```typescript
// Lines 168-331: createAgentAdapter()
export async function createAgentAdapter(
  agentName?: string,
  model?: string,
  specialistName?: string,
  workspaceRoot?: string
): Promise<AgentAdapter> {
  
  // If specialist provided, auto-detect agent/model from template
  if (specialistName && workspaceRoot && (!model || !agentName)) {
    // 1. Load template
    const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
    const template = await loadTemplate(templatePath, { baseDir: workspaceRoot });
    
    // 2. Select preferred model from template.preferred_models
    if (!model) {
      const preferredModel = selectPreferredModel(template);
      if (preferredModel) {
        finalModel = preferredModel.model; // e.g., "claude-sonnet-4.5"
      }
    }
    
    // 3. Default to openrouter if agent not specified
    if (!agentName) {
      finalAgentName = 'openrouter';
    }
    
    // 4. Find OpenRouter model by name (if using OpenRouter)
    if (finalAgentName === 'openrouter' && finalModel) {
      const openrouterAPI = new OpenRouterAPI(process.env.OPENROUTER_API_KEY || '');
      const availableModels = await openrouterAPI.getModelsWithToolSupport();
      const closestModel = findClosestOpenRouterModel(finalModel, availableModels, openrouterAPI);
      finalModel = closestModel; // e.g., "anthropic/claude-sonnet-4.5"
    }
  }
  
  // 5. Create base adapter
  let baseAdapter: AgentAdapter;
  switch (finalAgentName) {
    case 'openrouter':
      baseAdapter = new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, finalModel);
      break;
    case 'anthropic':
      baseAdapter = new AnthropicAdapter();
      break;
    // ... other adapters
  }
  
  // 6. Wrap with SpecialistAdapter if specialist provided
  if (specialistName && workspaceRoot) {
    const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
    const { SpecialistAdapter } = await import('../../../agent-adapters/src/specialist.ts');
    const specialistAdapter = await SpecialistAdapter.create(baseAdapter, templatePath);
    return specialistAdapter;
  }
  
  return baseAdapter;
}
```

**Data Flow:**
1. Specialist name → Template path resolution
2. Template → Preferred model extraction
3. Preferred model name → OpenRouter model ID lookup (if using OpenRouter)
4. Base adapter creation (OpenRouterAdapter, AnthropicAdapter, etc.)
5. SpecialistAdapter wrapping (if specialist provided)

---

## Specialist Adapter Prompt Transformation

**File**: `packages/agent-adapters/src/specialist.ts`

The `SpecialistAdapter` wraps a base adapter and transforms prompts using a **3-step workflow**.

### Template Loading

```typescript
// Lines 132-200: SpecialistAdapter.create()
static async create(
  underlyingAdapter: AgentAdapter,
  templatePath: string
): Promise<SpecialistAdapter> {
  // 1. Resolve enriched template path (if exists)
  const resolvedPath = SpecialistAdapter.resolveTemplatePathSync(templatePath);
  
  // 2. Load template using agency-prompt-creator (handles inheritance)
  const template = await loadTemplate(resolvedPath, {
    baseDir: process.cwd()
  });
  
  // 3. Initialize LLM client for prompt transformation
  const llmClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1'
  });
  
  // 4. Create SpecialistAdapter instance
  return new SpecialistAdapter(underlyingAdapter, template, templatePath, llmClient);
}
```

### 3-Step Prompt Transformation Workflow

```typescript
// Lines 491-607: send() method
async send(request: AgentRequest): Promise<AgentResponse> {
  // Extract user prompt (NEVER modified)
  const userPrompt = this.extractUserPrompt(request);
  
  // ========================================================================
  // STEP 3a: Extract Intent
  // ========================================================================
  const intent = await this.extractIntentWithLLM(userPrompt);
  // Returns: { intent, primaryGoal, keywords, framework, components, ... }
  
  // ========================================================================
  // STEP 3b: Select Specialist Components
  // ========================================================================
  const selection = await this.selectComponentsWithLLM(userPrompt, intent);
  // Returns: {
  //   spawnerPromptId,      // e.g., "migration"
  //   taskPromptId,         // e.g., "migration.model_specific.claude-sonnet-4.5.systemPrompt"
  //   relevantTags,         // e.g., ["next.js", "app-router"]
  //   relevantTechStack,    // e.g., ["react", "typescript"]
  //   documentation,        // Array of relevant docs with enrichment
  //   reasoning
  // }
  
  // ========================================================================
  // STEP 3c: Create System Prompt
  // ========================================================================
  const systemPrompt = await this.createSystemPrompt(userPrompt, intent, selection);
  // Combines:
  // - Spawner prompt (from template.prompts[spawnerPromptId].default)
  // - Task prompt (from template.prompts[taskPromptId] or fallback)
  // - Selected documentation (with enrichment metadata)
  // - Mustache template substitution
  
  // ========================================================================
  // STEP 3d: Submit to LLM
  // ========================================================================
  const transformedMessages = this.injectSystemPrompt(request.messages, systemPrompt);
  const modifiedRequest: AgentRequest = {
    ...request,
    messages: transformedMessages
  };
  
  // Delegate to underlying adapter
  return this.underlyingAdapter.send(modifiedRequest);
}
```

### Step 3a: Intent Extraction

```typescript
// Lines 711-753: extractIntentWithLLM()
private async extractIntentWithLLM(userPrompt: string): Promise<ExtractedIntent> {
  const prompt = buildIntentExtractionPrompt(userPrompt);
  
  const response = await this.llmClient.chat.completions.create({
    model: this.llmConfig.extractionModel,
    messages: [{ role: 'user', content: prompt }],
    tools: [INTENT_EXTRACTION_TOOL],
    tool_choice: { type: 'function', function: { name: 'extract_intent' } },
    temperature: 0.1
  });
  
  const intent = parseIntentResponse(toolCall.function.arguments);
  // Returns structured intent with: intent, primaryGoal, keywords, framework, components, etc.
  return intent;
}
```

### Step 3b: Component Selection

```typescript
// Lines 758-850: selectComponentsWithLLM()
private async selectComponentsWithLLM(
  userPrompt: string,
  intent: ExtractedIntent
): Promise<SpecialistSelection> {
  const prompt = buildComponentSelectionPrompt(userPrompt, intent, this.template);
  
  const response = await this.llmClient.chat.completions.create({
    model: this.llmConfig.selectionModel,
    messages: [{ role: 'user', content: prompt }],
    tools: [COMPONENT_SELECTION_TOOL],
    tool_choice: { type: 'function', function: { name: 'select_components' } },
    temperature: 0.1
  });
  
  const selection = parseComponentSelectionResponse(toolCall.function.arguments);
  // Returns: spawnerPromptId, taskPromptId, relevantTags, relevantTechStack, documentation, reasoning
  return selection;
}
```

### Step 3c: System Prompt Creation

```typescript
// Lines 852-950: createSystemPrompt()
private async createSystemPrompt(
  userPrompt: string,
  intent: ExtractedIntent,
  selection: SpecialistSelection
): Promise<string> {
  // 1. Get spawner prompt
  const spawnerPrompt = this.getPromptById(selection.spawnerPromptId);
  
  // 2. Get task prompt (with model-specific fallback)
  const taskPromptId = selection.taskPromptId;
  let taskPrompt = this.getPromptById(taskPromptId);
  
  // If task prompt not found, try fallbacks:
  // - Model-specific fallback (e.g., "migration.model_specific.claude-sonnet-4.5.systemPrompt")
  // - Generic fallback (e.g., "migration.default.systemPrompt")
  // - Spawner prompt as last resort
  
  // 3. Substitute mustache templates
  const templateContext = {
    workspaceDir: request.workspaceDir,
    hasTools: request.tools && request.tools.length > 0,
    // ... other context
  };
  const substitutedSpawner = substituteTemplate(spawnerPrompt, templateContext);
  const substitutedTask = substituteTemplate(taskPrompt, templateContext);
  
  // 4. Select and inject documentation
  const selectedDocs = selection.documentation;
  const docSections = selectedDocs.map(doc => {
    // Use enrichment metadata if available
    if (doc.enrichment) {
      return buildDocumentationSection(doc, doc.enrichment);
    } else {
      return buildDocumentationSection(doc);
    }
  });
  
  // 5. Concatenate: spawner + task + documentation
  const systemPrompt = [
    substitutedSpawner,
    substitutedTask,
    ...docSections
  ].join('\n\n');
  
  return systemPrompt;
}
```

**Data Flow:**
1. User prompt → Intent extraction (LLM call)
2. Intent + Template → Component selection (LLM call)
3. Selected components → System prompt assembly:
   - Spawner prompt (from template)
   - Task prompt (from template, with model-specific fallback)
   - Documentation (with enrichment metadata)
   - Mustache substitution
4. System prompt + Original user prompt → Underlying adapter

---

## Tool Loading

**File**: `packages/harness/src/execution/benchmark.ts`

Tools are loaded and registered before agent execution:

```typescript
// Lines 285-321: Tool loading
if (supportsTools && workspaceDir) {
  // 1. Workspace tools (readFile, writeFile, runCommand, listFiles)
  const workspaceHandlers = createWorkspaceToolHandlers(workspaceDir);
  const tools = getAllWorkspaceTools();
  const toolHandlers = workspaceHandlers;
  
  // 2. Oracle tool (if available)
  if (oracle) {
    tools.push(createAskUserToolDefinition());
    toolHandlers.set('askUser', createAskUserHandler(oracle));
  }
  
  // 3. Convert to adapter-specific format
  if (agent === 'openrouter' || (!agent && specialist)) {
    // OpenRouter format: { type: 'function', function: { name, description, parameters } }
    (request as any).tools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  } else {
    // Anthropic format: ToolDefinition directly
    request.tools = tools;
  }
  
  request.toolHandlers = toolHandlers;
}
```

**Note:** MCP tools were previously loaded here but have been removed in the current version. MCP integration would follow a similar pattern if re-implemented.

---

## Agent Execution

**File**: `packages/harness/src/execution/benchmark.ts`

### Request Building

```typescript
// Lines 266-321: Build agent request
const messages: Array<{ role: 'system' | 'user'; content: string }> = [
  {
    role: 'user' as const,
    content: promptContent  // Original prompt from prompt file
  }
];

const request: AgentRequest = {
  messages,
  ...(workspaceDir && { workspaceDir }),
  tools,           // Tool definitions
  toolHandlers     // Tool handler functions
};
```

### Execution

```typescript
// Lines 324-375: Execute agent request
const response = await agentAdapter.send(request);

// For specialist adapters, get transformed messages (with system prompt)
let messagesForLogging = request.messages;
if ('getLastTransformedMessages' in agentAdapter) {
  const transformed = (agentAdapter as any).getLastTransformedMessages();
  if (transformed) {
    messagesForLogging = transformed;  // Includes system prompt from specialist
  }
}

// Store for telemetry
const promptSent = JSON.stringify(messagesForLogging);
telemetryData.promptSent = promptSent;
```

**What Happens:**
1. Request sent to `agentAdapter.send()`
2. If `SpecialistAdapter`: 3-step transformation happens (see above)
3. Transformed request sent to underlying adapter (OpenRouterAdapter, AnthropicAdapter, etc.)
4. Underlying adapter makes API call to LLM provider
5. Response returned with: `content`, `tokensIn`, `tokensOut`, `costUsd`, `toolCalls`
6. Transformed messages stored for logging

---

## Validation & Evaluation

**File**: `packages/harness/src/execution/benchmark.ts`

### Stage 4: Validation

```typescript
// Lines 403-410: Validation commands
const commandLog = workspaceDir 
  ? runValidationCommands(workspaceDir, scenarioCfg.validation?.commands)
  : [];

const diffArtifacts = workspaceDir && fixtureDir
  ? buildDiffArtifacts(fixtureDir, workspaceDir)
  : { diffSummary: [], depsDelta: [] };
```

**What Happens:**
- Runs validation commands (e.g., `pnpm install`, `pnpm lint`, `pnpm typecheck`)
- Captures command output, exit codes, and execution time
- Computes file diffs between fixture and workspace
- Computes dependency changes (package.json, etc.)

### Stage 5: Evaluation

```typescript
// Lines 412-463: Evaluation
const ctx = {
  scenario: scenarioCfg,
  workspaceDir,
  suitesDir: config.suitesDir,
  referencePath,
  agentResponse: result.agent_response,
  commandLog,
  diffSummary: diffArtifacts.diffSummary,
  depsDelta: diffArtifacts.depsDelta,
};

const { scoreCard, results: evaluatorResults } = await runEvaluators(ctx, llmJudgeOnly);
```

**File**: `packages/evaluators/src/index.ts`

```typescript
// Lines 14-75: runEvaluators()
export async function runEvaluators(
  ctx: EvaluationContext,
  llmJudgeOnly?: boolean,
): Promise<{ results: EvaluatorResult[]; scoreCard: ScoreCard }> {
  const evaluators: Evaluator[] = [];
  
  if (llmJudgeOnly) {
    // Only run LLM judge
    if (shouldEnableLLMJudge(ctx.scenario)) {
      evaluators.push(new LLMJudgeEvaluator());
    }
  } else {
    // Run all evaluators
    evaluators.push(
      new InstallEvaluator(),
      new TestEvaluator(),
      new PackageManagerEvaluator(),
      new DependencyTargetsEvaluator(),
      new IntegrityGuardEvaluator(),
      new FileStructureEvaluator(),
      new ConfigAccuracyEvaluator(),
      new DependencyProximityEvaluator(),
    );
    
    // Add LLM judge if enabled
    if (shouldEnableLLMJudge(ctx.scenario)) {
      evaluators.push(new LLMJudgeEvaluator());
    }
  }
  
  // Run each evaluator
  const results: EvaluatorResult[] = [];
  for (const evaluator of evaluators) {
    results.push(await evaluator.evaluate(ctx));
  }
  
  // Build scoreCard
  const scoreCard: ScoreCard = {
    install_success: results.find(r => r.name === 'InstallEvaluator')?.score ?? 0,
    tests_nonregression: results.find(r => r.name === 'TestEvaluator')?.score ?? 0,
    // ... other scores
    llm_judge: results.find(r => r.name === 'LLMJudgeEvaluator')?.score ?? 0,
  };
  
  return { results, scoreCard };
}
```

**Evaluator Types:**
- **InstallEvaluator**: Checks if `pnpm install` succeeded
- **TestEvaluator**: Checks if tests passed
- **PackageManagerEvaluator**: Validates package manager usage
- **DependencyTargetsEvaluator**: Checks dependency versions
- **IntegrityGuardEvaluator**: Validates file integrity
- **FileStructureEvaluator**: Checks file structure correctness
- **ConfigAccuracyEvaluator**: Validates configuration files
- **DependencyProximityEvaluator**: Checks dependency proximity
- **LLMJudgeEvaluator**: AI-powered evaluation across multiple categories

---

## Results Submission

**File**: `packages/harness/src/execution/benchmark.ts`

### Data Collection

```typescript
// Lines 488-513: Complete run submission
logger.completeRun({
  runId: runData.runId,
  batchId: runData.batchId,
  suite: runData.suite,
  scenario: runData.scenario,
  tier: runData.tier,
  agent: runData.agent,
  model: runData.model,
  status: 'completed',
  startedAt: runData.startedAt,
  completedAt: new Date().toISOString(),
  totalScore,
  weightedScore: result.totals?.weighted,
  isSuccessful,
  successMetric,
  specialistEnabled: !!specialist,
  metadata: {
    diffSummary: diffArtifacts.diffSummary,
    depsDelta: diffArtifacts.depsDelta,
    oracleQuestions: (result as any).oracle_questions,
    packageManager,
    testResults: testResultsJson,
  },
  evaluations: evaluationsData,  // Array of evaluation results
  telemetry: telemetryData,      // Agent telemetry
});
```

**File**: `packages/worker-client/src/logger.ts`

```typescript
// Lines 128-217: completeRun()
async completeRun(dataOrScore: { /* full data object */ } | number, ...): Promise<void> {
  const payload: SubmitRunPayload = {
    runId: dataOrScore.runId,
    batchId: dataOrScore.batchId,
    suite: dataOrScore.suite,
    scenario: dataOrScore.scenario,
    tier: dataOrScore.tier,
    agent: dataOrScore.agent,
    model: dataOrScore.model,
    status: dataOrScore.status,
    startedAt: dataOrScore.startedAt,
    completedAt: dataOrScore.completedAt,
    totalScore: dataOrScore.totalScore,
    weightedScore: dataOrScore.weightedScore,
    isSuccessful: dataOrScore.isSuccessful,
    successMetric: dataOrScore.successMetric,
    specialistEnabled: dataOrScore.specialistEnabled,
    metadata: dataOrScore.metadata,
    evaluations: dataOrScore.evaluations,
    telemetry: dataOrScore.telemetry,
  };
  
  // Submit to worker API
  const response = await fetch(`${this.workerUrl}/api/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}
```

**Data Flow:**
1. All run data collected locally (to avoid race conditions in parallel execution)
2. `logger.completeRun()` called with full data object
3. Data serialized to JSON and POSTed to worker API (`/api/submit`)
4. Worker stores in D1 database (Cloudflare)

---

## Summary: Complete Data Flow

```
1. CLI Entry (cli.ts)
   ↓
2. Argument Parsing (cli/args.ts)
   ↓
3. Specialist Template Resolution (domain/agent.ts)
   ├─→ Check for enriched template (specialist.ts)
   └─→ Load template (agency-prompt-creator)
   ↓
4. Agent Adapter Creation (domain/agent.ts)
   ├─→ Auto-detect model from template.preferred_models
   ├─→ Find OpenRouter model ID (if using OpenRouter)
   ├─→ Create base adapter (OpenRouterAdapter, AnthropicAdapter, etc.)
   └─→ Wrap with SpecialistAdapter (if specialist provided)
   ↓
5. Benchmark Execution (execution/benchmark.ts)
   ├─→ Setup: Load scenario config and prompt
   ├─→ Warmup: Optional warmup phase
   ├─→ Workspace: Prepare workspace from fixture
   ├─→ Agent Execution:
   │   ├─→ Build request (messages, tools, toolHandlers)
   │   ├─→ SpecialistAdapter.send() (if specialist):
   │   │   ├─→ Step 3a: Extract intent (LLM call)
   │   │   ├─→ Step 3b: Select components (LLM call)
   │   │   ├─→ Step 3c: Create system prompt (template assembly)
   │   │   └─→ Step 3d: Submit to underlying adapter
   │   └─→ Underlying adapter sends to LLM provider
   ├─→ Validation: Run validation commands, compute diffs
   ├─→ Evaluation: Run evaluators, compute scores
   └─→ Results: Submit to worker API
   ↓
6. Worker API (apps/worker/src/api/submit.ts)
   └─→ Store in D1 database
```

---

## Key Files Reference

| Component | File | Purpose |
|-----------|------|---------|
| CLI Entry | `packages/harness/src/cli.ts` | Main entry point, argument routing |
| Argument Parsing | `packages/harness/src/cli/args.ts` | Parse CLI arguments |
| Agent Creation | `packages/harness/src/domain/agent.ts` | Create agent adapters, resolve specialist templates |
| Specialist Adapter | `packages/agent-adapters/src/specialist.ts` | Prompt transformation, 3-step workflow |
| Benchmark Execution | `packages/harness/src/execution/benchmark.ts` | Main orchestration function |
| Evaluators | `packages/evaluators/src/index.ts` | Run evaluators, compute scores |
| Logger | `packages/worker-client/src/logger.ts` | Submit results to worker API |
| Template Enrichment | `packages/specialist-mint/src/enrich-template.ts` | Enrich templates with LLM-generated metadata |
| Template Loading | `packages/agency-prompt-creator/src/loader.ts` | Load templates with inheritance support |

---

## Environment Variables

Required for full functionality:

- `OPENROUTER_API_KEY`: For OpenRouter agent and LLM judge
- `ANTHROPIC_API_KEY`: For Anthropic agent
- `ZE_BENCHMARKS_WORKER_URL`: Worker API URL (for result submission)
- `ZE_BENCHMARKS_API_KEY`: Worker API key (for authentication)
- `ENRICHMENT_MODEL`: Model for template enrichment (default: `anthropic/claude-3.5-haiku`)
- `ENRICHMENT_PROVIDER`: Provider for enrichment (default: `openrouter`)

---

This document provides a complete code-level explanation of how ze-benchmarks processes specialist templates and executes benchmarks. For specific implementation details, refer to the source files listed above.

