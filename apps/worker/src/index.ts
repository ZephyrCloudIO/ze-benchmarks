import { IRequest, Router } from 'itty-router';
import { corsHeaders, handleCors } from './middleware/cors';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/auth';
import * as runsApi from './api/runs';
import * as batchesApi from './api/batches';
import * as statsApi from './api/stats';
import * as submitApi from './api/submit';

type CF = [env: Env, ctx: ExecutionContext];

const router = Router<IRequest, CF>();

// CORS preflight
router.options('*', handleCors);

// Public read endpoints (no auth required)
router.get('/api/runs', runsApi.listRuns);
router.get('/api/runs/:runId', runsApi.getRunDetails);
router.get('/api/runs/:runId/evaluations', runsApi.getRunEvaluations);
router.get('/api/runs/:runId/telemetry', runsApi.getRunTelemetry);

router.get('/api/batches', batchesApi.listBatches);
router.get('/api/batches/:batchId', batchesApi.getBatchDetails);

router.get('/api/stats', statsApi.getGlobalStats);
router.get('/api/stats/agents', statsApi.getAgentStats);

// Protected write endpoints (requires authentication)
router.post('/api/results', authenticate, submitApi.submitResults);
router.post('/api/results/batch', authenticate, submitApi.submitBatchResults);

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
