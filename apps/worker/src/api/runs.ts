import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import type { Env } from '../types';
import { jsonResponse } from '../utils/response';
import * as schema from '../db/schema';
import { convertBenchmarkRunFields, convertEvaluationFields, convertTelemetryFields } from '../utils/field-converters';

export async function listRuns(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const suite = url.searchParams.get('suite');
    const scenario = url.searchParams.get('scenario');
    const agent = url.searchParams.get('agent');
    const status = url.searchParams.get('status');

    const db = drizzle(env.DB);

    // Build where conditions
    const conditions = [];
    if (suite) conditions.push(eq(schema.benchmarkRuns.suite, suite));
    if (scenario) conditions.push(eq(schema.benchmarkRuns.scenario, scenario));
    if (agent) conditions.push(eq(schema.benchmarkRuns.agent, agent));
    if (status) conditions.push(eq(schema.benchmarkRuns.status, status));

    const runs = await db
      .select()
      .from(schema.benchmarkRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.benchmarkRuns.startedAt))
      .limit(limit);

    // Convert field names from snake_case to camelCase
    const convertedRuns = runs.map(convertBenchmarkRunFields);

    return jsonResponse(convertedRuns);
  } catch (err: any) {
    console.error('Failed to list runs:', err);
    return jsonResponse({ error: 'Failed to list runs', details: err.message }, 500);
  }
}

export async function getRunDetails(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const runId = url.pathname.split('/').pop();

    if (!runId) {
      return jsonResponse({ error: 'Run ID required' }, 400);
    }

    const db = drizzle(env.DB);

    const run = await db
      .select()
      .from(schema.benchmarkRuns)
      .where(eq(schema.benchmarkRuns.runId, runId))
      .get();

    if (!run) {
      return jsonResponse({ error: 'Run not found' }, 404);
    }

    const evaluations = await db
      .select()
      .from(schema.evaluationResults)
      .where(eq(schema.evaluationResults.runId, runId));

    const telemetry = await db
      .select()
      .from(schema.runTelemetry)
      .where(eq(schema.runTelemetry.runId, runId))
      .get();

    return jsonResponse({
      run: convertBenchmarkRunFields(run),
      evaluations: evaluations.map(convertEvaluationFields),
      telemetry: convertTelemetryFields(telemetry)
    });
  } catch (err: any) {
    console.error('Failed to get run details:', err);
    return jsonResponse({ error: 'Failed to get run details', details: err.message }, 500);
  }
}

export async function getRunEvaluations(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const runId = url.pathname.split('/')[3]; // /api/runs/:runId/evaluations

    const db = drizzle(env.DB);

    const evaluations = await db
      .select()
      .from(schema.evaluationResults)
      .where(eq(schema.evaluationResults.runId, runId))
      .orderBy(schema.evaluationResults.createdAt);

    // Convert field names from snake_case to camelCase
    const convertedEvaluations = evaluations.map(convertEvaluationFields);

    return jsonResponse(convertedEvaluations);
  } catch (err: any) {
    console.error('Failed to get evaluations:', err);
    return jsonResponse({ error: 'Failed to get evaluations', details: err.message }, 500);
  }
}

export async function getRunTelemetry(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const runId = url.pathname.split('/')[3]; // /api/runs/:runId/telemetry

    const db = drizzle(env.DB);

    const telemetry = await db
      .select()
      .from(schema.runTelemetry)
      .where(eq(schema.runTelemetry.runId, runId))
      .get();

    // Convert field names from snake_case to camelCase
    return jsonResponse(convertTelemetryFields(telemetry));
  } catch (err: any) {
    console.error('Failed to get telemetry:', err);
    return jsonResponse({ error: 'Failed to get telemetry', details: err.message }, 500);
  }
}
