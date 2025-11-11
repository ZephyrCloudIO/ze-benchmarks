# ze-benchmarks Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Transformation](#architecture-transformation)
3. [System Architecture](#system-architecture)
4. [Data Flow](#data-flow)
5. [Component Details](#component-details)
6. [Database Schema](#database-schema)
7. [API Architecture](#api-architecture)
8. [Local Development](#local-development)
9. [Production Deployment](#production-deployment)
10. [Technology Stack](#technology-stack)
11. [Worker Development Guide](#worker-development-guide)

---

## Overview

The ze-benchmarks system is a comprehensive benchmark harness and reporting platform for evaluating AI agent performance. The system uses a file-based architecture with local SQLite database for simplicity and ease of use.

### Key Design Principles

- **Simplicity**: Direct file-based storage with SQLite
- **Local-First**: All data stored locally, no external dependencies required
- **Type Safety**: End-to-end TypeScript
- **Developer Experience**: Simple setup, no server required
- **Optional Cloud Sync**: Worker API available for syncing to Cloudflare D1 when needed

---

## Current Architecture

### File-Based Architecture

```mermaid
graph TB
    subgraph "Benchmark Execution"
        A[CLI Harness]
        B[BenchmarkLogger]
    end

    subgraph "Local Storage"
        C[(SQLite Database<br/>benchmarks.db)]
    end

    subgraph "Frontend"
        D[React App]
        E[sql.js WASM]
    end

    subgraph "Optional: Cloud Sync"
        F[Worker API]
        G[(D1 Database)]
        H[Sync Script]
    end

    A -->|writes| B
    B -->|writes| C
    C -->|served as static file| D
    D -->|loads with| E
    E -->|queries| C
    
    H -.->|optional sync| F
    F -.->|stores| G

    style C fill:#9cf,stroke:#333,stroke-width:3px
    style E fill:#9f9,stroke:#333,stroke-width:2px
    style F fill:#f96,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style G fill:#9cf,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

**Current Architecture Benefits:**
- **Simple Setup**: No server required, works entirely locally
- **Fast Development**: Direct file access, no network latency
- **Self-Contained**: All data in one SQLite file
- **Easy Backup**: Just copy the database file
- **Optional Cloud Sync**: Worker available for syncing to D1 when needed

**Optional Cloudflare Worker:**
- Available for syncing local SQLite data to Cloudflare D1
- Manual sync via `pnpm sync` command
- Useful for sharing data across environments or CI/CD

---

## System Architecture

### High-Level Component View

```mermaid
graph TB
    subgraph "Benchmark Execution"
        CLI[Benchmark CLI]
        LOGGER[BenchmarkLogger]
    end

    subgraph "Local Storage"
        SQLITE[(SQLite Database<br/>benchmark-report/public/benchmarks.db)]
    end

    subgraph "Frontend Application"
        REACT[React App]
        SQLJS[sql.js WASM]
        RSBUILD[Rsbuild Dev Server]
    end

    subgraph "Optional: Cloudflare Worker"
        WORKER[Cloudflare Worker]
        D1[(D1 Database)]
        SYNC[Sync Script]
    end

    CLI -->|writes| LOGGER
    LOGGER -->|writes| SQLITE
    SQLITE -->|served as static file| REACT
    REACT -->|queries via| SQLJS
    SQLJS -->|reads| SQLITE
    RSBUILD -->|serves| REACT
    
    SYNC -.->|optional| WORKER
    WORKER -.->|stores| D1

    style SQLITE fill:#9cf,stroke:#333,stroke-width:3px
    style SQLJS fill:#9f9,stroke:#333,stroke-width:2px
    style WORKER fill:#f96,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style D1 fill:#9cf,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

### Architecture Layers

```mermaid
graph TB
    subgraph "Presentation Layer"
        A1[Dashboard UI]
        A2[Charts & Visualizations]
        A3[Data Tables]
    end

    subgraph "Data Access Layer"
        B1[Database Context]
        B2[sql.js WASM]
        B3[SQL Queries]
    end

    subgraph "Persistence Layer"
        C1[(SQLite Database)]
        C2[File System]
    end

    subgraph "Benchmark Execution"
        D1[CLI Harness]
        D2[BenchmarkLogger]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> C1
    C1 --> C2
    
    D1 --> D2
    D2 --> C1

    style B2 fill:#9f9,stroke:#333,stroke-width:2px
    style C1 fill:#9cf,stroke:#333,stroke-width:3px
```

---

## Data Flow

### Complete Benchmark Run Flow

```mermaid
sequenceDiagram
    participant CLI as Benchmark CLI
    participant Logger as BenchmarkLogger
    participant SQLite as SQLite Database
    participant Frontend as React Frontend
    participant SQLJS as sql.js WASM

    CLI->>Logger: startRun(suite, scenario, tier, agent)
    Logger->>Logger: Store in memory
    Note over Logger: Collects evaluations<br/>& telemetry
    CLI->>Logger: logEvaluation(...)
    CLI->>Logger: logTelemetry(...)
    CLI->>Logger: completeRun(scores, metadata)

    Logger->>SQLite: INSERT INTO benchmark_runs
    Logger->>SQLite: INSERT INTO evaluation_results
    Logger->>SQLite: INSERT INTO run_telemetry
    SQLite-->>Logger: Success
    Logger-->>CLI: Run logged

    Note over Frontend: User opens dashboard
    Frontend->>SQLJS: initSqlJs()
    SQLJS->>SQLite: Load database file
    SQLite-->>SQLJS: Database loaded
    Frontend->>SQLJS: SELECT * FROM benchmark_runs
    SQLJS->>SQLite: Execute query
    SQLite-->>SQLJS: Results
    SQLJS-->>Frontend: Rendered in UI
```

### Local Development Data Flow

```mermaid
graph TB
    subgraph "Terminal: CLI"
        C[pnpm bench]
        L[BenchmarkLogger]
    end

    subgraph "File System"
        DB[(benchmark-report/public/benchmarks.db)]
    end

    subgraph "Frontend Dev Server"
        RS[Rsbuild Dev Server<br/>localhost:3000]
        REACT[React App]
        SQLJS[sql.js WASM]
    end

    C -->|executes| L
    L -->|writes| DB
    RS -->|serves| REACT
    REACT -->|loads| SQLJS
    SQLJS -->|reads| DB

    style DB fill:#9cf,stroke:#333,stroke-width:3px
    style SQLJS fill:#9f9,stroke:#333,stroke-width:2px
```

### Optional Cloud Sync Flow

```mermaid
graph LR
    subgraph "Local"
        DB[(Local SQLite)]
        SYNC[Sync Script<br/>pnpm sync]
    end

    subgraph "Cloudflare"
        WORKER[Worker API]
        D1[(D1 Database)]
    end

    SYNC -->|reads| DB
    SYNC -->|POST /api/results| WORKER
    WORKER -->|stores| D1

    style SYNC fill:#fc9,stroke:#333,stroke-width:2px
    style WORKER fill:#f96,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style D1 fill:#9cf,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

---

## Component Details

### 1. CLI Benchmark Logger

**Location**: `packages/database/src/logger.ts`

```mermaid
stateDiagram-v2
    [*] --> Initialized: getInstance()
    Initialized --> RunActive: startRun()
    RunActive --> CollectingData: logEvaluation()
    RunActive --> CollectingData: logTelemetry()
    CollectingData --> CollectingData: More evaluations
    CollectingData --> Writing: completeRun() or failRun()
    Writing --> Written: Write to SQLite
    Written --> [*]: clearPendingData()

    note right of Writing
        Direct SQLite writes
        using better-sqlite3
    end note
```

**Key Features**:
- Singleton pattern for global access
- In-memory accumulation of run data
- Direct SQLite writes using `better-sqlite3`
- Automatic database initialization
- Type-safe database operations

**Key Files**:
- `logger.ts`: Main BenchmarkLogger class
- `schema.ts`: Database schema definitions

### 2. Database Layer (SQLite)

**Schema**: `packages/database/src/schema.ts`

The database uses SQLite with `better-sqlite3` for CLI operations and `sql.js` WASM for browser access.

**Tables**:
1. `batch_runs`: Batch-level aggregations
2. `benchmark_runs`: Individual benchmark run records
3. `evaluation_results`: Evaluator scores for each run
4. `run_telemetry`: Token usage, cost, duration metrics

**Database Location**:
- `benchmark-report/public/benchmarks.db` - Served as static file to frontend

**Indexes** (for query performance):
- Suite + Scenario combination
- Agent lookup
- Status filtering
- Batch ID relationships
- Success flag filtering

### 3. Frontend Architecture

**Location**: `benchmark-report/src/`

```mermaid
graph TB
    subgraph "React Application"
        A[App Entry]
        B[Router]
    end

    subgraph "Database Context"
        C[DatabaseProvider]
        D[useDatabase Hook]
    end

    subgraph "Data Access Layer"
        E[sql.js WASM]
        F[SQL Queries]
        G[Database Utils]
    end

    subgraph "UI Components"
        H1[Dashboard]
        H2[Charts]
        H3[Tables]
        H4[Stats Cards]
    end

    subgraph "Static Assets"
        I[(SQLite Database File)]
    end

    A --> B
    A --> C
    C --> D
    B --> H1
    H1 --> D
    H2 --> D
    H3 --> D
    H4 --> D
    D --> E
    E --> F
    F --> G
    G --> I

    style C fill:#9f9,stroke:#333,stroke-width:2px
    style E fill:#9f9,stroke:#333,stroke-width:2px
    style I fill:#9cf,stroke:#333,stroke-width:3px
```

**Key Files**:
- `DatabaseProvider.tsx`: Context provider for database access
- `lib/database.ts`: Database initialization and query utilities
- `routes/index.tsx`: Dashboard with direct SQL queries
- `scripts/copy-wasm.js`: Script to copy sql.js WASM to public directory

**Data Access Strategy**:
- Direct SQL queries via sql.js WASM
- Database loaded once on app initialization
- Manual refresh capability via `refreshDatabase()`
- Client-side aggregations for complex stats
- No network requests required

### 4. Optional: Cloudflare Worker API

**Location**: `worker/src/`

The Worker API is optional and used only for syncing local SQLite data to Cloudflare D1.

**Key Features**:
- Manual sync via `pnpm sync` command
- Reads from local SQLite database
- Posts to Worker API endpoints
- Useful for sharing data across environments or CI/CD

**Sync Script**: `worker/scripts/sync.ts`
- Reads from `benchmark-report/public/benchmarks.db`
- Transforms data to match Worker API format
- Posts to `/api/results` and `/api/results/batch`
- Supports `--dry-run`, `--limit`, and `--force` options

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    BATCH_RUNS ||--o{ BENCHMARK_RUNS : contains
    BENCHMARK_RUNS ||--o{ EVALUATION_RESULTS : has
    BENCHMARK_RUNS ||--o| RUN_TELEMETRY : has

    BATCH_RUNS {
        text batchId PK
        timestamp createdAt
        timestamp completedAt
        int totalRuns
        int successfulRuns
        real avgScore
        real avgWeightedScore
        text metadata
    }

    BENCHMARK_RUNS {
        int id PK
        text runId UK
        text batchId FK
        text suite
        text scenario
        text tier
        text agent
        text model
        text status
        timestamp startedAt
        timestamp completedAt
        real totalScore
        real weightedScore
        bool isSuccessful
        real successMetric
        text metadata
    }

    EVALUATION_RESULTS {
        int id PK
        text runId FK
        text evaluatorName
        real score
        real maxScore
        text details
        timestamp createdAt
    }

    RUN_TELEMETRY {
        int id PK
        text runId FK
        int toolCalls
        int tokensIn
        int tokensOut
        real costUsd
        int durationMs
        text workspaceDir
    }
```

### Schema Design Principles

1. **Normalization**: Separate tables for runs, evaluations, and telemetry
2. **Batch Grouping**: Aggregate multiple runs into logical batches
3. **Performance Indexes**: Strategic indexes on frequently queried columns
4. **Type Safety**: Drizzle ORM ensures compile-time type checking
5. **Flexibility**: JSON metadata fields for extensibility

---

## API Architecture

### Endpoint Map

```mermaid
graph TB
    subgraph "Public Endpoints (No Auth)"
        R1[GET /api/runs]
        R2[GET /api/runs/:runId]
        R3[GET /api/runs/:runId/evaluations]
        R4[GET /api/runs/:runId/telemetry]

        B1[GET /api/batches]
        B2[GET /api/batches/:batchId]

        S1[GET /api/stats]
        S2[GET /api/stats/agents]

        H[GET /health]
    end

    subgraph "Protected Endpoints (Auth Required)"
        W1[POST /api/results]
        W2[POST /api/results/batch]
    end

    style W1 fill:#f99,stroke:#333,stroke-width:2px
    style W2 fill:#f99,stroke:#333,stroke-width:2px
```

### API Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant CORS
    participant Auth
    participant Handler
    participant Drizzle
    participant D1

    Client->>Worker: HTTP Request
    Worker->>CORS: Check CORS

    alt OPTIONS Request
        CORS-->>Client: CORS Headers
    else GET/POST Request
        CORS->>Auth: Continue

        alt Protected Endpoint
            Auth->>Auth: Validate Bearer Token
            alt Invalid Token
                Auth-->>Client: 401/403 Error
            else Valid Token
                Auth->>Handler: Process Request
            end
        else Public Endpoint
            CORS->>Handler: Process Request
        end

        Handler->>Drizzle: Build Query
        Drizzle->>D1: Execute SQL
        D1-->>Drizzle: Result Set
        Drizzle-->>Handler: Typed Data
        Handler-->>Worker: JSON Response
        Worker-->>Client: Response + CORS
    end
```

### Authentication Flow

```mermaid
graph LR
    A[Client Request] -->|Authorization: Bearer TOKEN| B{Check Header}
    B -->|Missing| C[401 Unauthorized]
    B -->|Present| D{Validate Token}
    D -->|Invalid| E[403 Forbidden]
    D -->|Valid| F[Process Request]

    style C fill:#f99,stroke:#333,stroke-width:2px
    style E fill:#f99,stroke:#333,stroke-width:2px
    style F fill:#9f9,stroke:#333,stroke-width:2px
```

**Authentication Details**:
- Bearer token authentication for POST endpoints
- Token stored in Worker secret: `API_SECRET_KEY`
- CLI uses environment variable: `ZE_BENCHMARKS_API_KEY`
- Simple string comparison (no JWT complexity needed)
- Local dev uses `dev-local-key` for convenience

---

## Local Development

### mprocs Orchestration

```mermaid
graph TB
    subgraph "mprocs Process Manager"
        M[mprocs.yaml]
    end

    subgraph "Process 1: Worker"
        P1[cd worker && pnpm dev]
        W[wrangler dev]
        D1[(Local D1)]
        P1 --> W
        W --> D1
    end

    subgraph "Process 2: Frontend"
        P2[cd benchmark-report && pnpm dev]
        V[vite dev]
        P2 --> V
    end

    M -->|autostart| P1
    M -->|autostart| P2

    V -->|VITE_API_URL=localhost:8787| W

    style M fill:#f9f,stroke:#333,stroke-width:3px
    style W fill:#f96,stroke:#333,stroke-width:2px
    style D1 fill:#9cf,stroke:#333,stroke-width:2px
```

**mprocs Configuration** (`mprocs.yaml`):
```yaml
procs:
  worker:
    cmd: cd worker && pnpm dev
    autostart: true
  frontend:
    cmd: cd benchmark-report && pnpm dev
    autostart: true
    env:
      VITE_API_URL: http://localhost:8787
```

### Development Workflow

```mermaid
stateDiagram-v2
    [*] --> Setup: pnpm install
    Setup --> StartServices: pnpm dev
    StartServices --> WorkerRunning: wrangler dev (8787)
    StartServices --> FrontendRunning: vite dev (3000)
    WorkerRunning --> Ready
    FrontendRunning --> Ready
    Ready --> RunBenchmark: pnpm bench
    RunBenchmark --> PostResults: POST to localhost:8787
    PostResults --> UpdateUI: Frontend fetches new data
    UpdateUI --> Ready: View dashboard
    Ready --> [*]: Ctrl+Q in mprocs
```

**Commands**:
```bash
# Initial setup
pnpm install
cd worker && pnpm install

# Create local D1 database
cd worker
wrangler d1 create ze-benchmarks
pnpm db:generate
pnpm db:push:local

# Start all services
cd ..
pnpm dev

# In another terminal - run benchmarks
export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
export ZE_BENCHMARKS_API_KEY=dev-local-key
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

---

## Production Deployment

### Deployment Architecture

```mermaid
graph TB
    subgraph "Source Control"
        GH[GitHub Repository]
    end

    subgraph "CI/CD"
        GHA[GitHub Actions]
        WD[wrangler deploy]
    end

    subgraph "Cloudflare Global Network"
        CF1[Worker Instance - US]
        CF2[Worker Instance - EU]
        CF3[Worker Instance - Asia]
        D1[(D1 Database - Primary)]
    end

    subgraph "Static Hosting"
        CDN[Frontend on CDN]
    end

    subgraph "Clients"
        CLI[CI/CD Benchmark Runs]
        USERS[Dashboard Users]
    end

    GH -->|push/merge| GHA
    GHA -->|deploy| WD
    WD --> CF1
    WD --> CF2
    WD --> CF3
    CF1 --> D1
    CF2 --> D1
    CF3 --> D1

    GH -->|deploy| CDN

    CLI -->|POST| CF1
    USERS -->|HTTPS| CDN
    CDN -->|API| CF2

    style D1 fill:#9cf,stroke:#333,stroke-width:3px
    style CF1 fill:#f96,stroke:#333,stroke-width:2px
    style CF2 fill:#f96,stroke:#333,stroke-width:2px
    style CF3 fill:#f96,stroke:#333,stroke-width:2px
```

### Deployment Steps

```mermaid
graph LR
    A[Local Development] --> B[git push]
    B --> C{GitHub Actions}

    C -->|Worker| D[wrangler deploy]
    D --> E[Cloudflare Edge]

    C -->|Frontend| F[Build static]
    F --> G[Deploy to CDN]

    E --> H[Production Live]
    G --> H

    style H fill:#9f9,stroke:#333,stroke-width:3px
```

**Worker Deployment**:
```bash
cd worker
wrangler d1 create ze-benchmarks
wrangler d1 migrations apply ze-benchmarks --remote
wrangler secret put API_SECRET_KEY
wrangler deploy
```

**Frontend Deployment**:
```bash
cd benchmark-report
VITE_API_URL=https://your-worker.workers.dev pnpm build
# Deploy dist/ to Vercel/Netlify/Cloudflare Pages
```

**GitHub Secrets Required**:
- `ZE_BENCHMARKS_WORKER_URL`: Production Worker URL
- `ZE_BENCHMARKS_API_KEY`: Matches Worker's API_SECRET_KEY
- `ANTHROPIC_API_KEY`: For running benchmarks
- `OPENROUTER_API_KEY`: For running benchmarks

---

## Technology Stack

### Complete Stack Diagram

```mermaid
graph TB
    subgraph "Frontend Stack"
        F1[React 18]
        F2[TanStack Router]
        F3[TanStack Query]
        F4[Vite]
        F5[TypeScript]
        F6[Recharts]
        F7[Tailwind CSS]
    end

    subgraph "Backend Stack"
        B1[Cloudflare Workers]
        B2[itty-router]
        B3[Drizzle ORM]
        B4[D1 Database]
        B5[TypeScript]
    end

    subgraph "Developer Tools"
        D1[pnpm]
        D2[mprocs]
        D3[wrangler CLI]
        D4[Drizzle Kit]
    end

    subgraph "Infrastructure"
        I1[Cloudflare Edge]
        I2[GitHub Actions]
        I3[CDN Hosting]
    end

    F1 --> F2
    F2 --> F3
    F4 --> F1
    F5 --> F1
    F6 --> F1
    F7 --> F1

    B1 --> B2
    B2 --> B3
    B3 --> B4
    B5 --> B1

    D1 --> F4
    D1 --> B1
    D2 --> D3
    D3 --> B1
    D4 --> B3

    B1 --> I1
    B1 --> I2
    F4 --> I3

    style B1 fill:#f96,stroke:#333,stroke-width:2px
    style B3 fill:#fc9,stroke:#333,stroke-width:2px
    style B4 fill:#9cf,stroke:#333,stroke-width:2px
    style F3 fill:#9f9,stroke:#333,stroke-width:2px
```

### Technology Choices & Rationale

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **Cloudflare Workers** | Serverless API runtime | Global edge deployment, instant cold starts, generous free tier |
| **D1 Database** | SQLite-compatible serverless DB | Integrated with Workers, familiar SQL syntax, zero-config replication |
| **Drizzle ORM** | Type-safe database queries | Best TypeScript support, zero runtime overhead, SQL-like API |
| **itty-router** | HTTP routing | Tiny bundle size (< 1KB), perfect for Workers environment |
| **TanStack Query** | Server state management | Industry-standard, built-in caching, optimistic updates, DevTools |
| **TanStack Router** | Client-side routing | Type-safe routes, file-based routing, modern React patterns |
| **Vite** | Build tool | Fast HMR, optimized builds, great DX |
| **mprocs** | Process orchestration | Simple YAML config, terminal UI, easy process management |
| **pnpm** | Package manager | Fast, efficient, workspace support |

---

## Key Architectural Decisions

### 1. Why Cloudflare Workers over traditional servers?

**Decision**: Use Cloudflare Workers instead of Express/Fastify server

**Rationale**:
- Zero cold starts (Workers are instantiated on-demand)
- Global edge deployment (low latency worldwide)
- Free tier is more than sufficient (100k requests/day)
- Integrated with D1 database
- No server management or ops overhead

### 2. Why Drizzle ORM over Prisma?

**Decision**: Use Drizzle ORM instead of Prisma

**Rationale**:
- Zero runtime dependencies (Prisma has large engine)
- Better TypeScript inference
- SQL-like query syntax (easier for SQL experts)
- Smaller bundle size (critical for Workers)
- Direct D1 support

### 3. Why TanStack Query over Redux/Zustand?

**Decision**: Use TanStack Query instead of global state managers

**Rationale**:
- Server state is fundamentally different from client state
- Built-in caching, refetching, and synchronization
- Automatic background updates
- DevTools for debugging
- Industry standard with great documentation

### 4. Why unified architecture for local and production?

**Decision**: Use same Worker + D1 architecture locally and in production

**Rationale**:
- Test the real thing during development
- No environment-specific bugs
- Simplified CI/CD (same code paths)
- Consistent developer experience

### 5. Why mprocs over docker-compose?

**Decision**: Use mprocs instead of Docker

**Rationale**:
- No Docker overhead or installation complexity
- Native process execution (faster startup)
- Simple YAML configuration
- Interactive terminal UI
- Better suited for Wrangler dev server

---

## Migration Path

### Migration Checklist

This system migrated from file-based to API-driven architecture:

- [x] Create Worker directory structure
- [x] Implement Drizzle ORM schema
- [x] Build API endpoints (runs, batches, stats, submit)
- [x] Add middleware (CORS, auth, error handling)
- [x] Create BenchmarkLogger that POSTs to Worker
- [x] Update frontend to use TanStack Query
- [x] Remove sql.js dependency
- [x] Add API client with TypeScript types
- [x] Create mprocs configuration
- [x] Update documentation
- [x] Test local development flow
- [x] Configure GitHub Actions for deployment

### Breaking Changes

**For CLI Users**:
- Must set `ZE_BENCHMARKS_WORKER_URL` environment variable
- Must set `ZE_BENCHMARKS_API_KEY` environment variable
- Old database query methods now throw errors

**For Frontend**:
- No longer loads local SQLite file
- Requires Worker API to be running
- Must set `VITE_API_URL` environment variable

### Backward Compatibility

The old SQLite-based logger remains in the codebase (`packages/database/src/logger.ts`) but its query methods throw errors directing users to the Worker API.

---

## Performance Characteristics

### Latency Profile

```mermaid
graph LR
    A[Client Request] -->|5-20ms| B[Edge Worker]
    B -->|1-5ms| C[D1 Query]
    C -->|1-5ms| D[Response]
    D -->|5-20ms| E[Client]

    style B fill:#9f9,stroke:#333,stroke-width:2px
    style C fill:#9cf,stroke:#333,stroke-width:2px
```

**Expected Latencies**:
- Worker invocation: < 1ms (already running)
- D1 query (simple): 1-5ms
- D1 query (complex aggregation): 5-20ms
- Total roundtrip: 10-50ms depending on location

### Scalability

**Cloudflare Workers**:
- Automatically scales to handle traffic
- No configuration required
- Distributed globally across 200+ data centers

**D1 Database**:
- 5 million rows read/day (free tier)
- 5 GB storage (free tier)
- Sufficient for 1000s of benchmark runs/day

### Caching Strategy

**Frontend**:
- TanStack Query cache: 30-60 seconds stale time
- Automatic background refetching
- Manual refresh capability

**Worker**:
- No server-side caching (Cloudflare handles edge caching)
- D1 has internal query optimization

---

## Security Considerations

### Authentication

**API Key Security**:
- Stored in Cloudflare Worker secrets (encrypted at rest)
- Never committed to source control
- Passed as Bearer token in Authorization header
- Simple string comparison (no complex JWT infrastructure)

**CORS Configuration**:
- Allow all origins (`*`) for public read endpoints
- No credentials required for GET endpoints
- Preflight requests handled automatically

### Data Security

- D1 database encrypted at rest
- TLS/HTTPS for all communications
- No sensitive data stored (benchmark results are non-sensitive)
- Worker runs in isolated execution environment

---

## Monitoring & Observability

### Available Metrics

**Cloudflare Dashboard**:
- Request count
- Error rate
- Response time (p50, p95, p99)
- Worker CPU time
- D1 query count

**Frontend DevTools**:
- TanStack Query DevTools for cache inspection
- Network tab for API call monitoring
- Console for error tracking

### Error Handling

```mermaid
graph TB
    A[Error Occurs] --> B{Error Type}
    B -->|Worker Error| C[Error Handler Middleware]
    B -->|D1 Error| C
    B -->|Network Error| D[Frontend Error Boundary]

    C --> E[Log to Console]
    C --> F[Return JSON Error]
    F --> G[Status Code 400/500]

    D --> H[Show Error UI]
    D --> I[Log to Console]

    style C fill:#f99,stroke:#333,stroke-width:2px
    style D fill:#f99,stroke:#333,stroke-width:2px
```

---

## Future Enhancements

### Potential Improvements

1. **Real-time Updates**: WebSocket support for live dashboard updates
2. **Advanced Analytics**: Time-series analysis, trend detection
3. **Batch Management UI**: Create and manage batches from frontend
4. **API Documentation**: Auto-generated OpenAPI spec
5. **Rate Limiting**: Protect against abuse
6. **Webhooks**: Notify external systems on benchmark completion
7. **Export Functionality**: CSV/JSON export of benchmark results
8. **Comparison Tools**: Side-by-side benchmark comparison
9. **Historical Trends**: Long-term performance tracking
10. **Multi-tenancy**: Support for multiple organizations

---

## Conclusion

This architecture transformation represents a significant modernization of the ze-benchmarks system:

**From**: File-based, browser-loaded SQLite
**To**: API-driven, edge-deployed, serverless architecture

**Key Achievements**:
- ✅ Unified local and production environments
- ✅ Real-time data flow via HTTP
- ✅ Type-safe end-to-end TypeScript
- ✅ Zero-cost infrastructure
- ✅ Scalable and globally distributed
- ✅ Excellent developer experience

The new architecture provides a solid foundation for future enhancements while maintaining simplicity and ease of use.

---

## Worker Development Guide

This section provides comprehensive guides for working with the Cloudflare Worker and D1 database.

### Starting the Worker Server

#### Quick Start

**Local D1 (default):**
```bash
cd worker
pnpm dev
```

This starts the Worker on **http://localhost:8787** using **local D1 database**.

**Remote D1 (Cloudflare):**
```bash
cd worker
pnpm dev:remote
```

This starts the Worker on **http://localhost:8787** but connects to **remote D1 database** on Cloudflare.

**Start Everything (Worker + Frontend):**
```bash
# From root directory
pnpm dev
```

This starts:
- **Worker** on `http://localhost:8787`
- **Frontend** on `http://localhost:3000`

#### Production Deployment

To deploy the Worker to Cloudflare:

```bash
cd worker
pnpm run deploy
```

**Note:** Use `pnpm run deploy` (not `pnpm deploy`) because `deploy` is a script, not a workspace command.

This will give you a URL like:
- `https://ze-benchmarks-api.your-subdomain.workers.dev`

#### Verify Server is Running

**Check Local Worker:**
```bash
curl http://localhost:8787/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-11-11T00:00:00.000Z"}
```

**Check Remote Worker:**
```bash
curl https://your-worker.workers.dev/health
```

### Local vs Remote D1 in Development

When running `wrangler dev`, you can choose to use either **local D1** or **remote D1** (Cloudflare).

| Command | D1 Database | Use Case |
|---------|-------------|----------|
| `pnpm dev` | **Local D1** | Fast development, no Cloudflare needed |
| `pnpm dev:remote` | **Remote D1** | Test against production database |

#### Local D1 (Default)

**What happens:**
- Worker runs on `http://localhost:8787`
- Uses **local D1 database** (stored in `.wrangler/state/v3/d1/`)
- Fast startup, no network calls
- Data is stored locally on your machine
- Good for: Development, testing, prototyping

**Output shows:**
```
env.DB (ze-benchmarks)               D1 Database               local
```

#### Remote D1 (Cloudflare)

**What happens:**
- Worker runs on `http://localhost:8787` (still localhost)
- Connects to **remote D1 database** on Cloudflare
- Slower startup (needs to connect to Cloudflare)
- Data is stored in Cloudflare
- Good for: Testing against production data, debugging production issues

**Output shows:**
```
env.DB (ze-benchmarks)               D1 Database               remote
```

#### When to Use Each

**Use Local D1 (`pnpm dev`) when:**
- ✅ Developing new features
- ✅ Testing locally
- ✅ Don't need production data
- ✅ Want fast iteration
- ✅ Working offline

**Use Remote D1 (`pnpm dev:remote`) when:**
- ✅ Testing against production database
- ✅ Debugging production issues
- ✅ Need to see real data
- ✅ Testing migrations on remote database
- ✅ Verifying remote database connectivity

#### Configuration

Make sure your `wrangler.toml` has:
```toml
[[ d1_databases ]]
binding = "DB"
database_name = "ze-benchmarks"
database_id = "your-database-id"  # Required for remote
preview_database_id = "your-preview-database-id"  # For dev:remote
```

**Note:** For remote D1, you need a valid `database_id` in `wrangler.toml`. For `dev:remote`, use `preview_database_id` to avoid affecting production.

### Database Setup

#### Issue: "Couldn't find a D1 DB" Error

If you see this error when running `pnpm db:push:local`:

```
✘ [ERROR] Couldn't find a D1 DB with the name or binding 'ze-benchmarks' in your wrangler.toml file.
```

This means the local D1 database hasn't been initialized yet.

#### Solution

**Option 1: Initialize with wrangler dev (Recommended)**

Local D1 databases are automatically created when you run `wrangler dev`.

1. **Start the worker** (this initializes the local D1 database):
   ```bash
   cd worker
   pnpm dev
   ```
   Let it run for a few seconds, then stop it (Ctrl+C).

2. **Now run the migration:**
   ```bash
   pnpm db:push:local
   ```

**Option 2: Use Wrangler Auto-Migrations**

Wrangler can auto-apply migrations when you run `wrangler dev` if `migrations_dir` is set in `wrangler.toml` (which it is).

1. **Just run the worker:**
   ```bash
   cd worker
   pnpm dev
   ```

2. Wrangler will automatically apply migrations from the `drizzle/` folder.

**Option 3: Create Remote Database**

If you need a remote database:

1. **Create the D1 database** (requires Cloudflare account):
   ```bash
   cd worker
   wrangler d1 create ze-benchmarks
   ```

2. **Copy the database_id** from the output and update `wrangler.toml`:
   ```toml
   database_id = "your-database-id-here"
   ```

3. **Apply migrations to remote:**
   ```bash
   pnpm db:push:remote
   ```

#### Check Database State

Before applying migrations, check if tables already exist:

```bash
cd worker
# Check local database
pnpm db:check

# Check remote database
pnpm db:check:remote
```

#### Error: "table already exists"

If you see this error:
```
✘ [ERROR] table `batch_runs` already exists
```

This means the migration was already applied. You can:
1. **Skip the migration** - Tables already exist, no action needed
2. **Check database state** - Run `pnpm db:check` or `pnpm db:check:remote` to verify
3. **Use Wrangler auto-migrations** - If `migrations_dir` is set, Wrangler tracks applied migrations

### Drizzle Commands Explained

#### `db:generate` → `drizzle-kit generate`

**What it does:**
- Reads your TypeScript schema from `src/db/schema.ts`
- Compares it with existing migrations
- Generates new migration SQL files in `drizzle/` folder
- Creates files like `0000_quiet_turbo.sql`, `0001_something.sql`, etc.

**When to use:**
- After modifying `src/db/schema.ts`
- Before applying schema changes to database
- Creates migration history for version control

**Example:**
```bash
# 1. Edit src/db/schema.ts (add a new column, table, etc.)
# 2. Generate migration file
pnpm db:generate
# 3. Review the generated SQL in drizzle/0001_*.sql
# 4. Apply it with db:push:local or db:push:remote
```

#### `db:push:local` → `wrangler d1 execute ze-benchmarks --local --file=./drizzle/0000_quiet_turbo.sql`

**What it does:**
- Manually executes a SQL migration file
- Applies it to your **local D1 database** (used by `wrangler dev`)
- Uses Wrangler CLI to execute SQL directly

**When to use:**
- After generating migrations with `db:generate`
- To set up local database schema
- When you need to manually apply a specific migration file

**Note:** This executes a specific file. If you have multiple migrations, you need to run them in order.

#### `db:push:remote` → `wrangler d1 execute ze-benchmarks --remote --file=./drizzle/0000_quiet_turbo.sql`

**What it does:**
- Same as `db:push:local`, but for **remote/production D1 database**
- Applies migrations to your Cloudflare D1 database in the cloud

**When to use:**
- After testing migrations locally
- To update production database schema
- **⚠️ Be careful** - this modifies production data!

#### Wrangler Auto-Migrations

When `migrations_dir = "drizzle"` is set in `wrangler.toml`:
- Wrangler **automatically applies migrations** when you run `wrangler dev`
- Migrations are applied in order based on timestamp
- You may still need to run `db:push:local` manually for a fresh database

#### Summary

| Command | Purpose | Creates Files? | Applies to DB? |
|---------|---------|----------------|----------------|
| `db:generate` | Generate migration files | ✅ Yes | ❌ No |
| `db:push:local` | Apply migrations (local) | ❌ No | ✅ Yes |
| `db:push:remote` | Apply migrations (remote) | ❌ No | ✅ Yes |

**For this project:** Use `db:generate` + `db:push:local/remote` for migration-based workflow.

### Syncing Data to Remote D1

The sync script sends data from local SQLite to Cloudflare D1 via the Worker API.

#### Key Concept

The sync script sends data to a **Worker API**, and the Worker writes to its configured D1 database:
- **Local Worker** (`http://localhost:8787`) → writes to **Local D1**
- **Remote Worker** (`https://your-worker.workers.dev`) → writes to **Remote D1**

#### Prerequisites

1. **Install dependencies:**
   ```bash
   cd worker
   pnpm install
   ```

2. **Ensure database migrations are applied:**
   - For local D1: `cd worker && pnpm db:push:local`
   - For remote D1: `cd worker && pnpm db:push:remote`

3. **Ensure Worker is running:**
   - For local: `cd worker && pnpm dev` (runs on http://localhost:8787)
   - For production: Ensure Worker is deployed and accessible

4. **Set environment variables:**
   
   **For LOCAL D1 (localhost):**
   ```bash
   export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
   export ZE_BENCHMARKS_API_KEY=dev-local-key
   ```
   
   **For REMOTE D1 (Cloudflare production):**
   ```bash
   export ZE_BENCHMARKS_WORKER_URL=https://your-worker.your-subdomain.workers.dev
   export ZE_BENCHMARKS_API_KEY=your-production-api-key
   ```

#### Usage

**Sync to LOCAL D1:**
```bash
cd worker
export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
export ZE_BENCHMARKS_API_KEY=dev-local-key
# Make sure local Worker is running: pnpm dev
pnpm sync
```

**Sync to REMOTE D1:**

1. **Deploy your Worker:**
   ```bash
   cd worker
   pnpm run deploy
   ```

2. **Set environment variables:**
   ```bash
   export ZE_BENCHMARKS_WORKER_URL=https://your-worker.your-subdomain.workers.dev
   export ZE_BENCHMARKS_API_KEY=your-production-api-key
   ```

3. **Run the sync:**
   ```bash
   cd worker
   pnpm sync
   ```

**Sync Options:**
- `--dry-run`: Preview what would be synced without actually syncing
- `--limit N`: Only sync first N records per table
- `--force`: Skip duplicate checks and force insert

#### How It Works

1. **Reads from local SQLite**: Opens `benchmark-report/public/benchmarks.db`
2. **Transforms data**: Converts local SQLite format to Worker API format
3. **Posts to Worker API**: Uses existing `/api/results` and `/api/results/batch` endpoints
4. **Tracks progress**: Shows what's being synced and any errors

**Data Flow:**
```
Local SQLite → Transform → Worker API → D1 Database
```

**Sync Order:**
1. **Batches first** (`batch_runs` table)
2. **Runs second** (`benchmark_runs` table with evaluations and telemetry)

This order ensures foreign key relationships are maintained.

#### Troubleshooting

**Error: Cannot connect to Worker API**
- Make sure the Worker is running (`pnpm dev` in worker directory)
- Check `ZE_BENCHMARKS_WORKER_URL` environment variable

**Error: Database schema not initialized**
- Run migrations: `cd worker && pnpm db:push:local` (for local) or `pnpm db:push:remote` (for remote)
- If using `wrangler dev`, migrations should auto-apply, but you may need to run them manually for a fresh database

**Error: Local database not found**
- Ensure you have run benchmarks locally first
- Check that `benchmark-report/public/benchmarks.db` exists

**Error: Authentication failed**
- Check `ZE_BENCHMARKS_API_KEY` environment variable
- For local dev, use `dev-local-key`
- For production, use the API key set in Worker secrets

**Still syncing to local?**
- Check: `echo $ZE_BENCHMARKS_WORKER_URL`
- Should be your production URL, not `http://localhost:8787`
- The sync script will warn you if it detects localhost

### Common Issues

#### "Port 8787 already in use"
```bash
# Find and kill the process
lsof -ti:8787 | xargs kill -9
# Then start again
cd worker && pnpm dev
```

#### "Database not found"
```bash
# Initialize local D1 first
cd worker
pnpm dev  # This auto-initializes local D1
# Or manually apply migrations
pnpm db:push:local
```

#### "Cannot connect to Worker"
- Make sure Worker is running: `pnpm dev` in worker directory
- Check the URL: Should be `http://localhost:8787` for local
- Verify with: `curl http://localhost:8787/health`

#### "Database not found" with remote
- Make sure `database_id` is set in `wrangler.toml`
- Verify the database exists: `wrangler d1 list`
- Check you're authenticated: `wrangler whoami`

#### "Cannot connect to remote D1"
- Check your internet connection
- Verify Cloudflare authentication: `wrangler login`
- Make sure the database exists in your Cloudflare account
