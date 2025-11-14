import { Router } from 'itty-router';
import { corsHeaders, handleCors } from './middleware/cors';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/auth';
import type { Env } from './types';
import * as runsApi from './api/runs';
import * as batchesApi from './api/batches';
import * as statsApi from './api/stats';
import * as submitApi from './api/submit';

const router = Router();

// CORS preflight
router.options('*', handleCors);

// Public read endpoints (no auth required)
router.get('/api/runs', (request: Request, env: Env) => runsApi.listRuns(request, env));
router.get('/api/runs/:runId', (request: Request, env: Env) => runsApi.getRunDetails(request, env));
router.get('/api/runs/:runId/evaluations', (request: Request, env: Env) => runsApi.getRunEvaluations(request, env));
router.get('/api/runs/:runId/telemetry', (request: Request, env: Env) => runsApi.getRunTelemetry(request, env));

router.get('/api/batches', (request: Request, env: Env) => batchesApi.listBatches(request, env));
router.get('/api/batches/:batchId', (request: Request, env: Env) => batchesApi.getBatchDetails(request, env));

router.get('/api/stats', (request: Request, env: Env) => statsApi.getGlobalStats(request, env));
router.get('/api/stats/agents', (request: Request, env: Env) => statsApi.getAgentStats(request, env));

// Protected write endpoints (requires authentication)
router.post('/api/results', authenticate, (request: Request, env: Env) => submitApi.submitResults(request, env));
router.post('/api/results/batch', authenticate, (request: Request, env: Env) => submitApi.submitBatchResults(request, env));

// Health check
router.get('/health', () =>
  new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })
);

// 404 handler
router.all('*', () =>
  new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await router.handle(request, env, ctx).catch(errorHandler);
    } catch (err) {
      return errorHandler(err);
    }
  },
};
