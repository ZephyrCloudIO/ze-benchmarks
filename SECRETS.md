# GitHub Secrets Configuration

The following secrets need to be configured in your GitHub repository settings for the CI/CD workflow to function properly.

## Required Secrets

### Worker API Configuration

**ZE_BENCHMARKS_WORKER_URL**
- Description: URL of the Cloudflare Worker API for submitting benchmark results
- Example: `https://ze-benchmarks-api.your-account.workers.dev`
- Required: Yes

**ZE_BENCHMARKS_API_KEY**
- Description: API key for authenticating with the Worker API
- Example: A secure random string (generate with `openssl rand -hex 32`)
- Required: Yes
- Note: This must match the `API_SECRET_KEY` environment variable in your Cloudflare Worker

### Agent API Keys

**OPENROUTER_API_KEY**
- Description: API key for OpenRouter (provides access to various LLM models)
- Required: If using OpenRouter agent
- Get it from: https://openrouter.ai/

**ANTHROPIC_API_KEY**
- Description: API key for Anthropic Claude (direct API access)
- Required: If using Anthropic agent
- Get it from: https://console.anthropic.com/

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

## Local Development

For local development, create a `.env` file in the project root with the same variables:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your values
```

See `.env.example` for the full list of environment variables.
