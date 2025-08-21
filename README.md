## Zephyr Bench – Real‑world LLM & Tool Benchmark Suite

Zephyr Bench is a modular benchmark for evaluating coding agents on real software tasks.

- **Harness CLI**: `packages/harness` → `ze-bench`
- **Suites**: `suites/` (initial: `update-deps`)
- **Results**: `results/`

### Quick start (stubbed harness)
```bash
npm install
npm -w packages/harness run build
node packages/harness/dist/cli.js run update-deps nx-pnpm-monorepo --tier L0
# writes results/summary.json
```

### How to test your own agent (e.g., Anthropic Claude)
The harness is adapter-based. You implement an `AgentAdapter`, then run the CLI with `--agent` and `--model` (once wired). Below is the minimal path for Anthropic:

1) Install SDK in the adapters workspace
```bash
npm i -w packages/agent-adapters @anthropic-ai/sdk
```

2) Create an Anthropic adapter at `packages/agent-adapters/src/anthropic.ts`
```ts
import Anthropic from "@anthropic-ai/sdk";
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.js";

export class AnthropicAdapter implements AgentAdapter {
  name = "anthropic";
  private client: Anthropic;
  constructor(apiKey = process.env.ANTHROPIC_API_KEY!) {
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    this.client = new Anthropic({ apiKey });
  }
  async send(request: AgentRequest): Promise<AgentResponse> {
    const system = request.messages.find(m => m.role === "system")?.content;
    const user = request.messages.filter(m => m.role === "user" || m.role === "assistant")
      .map(m => (m.role === "user" ? { type: "text", text: m.content } : { type: "text", text: `Assistant: ${m.content}` })) as any[];
    const resp = await this.client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219",
      system,
      messages: [{ role: "user", content: user.length ? user : [{ type: "text", text: "" }] }],
      max_output_tokens: 2048
    });
    const content = resp.content?.[0]?.type === "text" ? resp.content[0].text : JSON.stringify(resp);
    return { content };
  }
}
```

3) Export it (optional convenience) in `packages/agent-adapters/src/index.ts`
```ts
export * from "./anthropic.js";
```

4) Wire the CLI (if not yet): add `--agent`/`--model` flags and call the adapter with the selected tier prompt. At a minimum in `packages/harness/src/cli.ts`:
```ts
// parse --agent and --model
// pick prompt file: suites/<suite>/prompts/<scenario>/<tier>.md
// instantiate adapter (e.g., new AnthropicAdapter()) and send the prompt
```
If you want, I can wire this for you in the codebase.

5) Run it
```bash
export ANTHROPIC_API_KEY=...      # required
export CLAUDE_MODEL=claude-3-7-sonnet-20250219  # optional override
node packages/harness/dist/cli.js run update-deps nx-pnpm-monorepo --tier L1 --agent anthropic
```
Results will still be written to `results/` with telemetry once fully wired.

### Environment variables
- **ANTHROPIC_API_KEY**: required for Anthropic adapter
- **CLAUDE_MODEL**: optional model override (defaults to Sonnet 3.7 example)

### Docker (optional)
```bash
docker build -f docker/node-lts.Dockerfile -t ze-bench .
docker run --rm -e ANTHROPIC_API_KEY -e CLAUDE_MODEL ze-bench run update-deps nx-pnpm-monorepo --tier L1 --agent anthropic
```

### Notes
- Current CLI is stubbed (loads scenario, writes a placeholder result). The adapter/flags wiring is straightforward; happy to add it if you want this runnable end-to-end now.

### Scenario fixtures: raw code, not tarballs
- Each scenario includes a raw fixture directory (e.g., `suites/update-deps/scenarios/nx-pnpm-monorepo/repo-fixture`).
- The harness copies this directory into a temp workspace under `results/workspaces/...` when you run a scenario.
- If you prefer a different folder name, you can also use `repo/` instead of `repo-fixture/`.
