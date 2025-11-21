# MCP GitHub Repository Operations Demo

A simple demonstration scenario that shows how MCP (Model Context Protocol) integration works in the ze-benchmarks system using the GitHub MCP server.

## What This Demonstrates

This scenario shows the complete MCP integration flow:

1. **Template Configuration** - How to add MCP servers to a specialist template
2. **Automatic Server Spawning** - The harness spawns MCP servers automatically
3. **Tool Discovery** - MCP tools are loaded and made available to the agent
4. **Tool Usage** - The agent can use MCP tools just like any other tool
5. **Transparent Routing** - Tool calls are routed to the MCP server automatically
6. **Automatic Cleanup** - MCP servers are cleaned up when benchmarks complete

## How to Run

```bash
# From the repository root
pnpm bench mcp-demos github-repo-demo --tier L1 --specialist mcp-demo-specialist
```

### Command Breakdown

- `mcp-demos` - The suite name
- `github-repo-demo` - The scenario ID
- `--tier L1` - The prompt tier (L0=minimal, L1=basic, L2=detailed)
- `--specialist mcp-demo-specialist` - The specialist template to use

## What Happens When You Run This

### 1. Template Loading
The harness loads `templates/mcp-demo-specialist-template.json5` and finds:

```json5
"mcps": [
  {
    "name": "github",
    "version": "^0.1.0",
    "required": false,
    "description": "GitHub MCP server for repository operations",
    "permissions": ["read"]
  }
]
```

### 2. MCP Server Initialization
The harness:
- Resolves `"github"` to `npx -y @modelcontextprotocol/server-github`
- Spawns the MCP server process
- Connects via stdio transport

You'll see logs like:
```
[MCP] Starting MCP server: github
[MCP] Command: npx -y @modelcontextprotocol/server-github
[MCP] ✓ Connected to github
```

### 3. Tool Discovery
The harness fetches available tools from the MCP server:

```
[MCP] Found 26 tools from github
[MCP]   - search_repositories (from github)
[MCP]   - get_file_contents (from github)
[MCP]   - list_issues (from github)
[MCP]   ... and 23 more
```

### 4. Agent Execution
The agent receives the scenario prompt and has access to:
- Workspace tools (file_system, terminal, etc.)
- **MCP tools** (search_repositories, get_file_contents, list_issues, etc.)

When the agent calls an MCP tool, the harness routes it to the GitHub MCP server.

### 5. Cleanup
When the benchmark completes, the MCP server is automatically disconnected and cleaned up.

## Files in This Scenario

- `scenario.yaml` - Scenario configuration with success criteria and LLM judge settings
- `README.md` - This file

## What the Agent Should Do

The agent should:
1. Use `search_repositories` MCP tool to find MCP-related repos
2. Use `get_file_contents` MCP tool to retrieve README from a found repo
3. Optionally use other GitHub MCP tools to demonstrate more capabilities
4. Clearly explain what it's doing at each step
5. Verify all operations succeeded

## Success Criteria (LLM Judge)

The scenario is evaluated on:
- **MCP Tool Usage (40%)** - Does the agent use the correct MCP tools?
- **Operation Success (30%)** - Do the file operations complete successfully?
- **Verification (20%)** - Does the agent verify operations worked?
- **Communication Clarity (10%)** - Are explanations clear and helpful?

## Understanding the MCP Configuration

### Where MCP is Configured

MCP servers are configured in specialist templates under `dependencies.mcps`:

```json5
{
  "dependencies": {
    "mcps": [
      {
        "name": "filesystem",        // Server name (maps to package)
        "version": "^1.0.0",         // Optional: version constraint
        "required": false,            // Optional: fail if can't load?
        "description": "...",         // Optional: human-readable description
        "permissions": ["read", "write"]  // Optional: permissions needed
      }
    ]
  }
}
```

### How Server Names are Resolved

The harness has built-in mappings for common MCP servers:

| Name | Resolves To |
|------|-------------|
| `filesystem` | `npx -y @modelcontextprotocol/server-filesystem <workspace>` |
| `filesystem-mcp` | Same as above |
| `@modelcontextprotocol/server-filesystem` | Same as above |

For other servers, the harness tries: `npx -y <name>`

### How Tools are Named

MCP tools are registered with both names:
- **Prefixed**: `filesystem_read_file` (to avoid conflicts)
- **Unprefixed**: `read_file` (for convenience)

The agent can use either name.

## Extending This Demo

### Using Different MCP Servers

To use a different MCP server, update the template:

```json5
"mcps": [
  {
    "name": "github",  // or any npm-published MCP server
    "required": false
  }
]
```

### Adding Multiple MCP Servers

You can add multiple MCP servers:

```json5
"mcps": [
  {
    "name": "filesystem",
    "required": false
  },
  {
    "name": "github",
    "required": false
  }
]
```

Each server's tools will be available to the agent.

### Making MCP Required

If the benchmark should fail when MCP can't load:

```json5
"mcps": [
  {
    "name": "filesystem",
    "required": true  // Benchmark fails if MCP doesn't load
  }
]
```

## Troubleshooting

### MCP Server Not Starting

Check the harness logs for `[MCP]` messages:
```
[MCP] Starting MCP server: filesystem
[MCP] Command: npx -y @modelcontextprotocol/server-filesystem /path
[MCP] ✗ Failed to connect to filesystem: [error message]
```

Common issues:
- Network connection (npx needs to download packages)
- Invalid server name
- Missing permissions

### MCP Tools Not Available

If the agent says MCP tools aren't available:
1. Verify you're using `--specialist mcp-demo-specialist`
2. Check the template has `dependencies.mcps` configured
3. Look for MCP initialization messages in logs
4. Verify the MCP server loaded: `[MCP] ✓ Initialized filesystem`

### Tool Calls Failing

If MCP tool calls fail:
- Check the tool parameters (path, content, etc.)
- Verify permissions in the MCP configuration
- Look at the error message in the tool result
- Check the workspace directory exists

## Related Files

- **Template**: `templates/mcp-demo-specialist-template.json5`
- **MCP Runtime**: `packages/harness/src/runtime/mcp-tools.ts`
- **Benchmark Execution**: `packages/harness/src/execution/benchmark.ts`
- **Documentation**: `docs/MCP_INTEGRATION.md`

## Next Steps

After running this demo:
1. Check the benchmark results and LLM judge scores
2. Review the harness logs to see MCP initialization
3. Try creating your own specialist template with MCP
4. Experiment with different MCP servers
5. Create more complex scenarios that use MCP tools

## Questions?

See the main MCP documentation at `docs/MCP_INTEGRATION.md` for:
- Complete MCP integration guide
- Advanced configuration options
- Troubleshooting tips
- Implementation details
