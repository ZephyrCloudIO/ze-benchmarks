# MCP GitHub Operations Demo

This scenario demonstrates how MCP (Model Context Protocol) integration works in the ze-benchmarks system. You have access to the GitHub MCP server, which provides tools for interacting with GitHub repositories.

## Available MCP Tools

- `search_repositories` - Search for GitHub repositories
- `get_file_contents` - Retrieve file contents from a repository
- `search_code` - Search code across GitHub
- `list_issues` - List issues in a repository
- `get_issue` - Get details of a specific issue

## Your Task

Demonstrate the MCP integration by performing these operations:

### 1. Search for MCP-related repositories
Use the `search_repositories` MCP tool to find repositories related to "MCP", "model context protocol", or "mcp servers". Explain what you're doing and show some of the results.

### 2. Retrieve a README file
Use the `get_file_contents` MCP tool to retrieve the README or documentation from one of the repositories you found. Show a summary of what's in the file.

### 3. (Optional) Demonstrate additional capabilities
If appropriate, use other GitHub MCP tools like `search_code`, `list_issues`, or `get_issue` to show more MCP capabilities.

## Important Notes

- These are MCP tools from the GitHub MCP server - the harness automatically routes your calls to the server
- Be explicit about which tools you're using (e.g., "I'm using the search_repositories MCP tool...")
- Verify each operation succeeded before moving to the next one
- Provide clear explanations to help users understand how MCP works

## Success Criteria

- GitHub MCP tools are used correctly
- Repositories are found via search
- File contents are successfully retrieved
- Clear explanations are provided throughout
- Operations are verified to confirm they worked
