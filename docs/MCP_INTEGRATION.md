# MCP Integration Guide

This document explains how to use Model Context Protocol (MCP) servers in your benchmarks.

## Overview

The benchmark harness now supports MCP servers defined in specialist templates. When a specialist template includes MCP server configurations, the harness will:

1. Connect to the specified MCP servers
2. Fetch available tools from each server
3. Make those tools available to the AI agent during benchmark execution
4. Clean up connections when the benchmark completes

## Configuration

### In Specialist Templates

Add MCP servers to your specialist template's `dependencies.mcps` array:

```json5
{
  dependencies: {
    mcps: [
      {
        name: "filesystem",
        version: "^1.0.0",
        required: true,
        description: "Filesystem MCP server for file operations",
        permissions: ["read", "write"]
      }
    ]
  }
}
```

**MCP Definition Fields:**
- `name` (required): Name of the MCP server (used for lookup and tool prefixing)
- `version` (optional): Version constraint
- `required` (optional): Whether the benchmark should fail if this MCP fails to initialize (default: false)
- `description` (optional): Human-readable description
- `permissions` (optional): Array of permissions (read, write, execute)

### Supported MCP Servers

The harness automatically resolves common MCP server names to their commands:

- `filesystem` or `filesystem-mcp` → `@modelcontextprotocol/server-filesystem`
- Any package name starting with `@modelcontextprotocol/server-` → Uses that package directly

For custom MCP servers, specify the package name directly in the `name` field, and the harness will attempt to run it via `npx -y <package-name>`.

## Authentication for MCP Servers

Many MCP servers require authentication via API keys or tokens. The harness supports passing environment variables from `.env` files to MCP servers automatically.

### Setting Up Authentication

1. **Create a `.env` file** in the repository root (if it doesn't exist):
   ```bash
   # .env file - Add your API keys here
   FIGMA_API_KEY=your_figma_token_here
   GITHUB_TOKEN=your_github_token_here
   SLACK_TOKEN=your_slack_token_here
   ```

2. **Add MCP server configuration** to `mcp-tools.ts` with environment variables:
   ```typescript
   // In packages/harness/src/runtime/mcp-tools.ts
   const mcpServerMap: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {
     'figma': {
       command: 'npx',
       args: ['-y', '@thirdstrandstudio/mcp-figma'],
       env: {
         FIGMA_API_KEY: process.env.FIGMA_API_KEY || '',
       },
     },
   };
   ```

3. **Add to specialist template** as usual:
   ```json5
   {
     dependencies: {
       mcps: [
         {
           name: "figma",
           required: false,
           description: "Figma MCP server (requires FIGMA_API_KEY)"
         }
       ]
     }
   }
   ```

### How Authentication Works

The environment variable flow:

```
.env file (repo root)
  FIGMA_API_KEY=figd_xxxxx
        ↓
process.env.FIGMA_API_KEY (loaded by Node.js)
        ↓
mcp-tools.ts reads process.env.FIGMA_API_KEY
        ↓
Passed to MCP server via StdioClientTransport
        ↓
MCP server receives FIGMA_API_KEY in its environment
        ↓
MCP server uses it to authenticate API requests
        ↓
Authenticated responses returned to agent
```

### Supported Authenticated MCP Servers

**Figma MCP** (`@thirdstrandstudio/mcp-figma`):
- Environment variable: `FIGMA_API_KEY`
- Get token from: https://www.figma.com/settings
- Required scopes:
  - `file_content:read` - For reading file data
  - `current_user:read` - For user info verification
- Demo: `suites/mcp-demos/scenarios/figma-api-demo`

**GitHub MCP** (with authentication):
- Environment variable: `GITHUB_TOKEN`
- Get token from: https://github.com/settings/tokens
- Note: Read operations work without auth, but have rate limits

**Other MCP Servers**:
- Follow the same pattern in `mcp-tools.ts`
- Add environment variable to `.env`
- Document required scopes in your scenario README

### Example: Adding a New Authenticated MCP Server

To add Slack MCP with authentication:

1. **Add to `mcp-tools.ts`**:
   ```typescript
   'slack': {
     command: 'npx',
     args: ['-y', '@modelcontextprotocol/server-slack'],
     env: {
       SLACK_TOKEN: process.env.SLACK_TOKEN || '',
       SLACK_TEAM_ID: process.env.SLACK_TEAM_ID || '',
     },
   },
   ```

2. **Add to `.env`**:
   ```bash
   SLACK_TOKEN=xoxb-your-slack-bot-token
   SLACK_TEAM_ID=your-team-id
   ```

3. **Use in template**:
   ```json5
   mcps: [
     {
       name: "slack",
       description: "Slack MCP (requires SLACK_TOKEN)"
     }
   ]
   ```

### Authentication Troubleshooting

**403 Forbidden Errors:**
- Check that API key/token is set in `.env`
- Verify token has required scopes/permissions
- Check if token is expired or invalid
- For Figma: Ensure scopes include `current_user:read` and `file_content:read`

**401 Unauthorized Errors:**
- Token is missing or malformed
- Check `.env` file exists in repository root (not subdirectory)
- Verify environment variable name matches exactly

**MCP Server Starts But Tools Fail:**
- Authentication is passed correctly but API key lacks required permissions
- Check the specific error message for scope requirements
- Regenerate token with correct scopes

**Environment Variables Not Loading:**
- Ensure `.env` file is in repository root
- Restart the benchmark (environment variables are loaded at startup)
- Check for typos in variable names
- Verify no quotes around values in `.env` (use `KEY=value` not `KEY="value"`)

## Example: Using the Filesystem MCP

### 1. Create a Specialist Template

See `templates/mcp-test-specialist-template.json5` for a complete example.

### 2. Run a Benchmark

```bash
pnpm benchmark run <suite> <scenario> <tier> --specialist mcp-test-specialist
```

### 3. MCP Tools Available

When the benchmark runs, MCP tools from configured servers are automatically available. For example, the filesystem MCP provides tools like:
- `read_file` - Read file contents
- `write_file` - Write file contents
- `list_directory` - List directory contents

Tools are registered with both:
- Prefixed name: `filesystem_read_file` (to avoid conflicts)
- Original name: `read_file` (for convenience)

## How It Works

1. **Template Loading**: When a specialist is specified, the harness loads the template
2. **MCP Discovery**: Extracts `dependencies.mcps` from the template
3. **Server Resolution**: Maps MCP names to actual server commands/configs
4. **Client Initialization**: Connects to each MCP server via stdio transport
5. **Tool Loading**: Fetches available tools from each server
6. **Tool Registration**: Converts MCP tools to `ToolDefinition` format and adds to the tools array
7. **Execution**: Agent can call MCP tools just like workspace tools
8. **Cleanup**: MCP clients are disconnected when benchmark completes

## Implementation Details

### MCP Tools Module

Located in `packages/harness/src/runtime/mcp-tools.ts`:

- `MCPServerConfig`: Configuration for an MCP server
- `MCPClientWrapper`: Wraps MCP client with lifecycle management
- `resolveMCPConfig()`: Maps template MCP definitions to server configs
- `initializeMCPClients()`: Creates and connects MCP clients
- `loadMCPTools()`: Fetches tools and converts to ToolDefinition format
- `cleanupMCPClients()`: Disconnects all clients

### Integration Points

MCP tools are loaded in `packages/harness/src/execution/benchmark.ts`:

1. After workspace tools are loaded
2. After artifact-specific tools (like Figma) are loaded
3. Before tools are converted to adapter-specific format

## Testing

To test MCP integration:

1. Use the sample template: `templates/mcp-test-specialist-template.json5`
2. Run a benchmark with a simple scenario
3. Check logs for MCP connection messages
4. Verify MCP tools appear in the tools list

Example:
```bash
pnpm benchmark run test-suite simple-scenario L1 --specialist mcp-test-specialist
```

## Troubleshooting

### MCP Server Fails to Start

- Check that the MCP server package is available (e.g., `@modelcontextprotocol/server-filesystem`)
- Verify the command and args in the resolved config
- Check logs for connection errors

### Tools Not Available

- Verify MCP server initialized successfully (check logs)
- Ensure `required: false` if the server is optional
- Check that tools were fetched (look for "Found X tools from Y" messages)

### Tool Name Conflicts

- MCP tools are prefixed with server name (e.g., `filesystem_read_file`)
- Original names are also registered (last one wins if conflicts)
- Use prefixed names to avoid conflicts with workspace tools

## Future Enhancements

- [ ] HTTP/SSE transport support
- [ ] MCP resource support (not just tools)
- [ ] Scenario-level MCP configuration
- [ ] MCP server registry/config file
- [ ] Better error handling for required MCPs
- [ ] MCP tool caching

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- Sample template: `templates/mcp-test-specialist-template.json5`

