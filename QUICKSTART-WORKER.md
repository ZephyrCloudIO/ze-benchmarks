# Quick Start Guide - Worker-Based Architecture

The ze-benchmarks system now requires a Cloudflare Worker to be running for all operations. This guide will get you up and running quickly.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Anthropic API key (for Claude agents)

## 5-Minute Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd ze-benchmarks
pnpm install
pnpm build
```

### 2. Configure Environment

```bash
# Create .env from example
cp .env.example .env

# Edit .env and add your Anthropic API key
# Required: ANTHROPIC_API_KEY=sk-ant-...
# Optional: OPENROUTER_API_KEY=sk-or-...
```

### 3. Initialize Database (First Time Only)

```bash
pnpm db:migrate
```

### 4. Start Everything

**Option A: Automatic (Recommended)**
```bash
./start-dev.sh
```

This starts both worker and dashboard automatically.

**Option B: Manual Control**
```bash
# Terminal 1: Worker (required!)
cd apps/worker && pnpm dev

# Terminal 2: Dashboard (optional)
pnpm dev:dashboard

# Terminal 3: Run benchmarks
pnpm bench test-suite test-scenario L0 echo
```

## Common Commands

### Development

```bash
# Start worker (always required!)
pnpm dev:worker

# Start dashboard
pnpm dev:dashboard

# Run interactive CLI
pnpm cli

# Run specific benchmark
pnpm bench <suite> <scenario> <tier> <agent>
```

### Testing

```bash
# Quick test with echo agent (no API key needed)
pnpm bench test-suite test-scenario L0 echo

# Real test with Claude
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

### Verification

```bash
# Check worker health
curl http://localhost:8787/health

# Run test suite (requires worker running!)
./test-benchmarks.sh
```

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌────────────┐
│   Harness   │────────>│ Worker API   │────────>│ D1 Database│
│   (CLI)     │         │ localhost:   │         │ (SQLite)   │
└─────────────┘         │    8787      │         └────────────┘
                        └──────────────┘
                               │
                               v
                        ┌──────────────┐
                        │  Dashboard   │
                        │  localhost:  │
                        │    3000      │
                        └──────────────┘
```

## Key Differences from Old System

### Before (SQLite)
- ❌ Worked offline
- ❌ Local file: `apps/benchmark-report/public/benchmarks.db`
- ❌ Dashboard read file directly
- ✅ Simple single-process setup

### After (Worker)
- ✅ Requires worker running
- ✅ Network-based: HTTP API at localhost:8787
- ✅ Dashboard fetches via API
- ⚠️ Multi-process setup (worker + harness)

## Troubleshooting

### "Worker not running" Error

```bash
# Start the worker
cd apps/worker && pnpm dev

# Verify it's running
curl http://localhost:8787/health
# Should return: {"status":"ok","timestamp":"..."}
```

### "Database not initialized" Error

```bash
pnpm db:migrate
pnpm dev:worker
```

### Port Already in Use

```bash
# Kill process on port 8787
lsof -ti:8787 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Build Errors

```bash
# Clean and rebuild
rm -rf packages/*/dist node_modules
pnpm install
pnpm build
```

## Next Steps

1. **Read the full README**: `README.md`
2. **Learn about testing**: `TESTING.md`
3. **Create benchmarks**: `docs/ADDING-BENCHMARKS.md`
4. **Understand migration**: `MIGRATION-COMPLETE.md`

## Available Agents

| Agent | Description | API Key |
|-------|-------------|---------|
| `echo` | Test agent (echoes prompt) | None |
| `anthropic` | Claude via Anthropic API | `ANTHROPIC_API_KEY` |
| `openrouter` | Multiple LLMs via OpenRouter | `OPENROUTER_API_KEY` |
| `claude-code` | Claude Code CLI | `ANTHROPIC_API_KEY` |

## Example Workflows

### Quick Test (No API Key)

```bash
# Terminal 1
cd apps/worker && pnpm dev

# Terminal 2
pnpm bench test-suite test-scenario L0 echo
```

### Real Benchmark

```bash
# Terminal 1
cd apps/worker && pnpm dev

# Terminal 2
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# Terminal 3
pnpm dev:dashboard
# Open http://localhost:3000
```

### Batch Testing

```bash
# Terminal 1
cd apps/worker && pnpm dev

# Terminal 2
pnpm bench update-deps nx-pnpm-monorepo --batch anthropic
# Runs L0, L1, L2 automatically
```

## Important Notes

⚠️ **The worker MUST be running** for ANY benchmark operations
⚠️ **Initialize D1 once** before first use: `pnpm db:migrate`
⚠️ **Worker must be started first** before running benchmarks
⚠️ **Dashboard connects to worker** at http://localhost:8787

## URLs

- **Worker API**: http://localhost:8787
- **Worker Health**: http://localhost:8787/health
- **Dashboard**: http://localhost:3000
- **API Docs**: See `worker/src/index.ts`

---

**Need Help?** Check `MIGRATION-COMPLETE.md` for detailed migration info or `README.md` for complete documentation.
