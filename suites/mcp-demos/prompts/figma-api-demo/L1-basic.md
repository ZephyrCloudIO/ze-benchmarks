# MCP Figma API Operations Demo

This scenario demonstrates how MCP (Model Context Protocol) integration works with authenticated services in the ze-benchmarks system. You have access to the Figma MCP server, which provides tools for interacting with Figma files and the Figma API.

## Available MCP Tools

The Figma MCP server provides 31 tools. Key ones include:

**Authentication & User:**
- `figma_get_me` - Get current user info (verify authentication)

**Files:**
- `figma_get_file` - Retrieve complete Figma file data
- `figma_get_file_nodes` - Get specific nodes from a file
- `figma_get_images` - Export images from a file
- `figma_get_file_versions` - Get version history

**Components & Styles:**
- `figma_get_team_components` - List team components
- `figma_get_file_components` - List file components
- `figma_get_team_styles` - List team styles
- `figma_get_file_styles` - List file styles

**Comments:**
- `figma_get_comments` - List comments on a file
- `figma_post_comment` - Create a comment

**Teams & Projects:**
- `figma_get_team_projects` - List projects in a team
- `figma_get_project_files` - List files in a project

## Your Task

Demonstrate the Figma MCP integration with authentication by performing these operations:

### 1. Verify Authentication
Use the `figma_get_me` MCP tool to verify that the FIGMA_API_KEY is set up correctly. This will return information about the authenticated user.

### 2. Retrieve a Figma File
Use the `figma_get_file` MCP tool to retrieve a Figma file. You can:
- Use a public Figma community file (search for popular design systems)
- Typical file_id format: Extract from URL `https://www.figma.com/file/{file_id}/filename`
- Example community files often have IDs that start with letters/numbers

Show a summary of what's in the file (components, pages, styles, etc.)

### 3. (Optional) Demonstrate Additional Capabilities
If appropriate, use other Figma MCP tools like:
- `figma_get_file_components` - See components in the file
- `figma_get_file_styles` - See styles in the file
- `figma_get_team_projects` - See your team's projects

## Important Notes

- **Authentication Required**: These tools require `FIGMA_API_KEY` environment variable set in your `.env` file
- Get your API key from: https://www.figma.com/settings (Personal Access Tokens section)
- The harness automatically passes the FIGMA_API_KEY from process.env to the MCP server
- Be explicit about which tools you're using (e.g., "I'm using the figma_get_me MCP tool...")
- Verify each operation succeeded before moving to the next one
- If authentication fails, provide clear instructions on setting up the .env file

## Success Criteria

- Authentication is verified with figma_get_me
- Figma file data is successfully retrieved
- Clear explanations are provided throughout
- Operations are verified to confirm they worked
- If auth fails, clear guidance is provided on setup

## Authentication Setup (if needed)

If you get authentication errors, the user needs to:

1. Create/edit `.env` file in the repository root
2. Add: `FIGMA_API_KEY=your_figma_personal_access_token`
3. Get token from: https://www.figma.com/settings
4. Restart the benchmark
