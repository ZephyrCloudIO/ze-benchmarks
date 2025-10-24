# Benchmark Reports & Insights Plan

## Overview
This document outlines the proposed reports and insights for the Ze Benchmarks reporting dashboard. The goal is to provide actionable insights from benchmark data to help evaluate and improve AI agent performance.

## Available Data

### Database Schema
- **benchmark_runs**: Main table tracking each benchmark run with suite, scenario, tier, agent, model, status, scores, and timestamps
- **evaluation_results**: Individual evaluator scores and details for each run
- **run_telemetry**: Performance metrics including tool calls, tokens (in/out), cost, duration, and workspace directory
- **batch_runs**: Batch job metadata for grouped benchmark executions

### Key Metrics
1. **Performance Scores**
   - Total Score (average across all evaluators)
   - Weighted Score (out of 10, with custom weights)
   - Individual evaluator scores (install_success, tests_nonregression, manager_correctness, dependency_targets, integrity_guard)
   - LLM Judge scores with 7 categories (dependency_quality, safety_stability, best_practices, etc.)

2. **Telemetry Data**
   - Tool calls count
   - Tokens: input and output
   - Cost (USD)
   - Duration (milliseconds)

3. **Metadata**
   - Suite, Scenario, Tier (L0-L3, Lx)
   - Agent type (echo, anthropic, claude-code)
   - Model (claude-3-5-sonnet, claude-3-5-haiku, etc.)
   - Status (running, completed, failed)
   - Timestamps (started_at, completed_at)

---

## Proposed Report Pages

### 1. Executive Dashboard
**Purpose**: High-level overview of benchmark system health and performance

**Key Visualizations**:
- **Performance Overview Cards** → `card` component
  - 4 metric cards in responsive grid layout
  - Total runs count
  - Success rate percentage with trend badge
  - Average weighted score with trend indicator
  - Average cost per run
  - Each card shows current value + comparison to previous period

- **Score Distribution Chart** → `chart` (Bar chart)
  - Distribution of weighted scores across all runs
  - Color-coded by score ranges (Excellent: >9.0, Good: 7.0-9.0, Needs Work: <7.0)
  - Interactive tooltip on hover showing count and percentage

- **Recent Activity Timeline** → `chart` (Line chart)
  - Runs per day/week over last 30 days
  - Success vs failure rates over time
  - Multi-series line chart with legend

- **Top Performers Table** → `table` + `badge` + `avatar`
  - Best performing agent/model combinations
  - Columns: Rank, Agent/Model (with icon), Avg Score, Run Count, Avg Cost
  - Badge for status, sortable columns

**Filters**:
- Date range → `calendar` + `popover` + `button`
- Suite/Scenario → `select` (multi-select)
- Agent → `select` (multi-select)
- Status → `checkbox` group

---

### 2. Agent Performance Dashboard
**Purpose**: Compare and analyze different agents and models

**Key Visualizations**:
- **Agent Comparison Grid** → `card` (grid layout)
  - Side-by-side comparison cards for each agent
  - Each card shows: Avg Score, Success Rate, Avg Cost, Avg Duration, Total Runs
  - Click to drill down into agent details

- **Model Performance Rankings** → `card` + `badge` + `avatar`
  - Leaderboard-style list with ranking
  - Show: Rank (with 🥇🥈🥉 for top 3), Model name with icon, Score, Cost efficiency, Run count
  - Badges for performance tiers
  - Sortable by different metrics

- **Agent vs Model Heatmap** → Custom grid + `tooltip`
  - Color-coded grid cells (green = high score, red = low score)
  - Interactive tooltips showing detailed stats on hover
  - Click cell to filter data by agent+model combination

- **Score Breakdown by Agent** → `chart` (Stacked Bar)
  - Stacked bar chart showing individual evaluator contributions
  - Legend with evaluator names
  - Helps identify strengths/weaknesses per agent

- **Cost vs Performance Scatter** → `chart` (Scatter plot)
  - X-axis: Average cost per run
  - Y-axis: Average weighted score
  - Bubble size: number of runs
  - Tooltip with agent/model details
  - Helps identify best value agents/models

**Filters**:
- Date range → `calendar` + `popover`
- Suite → `select`
- Scenario → `select` (dependent on suite)
- Tier → `checkbox` group
- Model → `select` (multi-select)

---

### 3. Suite & Scenario Analysis
**Purpose**: Deep dive into specific test suites and scenarios

**Key Visualizations**:
- **Suite Performance Summary Cards**
  - One card per suite showing:
    - Total runs, Success rate
    - Average score with trend
    - Best performing agent
  - Click to drill down into scenarios

- **Scenario Comparison Table**
  - Sortable/filterable table with:
    - Scenario name, Suite
    - Runs, Success rate
    - Avg score, Min/Max scores
    - Best agent, Worst agent

- **Tier Performance Analysis** (Grouped bar chart)
  - Group by tier (L0, L1, L2, L3, Lx)
  - Show average scores per tier
  - Compare across agents

- **Scenario Deep Dive View** (Detail page)
  - Historical trend line chart for selected scenario
  - Agent performance breakdown
  - Recent runs table with status and scores
  - Evaluator score breakdown (radar chart)

**Filters**: Suite, Scenario, Tier, Agent, Date range

---

### 4. Evaluator Performance
**Purpose**: Analyze individual evaluator effectiveness and patterns

**Key Visualizations**:
- **Evaluator Rankings** (Horizontal bar chart)
  - Evaluators sorted by average score
  - Show pass rate percentage per evaluator

- **Evaluator Score Distribution** (Box plot)
  - Show score distribution for each evaluator
  - Identify evaluators with high variance

- **Evaluator Trends Over Time** (Multi-line chart)
  - Line per evaluator showing score trends
  - Identify improving or degrading evaluators

- **Evaluator Correlation Matrix**
  - Show correlations between different evaluator scores
  - Helps identify redundant or complementary evaluators

- **LLM Judge Detailed Analysis** (dedicated section)
  - Breakdown of 7 categories with weights
  - Category-specific trends
  - Compare category scores across agents

**Filters**: Date range, Agent, Suite, Scenario

---

### 5. Cost & Efficiency Analysis
**Purpose**: Track spending and optimize for cost-efficiency

**Key Visualizations**:
- **Cost Overview Cards**
  - Total cost (all time)
  - Cost this month/week
  - Average cost per run
  - Cost trend (% change)

- **Cost Breakdown** (Pie/Donut chart)
  - Cost distribution by:
    - Agent type
    - Model
    - Suite

- **Cost Over Time** (Area chart)
  - Stacked by agent/model
  - Show cumulative and daily costs

- **Cost Efficiency Table**
  - Metrics: Agent, Model, Avg Cost, Avg Score, Score/Cost ratio
  - Sortable to find best value options

- **Token Usage Analysis**
  - Input vs Output tokens over time
  - Tokens per agent/model
  - Token efficiency (tokens per score point)

- **Duration Analysis**
  - Average runtime by agent/model
  - Duration vs score correlation
  - Identify slow performers

**Filters**: Date range, Agent, Model, Suite

---

### 6. Batch Run Analysis
**Purpose**: Track and compare batch executions

**Key Visualizations**:
- **Batch History Table**
  - Recent batches with:
    - Batch ID, Created date, Duration
    - Total runs, Successful runs, Success rate
    - Avg score, Avg cost

- **Batch Comparison View**
  - Select 2-4 batches to compare
  - Side-by-side metrics
  - Score distributions overlay

- **Batch Detail View** (drill-down)
  - Individual runs within batch
  - Performance variance chart
  - Best/worst runs
  - Batch metadata display

**Filters**: Date range, Status (completed/incomplete)

---

### 7. Trends & Historical Analysis
**Purpose**: Identify patterns and track improvements over time

**Key Visualizations**:
- **Performance Trends** (Multi-line chart)
  - Score trends over time
  - Separate lines for different agents/models
  - Moving average overlay

- **Success Rate Trends** (Line chart)
  - Track success rate over time
  - Compare across agents

- **Improvement Tracking** (Change matrix)
  - Week-over-week or month-over-month changes
  - Color-coded: green (improvement), red (decline)

- **Seasonal Patterns** (Heatmap calendar)
  - Day-by-day activity and performance
  - Identify busy periods

**Filters**: Date range, Granularity (daily/weekly/monthly)

---

### 8. Run Details View
**Purpose**: Detailed inspection of individual benchmark runs

**Key Visualizations**:
- **Run Info Card** → `card` + `badge` + `separator`
  - All metadata displayed in structured layout
  - Suite, Scenario, Tier, Agent, Model
  - Status badge (completed/failed/running)
  - Timestamps (started, completed, duration)
  - Workspace directory as copyable link/path
  - Action buttons (Re-run, Compare, Export)

- **Score Breakdown** → `progress` + `tooltip` + `card`
  - Visual progress bars for each score
  - Total and weighted scores prominently displayed
  - Individual evaluator scores with color coding
    - Green (>90%), Yellow (70-90%), Red (<70%)
  - Tooltips on hover showing exact values
  - LLM Judge category scores in separate expandable section

- **Telemetry Details** → `card` grid layout
  - 4-column responsive grid of metric cards
  - Tool calls count with icon
  - Tokens in/out with total and breakdown
  - Cost in USD with formatted currency
  - Duration in human-readable format

- **Evaluation Details** → `accordion`
  - Expandable accordion for each evaluator
  - Per-evaluator details text
  - Diff summaries if available (with syntax highlighting)
  - Dependency deltas in table format
  - Pass/fail status per evaluation

- **Compare with Similar Runs** → `table` + `button`
  - Automatically show 5 most recent runs of same scenario
  - Quick comparison table with key metrics
  - Select multiple runs to compare side-by-side
  - Button to open detailed comparison view in `dialog`

---

## Advanced Insights & Analytics

### Correlation Analysis
- **Score vs Cost Correlation**
  - Identify optimal cost/performance trade-offs
  - Highlight outliers (high cost, low score OR low cost, high score)

- **Duration vs Performance**
  - Do longer runs perform better?
  - Identify hanging/slow runs

- **Tool Call Efficiency**
  - Tool calls vs score correlation
  - Which agents use tools most effectively?

### Anomaly Detection
- **Score Anomalies**
  - Flag runs with unusually low scores
  - Detect sudden performance drops

- **Cost Anomalies**
  - Identify unexpectedly expensive runs
  - Alert on cost spikes

- **Duration Anomalies**
  - Detect runs that took unusually long
  - Potential timeout issues

### Predictive Insights
- **Performance Forecasting**
  - Predict future average scores based on trends
  - Estimate when agent will reach target performance

- **Cost Forecasting**
  - Project monthly costs based on run frequency
  - Budget planning assistance

### Recommendation Engine
- **Best Agent/Model for Scenario**
  - Based on historical data, recommend optimal agent/model for new runs
  - Consider score, cost, and duration

- **Optimization Suggestions**
  - Identify scenarios where agents consistently struggle
  - Suggest parameter adjustments (e.g., max_turns)

---

## Technical Implementation Notes

### Data Access Layer
- Use existing BenchmarkLogger methods:
  - `getRunHistory()` - recent runs
  - `getStats()` - overall statistics with filters
  - `getSuiteStats()` - suite-level data
  - `getScenarioStats()` - scenario-level data
  - `getDetailedRunStats()` - single run details
  - `getModelPerformanceStats()` - model comparison
  - `getBatchHistory()` / `getBatchDetails()` - batch data

### Additional Queries Needed
Some proposed reports may need new database queries:
- Time-series aggregations (daily/weekly/monthly rollups)
- Cost aggregations by various dimensions
- Token usage aggregations
- Correlation calculations
- Percentile calculations for scores/costs

### UI Component Library: shadcn/ui

We will use **shadcn/ui** for all UI components wherever possible. shadcn/ui provides beautifully designed, accessible components built on Radix UI with Tailwind CSS.

**Key shadcn/ui components to install:**

#### Core Components
- `card` - For metric cards, summary cards, content containers
- `table` - For data tables with sorting/filtering
- `button` - For all actions and CTAs
- `badge` - For status indicators, tags, labels
- `separator` - For visual dividers

#### Form & Filter Components
- `select` - For dropdown filters (agent, model, suite, scenario)
- `calendar` + `popover` - For date range pickers
- `checkbox` - For multi-select filters
- `radio-group` - For single-select options
- `input` - For search and text inputs
- `label` - For form labels
- `slider` - For range filters (score range, cost range)
- `switch` - For toggle options (show/hide features)

#### Navigation & Layout
- `tabs` - For tabbed views (different report sections)
- `accordion` - For expandable sections (evaluator details)
- `breadcrumb` - For navigation breadcrumbs
- `dropdown-menu` - For action menus and more options
- `command` - For quick search/command palette
- `scroll-area` - For scrollable content areas

#### Data Display
- `progress` - For score progress bars
- `tooltip` - For hover information on charts/data points
- `avatar` - For agent/model icons
- `alert` - For warnings, errors, info messages
- `dialog` / `sheet` - For modals and slide-over panels

#### Loading & Empty States
- `skeleton` - For loading states
- Custom empty state components with illustrations

#### Charts (shadcn/ui + Recharts)
shadcn/ui provides a **Chart component system** built on top of Recharts:
- `chart` - Base chart components with consistent theming
- **Chart types available:**
  - Line charts (trends, time series)
  - Bar charts (comparisons, distributions)
  - Area charts (cumulative data, stacked metrics)
  - Pie/Donut charts (proportions, breakdowns)
  - Radar charts (multi-dimensional comparisons)
  - Scatter plots (correlations)

**Benefits of shadcn/ui Charts:**
- Consistent design language with the rest of the app
- Built-in responsive behavior
- Accessible tooltips and legends
- Easy theming with CSS variables
- TypeScript support

#### Additional Libraries (if needed beyond shadcn)
- **Recharts** (underlying library for shadcn charts) - For advanced customizations
- **date-fns** or **day.js** - For date manipulation with calendar component
- **react-hot-toast** or shadcn's `sonner` - For toast notifications

### UI/UX Considerations
- **Responsive Design**: Works on desktop and tablets
- **Loading States**: Show skeletons while data loads
- **Empty States**: Handle gracefully when no data
- **Export Functionality**: Export charts/tables to CSV/PNG
- **Bookmarkable Views**: URL-based state for sharing
- **Real-time Updates**: Optional auto-refresh for ongoing runs

---

## Component Mapping: Visualizations → shadcn/ui

This section maps each visualization type mentioned in the reports to specific shadcn/ui components.

### Executive Dashboard (Page 1)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Performance Overview Cards | `card` | Use card component with custom metric display |
| Score Distribution Chart | `chart` (Bar chart) | shadcn bar chart with color coding |
| Recent Activity Timeline | `chart` (Line chart) | Multi-series line chart for runs over time |
| Top Performers Table | `table` + `badge` | Data table with status badges |
| Date Range Filter | `calendar` + `popover` + `button` | Date range picker in popover |
| Suite/Agent Filters | `select` or `dropdown-menu` | Multi-select dropdowns |

### Agent Performance Dashboard (Page 2)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Agent Comparison Grid | `card` grid layout | Multiple cards in responsive grid |
| Model Performance Rankings | `card` + `badge` + `avatar` | Leaderboard with medal badges |
| Agent vs Model Heatmap | Custom `div` grid + `tooltip` | Color-coded cells with hover tooltips |
| Score Breakdown by Agent | `chart` (Stacked Bar) | Stacked bar chart for evaluator scores |
| Cost vs Performance Scatter | `chart` (Scatter plot) | Bubble chart with tooltips |
| Filters | `select` + `calendar` + `checkbox` | Multiple filter types |

### Suite & Scenario Analysis (Page 3)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Suite Performance Cards | `card` + `button` | Clickable cards for drill-down |
| Scenario Comparison Table | `table` + `badge` | Sortable table with status indicators |
| Tier Performance Analysis | `chart` (Grouped Bar) | Grouped bars by tier |
| Scenario Deep Dive View | `tabs` + multiple charts | Tabbed interface for different views |
| Historical Trend Chart | `chart` (Line chart) | Time-series performance |
| Evaluator Breakdown | `chart` (Radar chart) | Multi-axis radar for evaluators |
| Recent Runs Table | `table` + `badge` + `tooltip` | Interactive table |

### Evaluator Performance (Page 4)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Evaluator Rankings | `chart` (Horizontal Bar) | Sorted horizontal bars |
| Score Distribution | Custom box plot with `chart` | May need custom Recharts component |
| Evaluator Trends | `chart` (Multi-line) | Multiple time-series lines |
| Correlation Matrix | Custom heatmap grid + `tooltip` | Color-coded grid with correlations |
| LLM Judge Analysis | `accordion` + `progress` + `chart` | Expandable sections with progress bars |

### Cost & Efficiency Analysis (Page 5)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Cost Overview Cards | `card` | Metric cards with trend indicators |
| Cost Breakdown | `chart` (Pie/Donut) | Proportional breakdown |
| Cost Over Time | `chart` (Area chart) | Stacked area for cumulative costs |
| Cost Efficiency Table | `table` | Sortable comparison table |
| Token Usage Chart | `chart` (Stacked Bar) | Input vs output tokens |
| Duration Analysis | `chart` (Bar chart) + `table` | Duration metrics |

### Batch Run Analysis (Page 6)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Batch History Table | `table` + `badge` | Status and metrics |
| Batch Comparison | Multiple `card` components | Side-by-side comparison |
| Batch Detail View | `dialog` or `sheet` + charts | Modal or slide-over panel |
| Performance Variance | `chart` (Box plot or Line) | Distribution visualization |

### Trends & Historical Analysis (Page 7)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Performance Trends | `chart` (Multi-line) | Multiple trend lines |
| Success Rate Trends | `chart` (Line chart) | Time-series success rates |
| Improvement Tracking | Custom grid + `badge` | Color-coded change indicators |
| Seasonal Patterns | Custom calendar heatmap | May use `calendar` as base |
| Granularity Toggle | `tabs` or `radio-group` | Switch between daily/weekly/monthly |

### Run Details View (Page 8)

| Visualization | shadcn Component(s) | Notes |
|--------------|---------------------|-------|
| Run Info Card | `card` + `badge` | Metadata display with status badge |
| Score Breakdown | `progress` + `tooltip` | Progress bars with hover details |
| Telemetry Details | `card` grid layout | Info cards in grid |
| Evaluation Details | `accordion` | Expandable per-evaluator details |
| Compare Similar Runs | `table` + `button` | Comparison table with action buttons |

### Shared/Common Components

| UI Element | shadcn Component(s) | Notes |
|-----------|---------------------|-------|
| Page Header | `div` with typography | Consistent heading styles |
| Loading States | `skeleton` | Skeleton screens for all components |
| Empty States | `alert` or custom `card` | Friendly empty state messages |
| Error States | `alert` | Error messages with retry option |
| Export Buttons | `button` + `dropdown-menu` | Export to CSV/PNG options |
| Refresh Button | `button` | Manual refresh trigger |
| Filter Panel | `sheet` or inline `card` | Collapsible filter sidebar |
| Search | `input` + `command` | Search bar with command palette |
| Notifications | `sonner` or `toast` | Success/error notifications |

---

## shadcn/ui Installation Commands

To install all recommended components:

```bash
# Core components
npx shadcn@latest add card table button badge separator

# Form & Filter components
npx shadcn@latest add select calendar popover checkbox radio-group input label slider switch

# Navigation & Layout
npx shadcn@latest add tabs accordion breadcrumb dropdown-menu command scroll-area

# Data Display
npx shadcn@latest add progress tooltip avatar alert dialog sheet

# Loading & Feedback
npx shadcn@latest add skeleton sonner

# Charts
npx shadcn@latest add chart
```

**Note:** Install components as needed during development. Start with the MVP components first (card, table, button, chart, select, calendar).

---

## Priority Ranking

### Phase 1 (MVP) - Essential Views
1. Executive Dashboard (high-level overview)
2. Run Details View (drill-down capability)
3. Agent Performance Dashboard (core comparison)

### Phase 2 - Extended Analytics
4. Suite & Scenario Analysis
5. Cost & Efficiency Analysis
6. Evaluator Performance

### Phase 3 - Advanced Features
7. Trends & Historical Analysis
8. Batch Run Analysis
9. Advanced Insights & Analytics

---

## Next Steps

### 1. Setup & Configuration
- [x] Initialize TanStack Router with routes
- [x] Configure tailwindcss and shadcn/ui
- [x] Install MVP shadcn components:
  ```bash
  npx shadcn@latest add card table button badge chart
  npx shadcn@latest add select calendar popover skeleton
  ```
  Installed: card, chart, button, badge, skeleton
- [ ] Configure chart theming and color palette
- [ ] Set up global typography and spacing tokens

### 2. Data Layer
- [x] Create database connection via sql.js (DatabaseProvider)
- [x] Type definitions for all data models
- [x] Add error handling and loading states
- [ ] React Query or SWR for caching/state management (optional enhancement)

### 3. Phase 1 Development (MVP)
**Week 1-2: Executive Dashboard**
- [x] Create metric card components (total runs, success rate, avg score, avg cost)
- [x] Implement score distribution bar chart
- [x] Add recent activity - Recent Runs table
- [x] Build top performers table
- [ ] Add basic filters (date range, agent select) (TODO)

**Week 3-4: Agent Performance Dashboard**
- [x] Agent comparison grid with cards
- [x] Model performance leaderboard
- [ ] Score breakdown stacked bar chart (TODO - needs chart library)
- [ ] Agent vs Model Heatmap (TODO)
- [ ] Cost vs Performance Scatter plot (TODO)
- [ ] Filters panel (TODO)

**Week 5-6: Run Details View**
- [ ] Run info card with metadata (TODO)
- [ ] Score breakdown with progress bars (TODO)
- [ ] Telemetry details grid (TODO)
- [ ] Evaluation details accordion (TODO)

### 4. Phase 2 Development (Extended)
- [x] Suite & Scenario Analysis page (basic version with cards and table)
- [x] Cost & Efficiency Analysis page (cost stats and efficiency rankings)
- [x] Evaluator Performance page (rankings and score distributions)

### 5. Phase 3 Development (Advanced)
- Trends & Historical Analysis
- Batch Run Analysis
- Advanced insights & analytics

### 6. Polish & Optimization
- [ ] Responsive design testing
- [ ] Performance optimization (code splitting, lazy loading)
- [ ] Accessibility audit (WCAG compliance)
- [ ] Export functionality (CSV, PNG)
- [ ] Documentation and user guide
