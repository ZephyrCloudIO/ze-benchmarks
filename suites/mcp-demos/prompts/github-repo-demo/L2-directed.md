# MCP GitHub Operations Demo - Detailed Guide

This scenario is designed to help you understand exactly how MCP (Model Context Protocol) integration works in the ze-benchmarks system using the GitHub MCP server.

## Background: How MCP Works

When you run this benchmark with the `--specialist mcp-demo-specialist` flag:

1. The harness reads the specialist template and finds the MCP configuration in `dependencies.mcps`
2. It spawns the GitHub MCP server: `npx -y @modelcontextprotocol/server-github`
3. It connects to the server via stdio transport
4. It fetches available tools: `search_repositories`, `get_file_contents`, `list_issues`, etc.
5. These tools become available to you alongside workspace tools
6. When you call an MCP tool, the harness routes it to the GitHub MCP server
7. When the benchmark completes, the MCP server is automatically cleaned up

## Your Task: Demonstrate MCP Integration

Follow these steps carefully to demonstrate each GitHub MCP tool:

### Step 1: Search for Repositories

```
Use the search_repositories tool with these parameters:
- query: "model context protocol" or "MCP servers" or similar

Say: "I'm using the search_repositories MCP tool to find MCP-related repositories"
Then show some of the repositories you found (name, description, stars, etc.)
```

**What's happening behind the scenes:**
- Your tool call goes to the harness
- The harness forwards it to the GitHub MCP server
- The MCP server calls the GitHub API
- Results are returned back to you as a normal tool result

### Step 2: Get File Contents

```
Use the get_file_contents tool with these parameters:
- owner: (owner of a repo you found)
- repo: (repo name)
- path: "README.md" or similar documentation file

Say: "I'm using the get_file_contents MCP tool to retrieve the README from [repo-name]"
Then provide a summary of what's in the file (don't show the entire file, just key points)
```

**What's happening behind the scenes:**
- Same routing process as above
- The MCP server fetches the file content from GitHub
- You receive the content as a tool result

### Step 3: (Optional) Additional Operations

If you want to demonstrate more capabilities:

```
Use search_code to find code examples:
- query: "MCP tool" or similar
- Say what you're searching for

OR

Use list_issues to see issues in a repo:
- owner: (repo owner)
- repo: (repo name)
- state: "open" or "closed"
```

### Step 4: Provide a Summary

After completing operations, provide a clear summary:
- What MCP tools you used
- That all operations succeeded
- That this demonstrates MCP integration working correctly
- Key insights from what you found

## Example Output Structure

```
I'll demonstrate the MCP GitHub integration by searching for repositories and retrieving documentation.

1. Searching for MCP-related repositories using search_repositories MCP tool...
[tool call results]
✓ Found 12,803 repositories! Top results include:
  - modelcontextprotocol/servers (Official MCP servers)
  - awesome-mcp-servers (Curated list)
  - ... [more repos]

2. Retrieving README from awesome-mcp-servers using get_file_contents MCP tool...
[tool call results]
✓ Successfully retrieved README.md. Key contents:
  - List of 100+ MCP servers
  - Categories: databases, APIs, development tools
  - Integration examples

Summary: All MCP operations completed successfully. The GitHub MCP server
provided seamless access to repository search and file retrieval through the
Model Context Protocol.
```

## Troubleshooting

If the MCP tools aren't available:
- Check the harness logs for `[MCP]` messages
- Verify the specialist template has `dependencies.mcps` configured with "github"
- Make sure you're running with `--specialist mcp-demo-specialist`

If operations fail:
- GitHub API rate limits may apply (read operations should work without auth)
- Check error messages in tool results
- Verify repository names and paths are correct

## Success Criteria

- ✅ GitHub MCP tools used (search_repositories, get_file_contents, etc.)
- ✅ Each operation explained clearly before execution
- ✅ Repositories successfully found via search
- ✅ File contents successfully retrieved
- ✅ Operations verified and confirmed working
- ✅ Clear explanations help users understand MCP flow
- ✅ Summary confirms MCP integration works correctly
