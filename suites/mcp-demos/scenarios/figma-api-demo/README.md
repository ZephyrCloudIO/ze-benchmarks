# MCP Figma API Operations Demo

A demonstration scenario that shows how MCP (Model Context Protocol) integration works with **authenticated services** in the ze-benchmarks system using the Figma MCP server.

## What This Demonstrates

This scenario shows the complete authenticated MCP integration flow:

1. **Environment Variable Configuration** - How .env files provide API keys
2. **Template Configuration** - How to add authenticated MCP servers to a specialist template
3. **Automatic Server Spawning** - The harness spawns MCP servers with environment variables
4. **Authentication Flow** - How API keys are passed from .env → process.env → MCP server
5. **Tool Discovery** - MCP tools are loaded and made available to the agent
6. **Authenticated Tool Usage** - The agent uses MCP tools that require authentication
7. **Transparent Routing** - Tool calls are routed to the authenticated MCP server
8. **Automatic Cleanup** - MCP servers are cleaned up when benchmarks complete

## Prerequisites

Before running this demo, you need a Figma API key with the correct scopes:

1. Visit https://www.figma.com/settings
2. Scroll to "Personal access tokens"
3. Click "Generate new token"
4. Give it a name like "Ze Benchmarks MCP"
5. **Select the following scopes:**
   - ✅ **File content** - Read (`file_content:read`) - Required for `figma_get_file`
   - ✅ **Current user** - Read (`current_user:read`) - Required for `figma_get_me`
   - ✅ (Optional) **File comments** - Read/Write - For comment operations
   - ✅ (Optional) **Webhooks** - Read/Write - For webhook operations
6. Copy the token
7. Create/edit `.env` file in the repository root:
   ```bash
   FIGMA_API_KEY=your_figma_personal_access_token_here
   ```

**Important**:
- The `.env` file must be in the repository root (not in a subdirectory)
- The `.env` file should already be in `.gitignore` to prevent committing secrets
- If you get a 403 error with "Invalid scope" message, regenerate your token with the correct scopes above

## How to Run

```bash
# From the repository root
pnpm bench mcp-demos figma-api-demo --tier L1 --specialist figma-mcp-specialist
```

### Command Breakdown

- `mcp-demos` - The suite name
- `figma-api-demo` - The scenario ID
- `--tier L1` - The prompt tier (L0=minimal, L1=basic, L2=detailed)
- `--specialist figma-mcp-specialist` - The specialist template to use

## What Happens When You Run This

### 1. Environment Variable Loading

The harness loads environment variables from `.env`:
```bash
FIGMA_API_KEY=figd_xxxxxxxxxxxxxxxxxxxx
```

These are available in `process.env.FIGMA_API_KEY`.

### 2. Template Loading

The harness loads `templates/figma-mcp-specialist-template.json5` and finds:

```json5
"mcps": [
  {
    "name": "figma",
    "version": "^0.1.0",
    "required": false,
    "description": "Figma MCP server for design file operations (requires FIGMA_API_KEY)",
    "permissions": ["read", "write"]
  }
]
```

### 3. MCP Server Initialization with Authentication

The harness:
- Resolves `"figma"` to `npx -y @thirdstrandstudio/mcp-figma`
- Reads `FIGMA_API_KEY` from `process.env`
- Spawns the MCP server process with environment variables:
  ```javascript
  {
    command: 'npx',
    args: ['-y', '@thirdstrandstudio/mcp-figma'],
    env: {
      ...process.env,
      FIGMA_API_KEY: process.env.FIGMA_API_KEY
    }
  }
  ```
- Connects via stdio transport

You'll see logs like:
```
[MCP] Starting MCP server: figma
[MCP] Command: npx -y @thirdstrandstudio/mcp-figma
[MCP] ✓ Connected to figma
```

### 4. Tool Discovery

The harness fetches available tools from the Figma MCP server:

```
[MCP] Found 31 tools from figma
[MCP]   - figma_get_me (from figma)
[MCP]   - figma_get_file (from figma)
[MCP]   - figma_get_file_nodes (from figma)
[MCP]   - figma_get_comments (from figma)
[MCP]   ... and 27 more
```

### 5. Agent Execution

The agent receives the scenario prompt and has access to:
- Workspace tools (file_system, terminal, etc.)
- **Figma MCP tools** (figma_get_me, figma_get_file, figma_get_comments, etc.)

When the agent calls a Figma MCP tool:
1. Tool call goes to the harness
2. Harness routes to the Figma MCP server
3. MCP server uses `FIGMA_API_KEY` from its environment
4. MCP server makes authenticated request to Figma API
5. Results are returned to the agent

### 6. Cleanup

When the benchmark completes, the MCP server is automatically disconnected and cleaned up.

## Files in This Scenario

- `scenario.yaml` - Scenario configuration with success criteria and LLM judge settings
- `README.md` - This file
- `prompts/figma-api-demo/L0-minimal.md` - Minimal prompt
- `prompts/figma-api-demo/L1-basic.md` - Basic prompt with tool descriptions
- `prompts/figma-api-demo/L2-directed.md` - Detailed step-by-step guide

## What the Agent Should Do

The agent should:
1. Use `figma_get_me` MCP tool to verify authentication
2. Use `figma_get_file` MCP tool to retrieve a Figma file (public community file)
3. Optionally use other Figma MCP tools to demonstrate more capabilities
4. Clearly explain what it's doing at each step
5. Verify all operations succeeded
6. If authentication fails, provide setup instructions

## Success Criteria (LLM Judge)

The scenario is evaluated on:
- **MCP Tool Usage (40%)** - Does the agent use the correct Figma MCP tools?
- **Authentication (20%)** - Does the agent verify authentication and handle errors?
- **Operation Success (20%)** - Do the Figma operations complete successfully?
- **Verification (10%)** - Does the agent verify operations worked?
- **Communication Clarity (10%)** - Are explanations clear about authentication?

## Understanding the Authentication Flow

### Code Location: `packages/harness/src/runtime/mcp-tools.ts`

**Environment Variable Mapping (lines 247-260):**
```typescript
'figma': {
  command: 'npx',
  args: ['-y', '@thirdstrandstudio/mcp-figma'],
  env: {
    FIGMA_API_KEY: process.env.FIGMA_API_KEY || '',
  },
},
```

**Environment Passing (line 54):**
```typescript
this.transport = new StdioClientTransport({
  command: this.config.command,
  args: args,
  env: { ...process.env, ...this.config.env },
});
```

### Flow Diagram

```
.env file (repo root)
  FIGMA_API_KEY=figd_xxx
        ↓
  process.env.FIGMA_API_KEY
        ↓
  mcp-tools.ts reads it (line 251)
        ↓
  Passed to MCP server via StdioClientTransport (line 54)
        ↓
  Figma MCP server process receives FIGMA_API_KEY in environment
        ↓
  MCP server uses it to authenticate Figma API requests
        ↓
  Authenticated responses returned to agent
```

## Available Figma MCP Tools

The `@thirdstrandstudio/mcp-figma` server provides 31 tools:

**Authentication & User:**
- `figma_get_me` - Get current user info

**Files:**
- `figma_get_file` - Get complete file data
- `figma_get_file_nodes` - Get specific nodes
- `figma_get_images` - Export images
- `figma_get_image_fills` - Get image fill URLs
- `figma_get_file_versions` - Get version history

**Comments:**
- `figma_get_comments` - List comments
- `figma_post_comment` - Create comment
- `figma_delete_comment` - Delete comment
- `figma_get_comment_reactions` - Get reactions
- `figma_post_comment_reaction` - Add reaction
- `figma_delete_comment_reaction` - Remove reaction

**Teams & Projects:**
- `figma_get_team_projects` - List team projects
- `figma_get_project_files` - List project files

**Components:**
- `figma_get_team_components` - List team components
- `figma_get_file_components` - List file components
- `figma_get_component` - Get specific component
- `figma_get_team_component_sets` - List component sets
- `figma_get_file_component_sets` - List file component sets
- `figma_get_component_set` - Get specific component set

**Styles:**
- `figma_get_team_styles` - List team styles
- `figma_get_file_styles` - List file styles
- `figma_get_style` - Get specific style

**Variables:**
- `figma_get_local_variables` - Get file variables
- `figma_get_published_variables` - Get published variables
- `figma_post_variables` - Create variables

**Webhooks (V2 API):**
- `figma_post_webhook` - Create webhook
- `figma_get_webhook` - Get webhook info
- `figma_get_team_webhooks` - List team webhooks
- `figma_update_webhook` - Update webhook
- `figma_delete_webhook` - Delete webhook

**Analytics:**
- `figma_get_component_analytics` - Component usage
- `figma_get_style_analytics` - Style usage
- `figma_get_variable_analytics` - Variable usage

## Troubleshooting

### Authentication Errors

If you see errors like `"status": 403` or `"message": "Invalid token"`:

1. Check that `.env` file exists in repository root
2. Check that `FIGMA_API_KEY=...` is set correctly
3. Verify your token is valid at https://www.figma.com/settings
4. Make sure there are no extra spaces or quotes around the token
5. Restart the benchmark after updating .env

### MCP Server Not Starting

Check the harness logs for `[MCP]` messages:
```
[MCP] Starting MCP server: figma
[MCP] Command: npx -y @thirdstrandstudio/mcp-figma
[MCP] ✗ Failed to connect to figma: [error message]
```

Common issues:
- Network connection (npx needs to download packages)
- Missing FIGMA_API_KEY (server may start but tools will fail)
- Package not found (check package name)

### MCP Tools Not Available

If the agent says Figma MCP tools aren't available:
1. Verify you're using `--specialist figma-mcp-specialist`
2. Check the template has `dependencies.mcps` configured
3. Look for MCP initialization messages in logs
4. Verify the MCP server loaded: `[MCP] ✓ Connected to figma`

### Tool Calls Failing

If Figma MCP tool calls fail:
- Check the FIGMA_API_KEY is valid
- Verify file_id format is correct (from Figma URL)
- Check if file is accessible with your account
- Look at the error message in the tool result
- Check Figma API rate limits

### Finding Figma File IDs

Figma file URLs look like:
```
https://www.figma.com/file/{FILE_ID}/filename
https://www.figma.com/design/{FILE_ID}/filename
```

Extract the FILE_ID from the URL. For public community files, search Figma Community for popular design systems (Material Design, Ant Design, etc.).

## Related Files

- **Template**: `templates/figma-mcp-specialist-template.json5`
- **MCP Runtime**: `packages/harness/src/runtime/mcp-tools.ts` (lines 247-260, 54)
- **Benchmark Execution**: `packages/harness/src/execution/benchmark.ts`
- **Documentation**: `docs/MCP_INTEGRATION.md`

## Next Steps

After running this demo:
1. Check the benchmark results and LLM judge scores
2. Review the harness logs to see MCP initialization with environment variables
3. Try different Figma files and tools
4. Create your own specialist template with authenticated MCP
5. Explore other authenticated MCP servers (Slack, GitHub with auth, etc.)

## Extending This Demo

### Using Different Figma Files

The agent can retrieve any Figma file you have access to by changing the `file_id` parameter.

### Using Other MCP Servers with Authentication

The same pattern works for other authenticated MCP servers:

```json5
"mcps": [
  {
    "name": "slack",
    "required": false,
    "description": "Slack MCP server (requires SLACK_TOKEN)",
    // The harness will automatically pass SLACK_TOKEN from process.env
  }
]
```

Update `mcp-tools.ts` to add the server mapping:
```typescript
'slack': {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-slack'],
  env: {
    SLACK_TOKEN: process.env.SLACK_TOKEN || '',
  },
},
```

## Questions?

See the main MCP documentation at `docs/MCP_INTEGRATION.md` for:
- Complete MCP integration guide
- Advanced configuration options
- Troubleshooting tips
- Implementation details
- Security best practices for authentication
