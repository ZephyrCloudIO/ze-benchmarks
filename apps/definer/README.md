# RoleDef Builder

A clean, intuitive application for creating and managing AI agent role definitions. Built with React, Rsbuild, and a Toss-inspired design system.

## Features

- **RoleDef Management**: Create, view, and manage AI agent role definitions
- **Interactive Builder**: Step-by-step wizard for defining roles
- **Evaluation Criteria**: Select from suggested criteria or add custom ones
- **Visual Detail View**: Comprehensive view of RoleDef specifications
- **Export to JSON**: Download RoleDefs in standard JSONC format
- **Clean Design**: Toss-inspired UI with smooth animations and interactions

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Running Worker API at `http://localhost:8787/api` (see `@apps/worker`)

## Setup

Install dependencies:

```bash
pnpm install
```

Configure environment:

```bash
cp .env.example .env
# Edit .env to set PUBLIC_VITE_API_URL if needed
```

## Development

Start the dev server:

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Build

Build for production:

```bash
pnpm build
```

Preview production build:

```bash
pnpm preview
```

## Project Structure

```
src/
├── pages/              # Page components
│   ├── Home.tsx        # RoleDef list
│   ├── RoleSelection.tsx     # Step 1: Basic role info
│   ├── EvaluationCriteria.tsx # Step 2: Criteria selection
│   └── RoleDefDetail.tsx     # Detail view
├── styles/             # Page-specific styles
├── api.ts              # API client functions
├── types.ts            # TypeScript types
└── App.tsx             # Router configuration
```

## API Integration

The app connects to the Worker API for:

- `GET /api/roledefs` - List all RoleDefs
- `GET /api/roledefs/:id` - Get RoleDef details
- `POST /api/roledefs` - Create new RoleDef (requires auth)
- `DELETE /api/roledefs/:id` - Delete RoleDef (requires auth)
- `GET /api/roledefs/criteria/suggestions` - Get suggested evaluation criteria

## Authentication

For write operations (create, update, delete), set an API key in localStorage:

```javascript
localStorage.setItem('apiKey', 'your-api-key');
```

## Learn More

- [Rsbuild Documentation](https://rsbuild.rs)
- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com)
