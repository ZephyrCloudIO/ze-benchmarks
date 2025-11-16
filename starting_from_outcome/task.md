I want to validate working with the outcome in mind when creating a persona. We're going to create a new shadcn 3 agent
specialist template in this directory. We're going to iterate on this persona and create the benchmarks as we iterate.

I believe that crawling the documentation site, cloning the github repo, and the configuring the mcp will give us a
starting point for the specialist template.

From there we will need to set up some scenarios for the llms below that we will validate without the shadcn 3 expert
and with the agent specialist. As we add models each one will need a folder for us to see the starting prompt for that
model, both with and without the agent specialist, figure out a folder structure that makes it easy for us to compare.

Our goal will be to test the following activity:

# Generate New Project

This is the prompt that we will use with 'anthropic/claude-sonnet-4.5'.

Starting Prompt: "Generate a new shadcn project, use vite and add the button component"

## Control

Generate a folder called control that will follow the documentation exactly
on https://ui.shadcn.com/docs/installation/vite defaulting to the pnpm setup

## Generic LLMs

We pass only the starting prompt to the llm to see what it generates

## Shadcn specialist

Combining the starting prompt with the shadcn specialist combined prompts

## Success Criteria

### Bundler

1) If the vite bundler is used
2) If the correct version of vite is used (matches vite in control)
3) tailwindcss plugin and resolve have been properly set up in vite.config.ts (matches vite config in control)

### Package Manager

1) Correct package manager is used
2) Proper versions of `tailwindcss` and `@tailwind/vite` are installed (matches versions in control)

### Styles

1) index.css is configured correctly, tailwindcss is imported (matches styles in control)

### Types

1) tsconfig is configured with appropriate compilerOptions (matches tsconfig.json in control)
2) tsconfig.app.json is configured with appropriate compilerOptions (matches tsconfig.app.json in control)

### Components

1) `pnpm dlx shadcn@latest add button` was run for adding the button component

### Build

1) The generated project builds successfully with `pnpm build`

## Scoring

Results will be compared using ze-benchmarks scoring across different versions of the specialist template.

## Future Enhancements (Low Priority)

- Configure shadcn MCP as part of the agent specialist definition to enhance capabilities
