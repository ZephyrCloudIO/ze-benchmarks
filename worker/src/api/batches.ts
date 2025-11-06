import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, sql } from 'drizzle-orm';
import type { Env } from '../types';
import { jsonResponse } from '../utils/response';
import * as schema from '../db/schema';

export async function listBatches(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const db = drizzle(env.DB);

    const batches = await db
      .select()
      .from(schema.batchRuns)
      .orderBy(desc(schema.batchRuns.createdAt))
      .limit(limit);

    return jsonResponse(batches);
  } catch (err: any) {
    console.error('Failed to list batches:', err);
    return jsonResponse({ error: 'Failed to list batches', details: err.message }, 500);
  }
}

export async function getBatchDetails(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const batchId = url.pathname.split('/').pop();

    if (!batchId) {
      return jsonResponse({ error: 'Batch ID required' }, 400);
    }

    const db = drizzle(env.DB);

    const batch = await db
      .select()
      .from(schema.batchRuns)
      .where(eq(schema.batchRuns.batchId, batchId))
      .get();

    if (!batch) {
      return jsonResponse({ error: 'Batch not found' }, 404);
    }

    const runs = await db
      .select()
      .from(schema.benchmarkRuns)
      .where(eq(schema.benchmarkRuns.batchId, batchId))
      .orderBy(schema.benchmarkRuns.startedAt);

    return jsonResponse({ ...batch, runs });
  } catch (err: any) {
    console.error('Failed to get batch details:', err);
    return jsonResponse({ error: 'Failed to get batch details', details: err.message }, 500);
  }
}
