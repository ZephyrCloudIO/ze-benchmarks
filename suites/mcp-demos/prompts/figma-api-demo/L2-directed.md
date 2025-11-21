# MCP Figma API Operations Demo - Detailed Guide

This scenario is designed to help you understand exactly how MCP (Model Context Protocol) integration works with authenticated services in the ze-benchmarks system using the Figma MCP server.

## Background: How Authenticated MCP Works

When you run this benchmark with the `--specialist figma-mcp-specialist` flag:

1. The harness reads the specialist template and finds the MCP configuration in `dependencies.mcps`
2. It reads `FIGMA_API_KEY` from `process.env` (which loads from `.env` file at repo root)
3. It spawns the Figma MCP server: `npx -y @thirdstrandstudio/mcp-figma`
4. **It passes the FIGMA_API_KEY as an environment variable to the MCP server process**
5. It connects to the server via stdio transport
6. It fetches available tools: 31 tools including `figma_get_me`, `figma_get_file`, etc.
7. These tools become available to you alongside workspace tools
8. When you call an MCP tool, the harness routes it to the Figma MCP server
9. **The MCP server uses the FIGMA_API_KEY to authenticate with Figma's API**
10. When the benchmark completes, the MCP server is automatically cleaned up

## Your Task: Demonstrate Authenticated MCP Integration

Follow these steps carefully to demonstrate each aspect of authenticated MCP:

### Step 1: Verify Authentication

```
Use the figma_get_me tool with no parameters

Say: "I'm using the figma_get_me MCP tool to verify authentication with the Figma API"

Expected result:
- Success: User info returned (id, handle, email, img_url)
- Failure: Error message about missing or invalid FIGMA_API_KEY

If it succeeds, show the user's handle/email to confirm auth worked.
If it fails, provide clear instructions about setting up .env file (see below).
```

**What's happening behind the scenes:**
- Your tool call goes to the harness
- The harness forwards it to the Figma MCP server
- The MCP server uses FIGMA_API_KEY from its environment to call Figma's API
- Results are returned back to you as a normal tool result

### Step 2: Retrieve a Figma File

```
Use the figma_get_file tool with these parameters:
- file_id: A Figma file ID (you can use a public community file)

Finding a file_id:
- Figma URLs look like: https://www.figma.com/file/{FILE_ID}/filename
- Public community files you can try:
  - Material Design 3: Look for MD3 design kits
  - Popular design systems often have public files

Say: "I'm using the figma_get_file MCP tool to retrieve file data from Figma"

Expected result:
- Success: Large JSON with file structure (document, components, styles, etc.)
- The response includes pages, frames, components, styles, and more

Show a summary of what's in the file:
- Number of pages
- Key components found
- Styles defined
- File name and last modified date
```

**What's happening behind the scenes:**
- Same routing process as Step 1
- The MCP server makes an authenticated GET request to Figma's REST API
- You receive the full file data as a tool result

### Step 3: (Optional) Explore Components or Styles

If you want to demonstrate more capabilities:

```
Option A - List file components:
Use figma_get_file_components with:
- file_id: (same file_id from Step 2)
Say: "I'm using the figma_get_file_components MCP tool to list all components"

Option B - List file styles:
Use figma_get_file_styles with:
- file_id: (same file_id from Step 2)
Say: "I'm using the figma_get_file_styles MCP tool to list all styles"

Option C - Get team projects:
Use figma_get_team_projects with:
- team_id: (from figma_get_me response or known team)
Say: "I'm using the figma_get_team_projects MCP tool to list team projects"
```

### Step 4: Provide a Summary

After completing operations, provide a clear summary:
- What MCP tools you used
- That authentication via FIGMA_API_KEY worked correctly
- That all operations succeeded
- That this demonstrates authenticated MCP integration
- Key insights from the Figma file you examined

## Example Output Structure

```
I'll demonstrate the Figma MCP integration with authentication by verifying access and retrieving file data.

1. Verifying authentication using figma_get_me MCP tool...
[tool call results]
✓ Authentication successful! Logged in as: [handle] ([email])

2. Retrieving Figma file using figma_get_file MCP tool...
[tool call results]
✓ Successfully retrieved file: "[File Name]"
   - Last modified: [date]
   - Pages: 5
   - Components: 127
   - Styles: 45 colors, 12 text styles

3. Listing file components using figma_get_file_components MCP tool...
[tool call results]
✓ Found 127 components including:
   - Buttons (Primary, Secondary, Tertiary)
   - Form inputs (TextField, Select, Checkbox)
   - Navigation components
   - Cards and containers

Summary: All authenticated Figma MCP operations completed successfully. The Figma
MCP server received the FIGMA_API_KEY environment variable automatically from the
harness, demonstrating how authenticated MCP integration works with .env files.
```

## Troubleshooting

### If Authentication Fails

The user needs to set up their .env file:

```bash
# Create or edit .env in repository root
echo "FIGMA_API_KEY=your_figma_personal_access_token" >> .env

# Get your token from:
# https://www.figma.com/settings
# 1. Scroll to "Personal access tokens"
# 2. Click "Generate new token"
# 3. Give it a name like "Ze Benchmarks MCP"
# 4. Copy the token
# 5. Paste it in .env file
```

**Important**: The .env file must be in the repository root, not in a subdirectory.

### If MCP Server Doesn't Start

Check the harness logs for `[MCP]` messages:
```
[MCP] Starting MCP server: figma
[MCP] Command: npx -y @thirdstrandstudio/mcp-figma
[MCP] ✓ Connected to figma
```

Common issues:
- Network connection (npx needs to download packages)
- Invalid FIGMA_API_KEY
- Figma API rate limits

### If figma_get_file Fails

Common issues:
- Invalid file_id format
- File is private and you don't have access
- FIGMA_API_KEY doesn't have permission to access the file

Try using a public community file instead.

## Understanding the Environment Variable Flow

```
.env file in repo root
    ↓
process.env.FIGMA_API_KEY (loaded by harness)
    ↓
mcp-tools.ts reads process.env.FIGMA_API_KEY
    ↓
Passed to MCP server as env variable in StdioClientTransport
    ↓
MCP server receives FIGMA_API_KEY in its environment
    ↓
MCP server uses it to authenticate Figma API requests
    ↓
Authenticated responses returned to agent
```

This flow demonstrates how sensitive credentials are:
1. Stored in .env (git-ignored)
2. Loaded into process.env
3. Passed securely to MCP servers
4. Used for authenticated API calls
5. Never exposed to the agent directly

## Success Criteria

- ✅ FIGMA_API_KEY authentication verified with figma_get_me
- ✅ Each operation explained clearly before execution
- ✅ Figma file successfully retrieved via figma_get_file
- ✅ File data summarized (pages, components, styles)
- ✅ Operations verified and confirmed working
- ✅ Clear explanations help users understand authenticated MCP flow
- ✅ Summary confirms MCP integration with authentication works correctly
- ✅ If auth fails, clear setup instructions provided
