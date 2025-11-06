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

---

## Overview

The ze-benchmarks system is a comprehensive benchmark harness and reporting platform for evaluating AI agent performance. The system recently underwent a major architectural transformation from a file-based architecture to a distributed, API-driven architecture using Cloudflare Workers and D1 database.

### Key Goals of the Rewrite

- **Unified Architecture**: Same code path for local development and production
- **Real-time Updates**: Eliminate file sync issues with HTTP-based data flow
- **Scalability**: Edge-deployed serverless architecture
- **Type Safety**: End-to-end TypeScript with Drizzle ORM
- **Developer Experience**: Single-command startup with mprocs
- **Zero Cost**: Runs entirely on Cloudflare's free tier

---

## Architecture Transformation

### Before: File-Based Architecture

```mermaid
graph LR
    A[CLI Benchmark Harness] -->|writes| B[SQLite File]
    B -->|served as static asset| C[Frontend]
    C -->|loads with sql.js| D[Browser SQLite]

    style B fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#fcf,stroke:#333,stroke-width:2px
```

**Problems with Old Architecture:**
- File locking issues with concurrent writes
- Large SQLite file served to browser (poor performance)
- No real-time updates without page refresh
- sql.js overhead in browser
- Difficult to query and analyze data
- No API for external integrations

### After: API-Driven Architecture

```mermaid
graph TB
    subgraph "Benchmark Execution"
        A[CLI Harness]
    end

    subgraph "Cloudflare Edge"
        B[Worker API]
        C[D1 Database]
    end

    subgraph "Frontend"
        D[React App]
        E[TanStack Query]
    end

    A -->|POST /api/results| B
    B -->|SQL via Drizzle| C
    D -->|HTTP GET| B
    B -->|JSON| D
    E -->|caching & state| D

    style B fill:#f96,stroke:#333,stroke-width:2px
    style C fill:#9cf,stroke:#333,stroke-width:2px
    style E fill:#9f9,stroke:#333,stroke-width:2px
```

**Benefits of New Architecture:**
- Real-time data flow via HTTP
- Edge-deployed for global performance
- Type-safe queries with Drizzle ORM
- Efficient caching with TanStack Query
- RESTful API for any client
- Scalable serverless infrastructure

---

## System Architecture

### High-Level Component View

```mermaid
graph TB
    subgraph "Development Environment"
        CLI[Benchmark CLI]
        MPROCS[mprocs orchestrator]
    end

    subgraph "Cloudflare Infrastructure"
        WORKER[Cloudflare Worker]
        D1[(D1 Database)]
        ROUTER[itty-router]
    end

    subgraph "Frontend Application"
        REACT[React App]
        TANSTACK[TanStack Query]
        VITE[Vite Dev Server]
    end

    subgraph "Data Layer"
        DRIZZLE[Drizzle ORM]
        SCHEMA[Database Schema]
    end

    CLI -->|POST benchmark results| WORKER
    MPROCS -->|manages| WORKER
    MPROCS -->|manages| VITE

    WORKER --> ROUTER
    ROUTER --> DRIZZLE
    DRIZZLE --> SCHEMA
    SCHEMA --> D1

    REACT --> TANSTACK
    TANSTACK -->|HTTP GET| WORKER
    VITE --> REACT

    style WORKER fill:#f96,stroke:#333,stroke-width:3px
    style D1 fill:#9cf,stroke:#333,stroke-width:3px
    style TANSTACK fill:#9f9,stroke:#333,stroke-width:2px
```

### Architecture Layers

```mermaid
graph TB
    subgraph "Presentation Layer"
        A1[Dashboard UI]
        A2[Charts & Visualizations]
        A3[Data Tables]
    end

    subgraph "Data Management Layer"
        B1[TanStack Query]
        B2[API Client]
        B3[Cache Management]
    end

    subgraph "API Layer"
        C1[Worker Router]
        C2[Middleware Stack]
        C3[Request Handlers]
    end

    subgraph "Business Logic Layer"
        D1[Stats Aggregation]
        D2[Batch Processing]
        D3[Run Management]
    end

    subgraph "Data Access Layer"
        E1[Drizzle ORM]
        E2[Query Builder]
        E3[Type Inference]
    end

    subgraph "Persistence Layer"
        F1[(D1 Database)]
        F2[Schema Migrations]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> D1
    C3 --> D2
    C3 --> D3
    D1 --> E1
    D2 --> E1
    D3 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> F1
    F2 --> F1

    style C1 fill:#f96,stroke:#333,stroke-width:2px
    style E1 fill:#fc9,stroke:#333,stroke-width:2px
    style F1 fill:#9cf,stroke:#333,stroke-width:2px
```

---

## Data Flow

### Complete Benchmark Run Flow

```mermaid
sequenceDiagram
    participant CLI as Benchmark CLI
    participant Logger as BenchmarkLogger
    participant Worker as Cloudflare Worker
    participant Auth as Auth Middleware
    participant API as Submit API
    participant ORM as Drizzle ORM
    participant D1 as D1 Database
    participant Frontend as React Frontend
    participant Query as TanStack Query

    CLI->>Logger: startRun(suite, scenario, tier, agent)
    Logger->>Logger: Store in memory
    Note over Logger: Collects evaluations<br/>& telemetry
    CLI->>Logger: logEvaluation(...)
    CLI->>Logger: logTelemetry(...)
    CLI->>Logger: completeRun(scores, metadata)

    Logger->>Worker: POST /api/results
    Note over Logger,Worker: Authorization: Bearer API_KEY
    Worker->>Auth: Validate API key
    Auth-->>Worker: Authorized
    Worker->>API: submitResults(payload)
    API->>ORM: insertRun(data)
    ORM->>D1: INSERT INTO benchmark_runs
    API->>ORM: insertEvaluation(data)
    ORM->>D1: INSERT INTO evaluation_results
    API->>ORM: insertTelemetry(data)
    ORM->>D1: INSERT INTO run_telemetry
    D1-->>API: Success
    API-->>Worker: {success: true, runId}
    Worker-->>Logger: 201 Created
    Logger-->>CLI: Submission complete

    Note over Frontend: User refreshes dashboard
    Frontend->>Query: useDashboardStats()
    Query->>Worker: GET /api/stats
    Worker->>ORM: getGlobalStatistics()
    ORM->>D1: SELECT aggregated stats
    D1-->>ORM: Results
    ORM-->>Worker: Stats data
    Worker-->>Query: JSON Response
    Query-->>Frontend: Cached & rendered
```

### Local Development Data Flow

```mermaid
graph LR
    subgraph "Terminal 1: mprocs"
        M[mprocs]
    end

    subgraph "Process: Worker"
        W[wrangler dev<br/>localhost:8787]
        D1L[(Local D1 SQLite)]
    end

    subgraph "Process: Frontend"
        V[vite dev<br/>localhost:3000]
    end

    subgraph "Terminal 2: CLI"
        C[pnpm bench]
        L[BenchmarkLogger]
    end

    M -->|starts| W
    M -->|starts| V
    W --> D1L

    C --> L
    L -->|POST| W
    V -->|GET| W

    style M fill:#f9f,stroke:#333,stroke-width:2px
    style W fill:#f96,stroke:#333,stroke-width:2px
    style D1L fill:#9cf,stroke:#333,stroke-width:2px
```

### Production Data Flow

```mermaid
graph TB
    subgraph "GitHub Actions"
        GH[CI/CD Pipeline]
    end

    subgraph "Cloudflare Edge Network"
        CF[Cloudflare Workers<br/>Distributed Globally]
        D1P[(D1 Database<br/>Primary Region)]
    end

    subgraph "Static Hosting"
        CDN[Frontend on CDN<br/>Vercel/Netlify/CF Pages]
    end

    subgraph "Users"
        U1[Developer 1]
        U2[Developer 2]
        U3[Browser Users]
    end

    GH -->|POST results| CF
    CF --> D1P

    U1 -->|HTTPS| CDN
    U2 -->|HTTPS| CDN
    U3 -->|HTTPS| CDN
    CDN -->|API calls| CF

    style CF fill:#f96,stroke:#333,stroke-width:3px
    style D1P fill:#9cf,stroke:#333,stroke-width:3px
    style CDN fill:#9f9,stroke:#333,stroke-width:2px
```

---

## Component Details

### 1. Cloudflare Worker API

**Location**: `worker/src/`

```mermaid
graph TB
    subgraph "Worker Entry Point"
        A[index.ts]
    end

    subgraph "Routing Layer"
        B[itty-router]
    end

    subgraph "Middleware"
        C1[CORS Handler]
        C2[Auth Middleware]
        C3[Error Handler]
    end

    subgraph "API Endpoints"
        D1[Runs API]
        D2[Batches API]
        D3[Stats API]
        D4[Submit API]
    end

    subgraph "Database Layer"
        E1[Drizzle ORM]
        E2[Schema Definitions]
        E3[Type Inference]
    end

    subgraph "Utilities"
        F1[Response Helpers]
        F2[Type Definitions]
    end

    A --> B
    B --> C1
    B --> C2
    C1 --> D1
    C2 --> D4
    D1 --> E1
    D2 --> E1
    D3 --> E1
    D4 --> E1
    E1 --> E2
    E2 --> E3
    D1 --> F1

    style A fill:#f96,stroke:#333,stroke-width:2px
    style E1 fill:#fc9,stroke:#333,stroke-width:2px
```

**Key Files**:
- `index.ts`: Main entry point, router configuration
- `api/runs.ts`: Run queries (list, details, evaluations, telemetry)
- `api/batches.ts`: Batch operations and analytics
- `api/stats.ts`: Statistics and aggregations
- `api/submit.ts`: Result submission endpoints (authenticated)
- `db/schema.ts`: Drizzle ORM schema definitions
- `middleware/`: CORS, authentication, error handling

**Responsibilities**:
- Route HTTP requests to appropriate handlers
- Validate API authentication for write operations
- Execute type-safe database queries via Drizzle ORM
- Return JSON responses with proper CORS headers
- Handle errors gracefully with detailed messages

### 2. Database Layer (D1 + Drizzle)

**Schema**: `worker/src/db/schema.ts`

The database uses Drizzle ORM for type-safe queries against Cloudflare D1 (SQLite-compatible).

**Tables**:
1. `batch_runs`: Batch-level aggregations
2. `benchmark_runs`: Individual benchmark run records
3. `evaluation_results`: Evaluator scores for each run
4. `run_telemetry`: Token usage, cost, duration metrics

**Indexes** (for query performance):
- Suite + Scenario combination
- Agent lookup
- Status filtering
- Batch ID relationships
- Success flag filtering

### 3. CLI Benchmark Logger

**Location**: `packages/database/src/worker-logger.ts`

```mermaid
stateDiagram-v2
    [*] --> Initialized: getInstance()
    Initialized --> RunActive: startRun()
    RunActive --> CollectingData: logEvaluation()
    RunActive --> CollectingData: logTelemetry()
    CollectingData --> CollectingData: More evaluations
    CollectingData --> Submitting: completeRun() or failRun()
    Submitting --> Submitted: POST to Worker
    Submitted --> [*]: clearPendingData()

    note right of Submitting
        POST /api/results
        with Authorization header
    end note
```

**Key Features**:
- Singleton pattern for global access
- In-memory accumulation of run data
- Automatic submission on completion/failure
- Environment-based configuration
- Graceful fallback if Worker URL not configured

### 4. Frontend Architecture

**Location**: `benchmark-report/src/`

```mermaid
graph TB
    subgraph "React Application"
        A[App Entry]
        B[Router]
    end

    subgraph "State Management"
        C[QueryClientProvider]
        D[TanStack Query Cache]
    end

    subgraph "Data Layer"
        E[API Client]
        F[Custom Hooks]
        G[Query Keys]
    end

    subgraph "UI Components"
        H1[Dashboard]
        H2[Charts]
        H3[Tables]
        H4[Stats Cards]
    end

    subgraph "Backend Communication"
        I[Worker API]
    end

    A --> B
    A --> C
    C --> D
    B --> H1
    H1 --> F
    H2 --> F
    H3 --> F
    H4 --> F
    F --> E
    F --> G
    E --> I
    D --> F

    style C fill:#9f9,stroke:#333,stroke-width:2px
    style E fill:#fc9,stroke:#333,stroke-width:2px
    style I fill:#f96,stroke:#333,stroke-width:2px
```

**Key Files**:
- `lib/api-client.ts`: Type-safe API client with all endpoints
- `hooks/use-api-queries.ts`: TanStack Query hooks with cache keys
- `DatabaseProvider.tsx`: QueryClient provider (replaces old sql.js provider)
- `routes/index.tsx`: Dashboard with real-time data fetching

**Data Fetching Strategy**:
- TanStack Query for server state management
- 30-second stale time for frequently updated data
- 60-second stale time for stable data (run details)
- Automatic background refetching
- Manual refresh capability
- Client-side aggregations for complex stats

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
