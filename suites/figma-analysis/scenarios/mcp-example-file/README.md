# MCP Example File - Figma Analysis Scenario

This scenario evaluates an AI agent's ability to analyze a Figma design file and extract comprehensive design specifications.

## Setup

1. **Set Figma API Key**: Add your Figma API key to your `.env` file:
   ```bash
   FIGMA_API_KEY=example-api-key
   ```

2. **Figma File**: The scenario is configured to analyze:
   - **File ID**: `tXwpNdVwzZSVppFJjAmjSQ`
   - **File Name**: MCP-EXAMPLE-FILE
   - **URL**: https://www.figma.com/design/tXwpNdVwzZSVppFJjAmjSQ/MCP-EXAMPLE-FILE

## Running the Benchmark

```bash
# Using the Figma Design Specialist template
pnpm benchmark run figma-analysis mcp-example-file L1 --specialist figma-design-specialist

# With a specific model
pnpm benchmark run figma-analysis mcp-example-file L1 --specialist figma-design-specialist --model anthropic/claude-3.5-sonnet

# Different prompt tiers
pnpm benchmark run figma-analysis mcp-example-file L0 --specialist figma-design-specialist  # Minimal guidance
pnpm benchmark run figma-analysis mcp-example-file L2 --specialist figma-design-specialist  # Detailed guidance
```

## What Gets Evaluated

The LLM judge evaluates the agent's performance across:

1. **Design Token Extraction Accuracy (25%)**: Correctly identifies and extracts all design tokens
2. **Component Analysis Completeness (25%)**: Thoroughly documents component structures and relationships
3. **Layout Pattern Recognition (20%)**: Accurately identifies layout structures and responsive patterns
4. **Accessibility Evaluation (15%)**: Properly evaluates accessibility considerations
5. **Structured Output Quality (10%)**: Organizes information clearly and consistently
6. **Implementation Guidance (5%)**: Provides actionable implementation guidance

## Expected Agent Behavior

The agent should:
1. Use the `fetchFigmaFile` tool to retrieve the Figma file data
2. Analyze the file structure and extract design tokens
3. Document component specifications
4. Analyze layout patterns
5. Provide accessibility audit
6. Generate structured, actionable specifications

## Troubleshooting

- **"FIGMA_API_KEY environment variable not set"**: Make sure you've added the API key to your `.env` file
- **"Figma API error: 403"**: Verify the API key is correct and has access to the file
- **"No workspace prepared"**: This is expected - artifact scenarios don't use workspaces

