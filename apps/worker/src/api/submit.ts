import { drizzle } from 'drizzle-orm/d1';
import type { Env, SubmitResultsPayload } from '../types';
import { jsonResponse } from '../utils/response';
import * as schema from '../db/schema';

export async function submitResults(request: Request, env: Env): Promise<Response> {
  try {
    const payload: SubmitResultsPayload = await request.json();

    // Validate payload
    if (!payload.runId || !payload.suite || !payload.scenario || !payload.tier || !payload.agent) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const db = drizzle(env.DB);

    // Insert benchmark run
    // Build values object conditionally to handle missing columns
    const runValues: any = {
      runId: payload.runId,
      batchId: payload.batchId,
      suite: payload.suite,
      scenario: payload.scenario,
      tier: payload.tier,
      agent: payload.agent,
      model: payload.model,
      status: payload.status,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt,
      totalScore: payload.totalScore,
      weightedScore: payload.weightedScore,
      isSuccessful: payload.isSuccessful,
      successMetric: payload.successMetric,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined
    };
    
    // Try to insert with specialistEnabled, but fallback if column doesn't exist
    if (payload.specialistEnabled !== undefined) {
      runValues.specialistEnabled = payload.specialistEnabled;
    }
    
    try {
      await db.insert(schema.benchmarkRuns).values(runValues);
    } catch (dbError: any) {
      // If error is about missing column, retry without specialistEnabled
      if (dbError?.message?.includes('specialist_enabled') || dbError?.message?.includes('no column named')) {
        console.warn('Database column specialist_enabled not found, retrying without it');
        delete runValues.specialistEnabled;
        await db.insert(schema.benchmarkRuns).values(runValues);
      } else {
        throw dbError;
      }
    }

    // Insert evaluations
    if (payload.evaluations && payload.evaluations.length > 0) {
      await db.insert(schema.evaluationResults).values(
        payload.evaluations.map(e => ({
          runId: payload.runId,
          evaluatorName: e.evaluatorName,
          score: e.score,
          maxScore: e.maxScore,
          details: e.details
        }))
      );
    }

    // Insert telemetry
    if (payload.telemetry) {
      await db.insert(schema.runTelemetry).values({
        runId: payload.runId,
        toolCalls: payload.telemetry.toolCalls,
        tokensIn: payload.telemetry.tokensIn,
        tokensOut: payload.telemetry.tokensOut,
        costUsd: payload.telemetry.costUsd,
        durationMs: payload.telemetry.durationMs,
        workspaceDir: payload.telemetry.workspaceDir,
        promptSent: payload.telemetry.promptSent
      });
    }

    return jsonResponse({ success: true, runId: payload.runId }, 201);
  } catch (err: any) {
    console.error('Failed to submit results:', err);
    return jsonResponse({ error: 'Failed to submit results', details: err.message }, 500);
  }
}

export async function submitBatchResults(request: Request, env: Env): Promise<Response> {
  try {
    const payload = await request.json();

    // Validate
    if (!payload.batchId) {
      return jsonResponse({ error: 'batchId required' }, 400);
    }

    const db = drizzle(env.DB);

    // Insert or update batch
    await db.insert(schema.batchRuns).values({
      batchId: payload.batchId,
      createdAt: new Date(payload.createdAt || Date.now()),
      completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
      totalRuns: payload.totalRuns,
      successfulRuns: payload.successfulRuns,
      avgScore: payload.avgScore,
      avgWeightedScore: payload.avgWeightedScore,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined
    }).onConflictDoUpdate({
      target: schema.batchRuns.batchId,
      set: {
        completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
        totalRuns: payload.totalRuns,
        successfulRuns: payload.successfulRuns,
        avgScore: payload.avgScore,
        avgWeightedScore: payload.avgWeightedScore,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined
      }
    });

    return jsonResponse({ success: true, batchId: payload.batchId }, 201);
  } catch (err: any) {
    console.error('Failed to submit batch:', err);
    return jsonResponse({ error: 'Failed to submit batch results', details: err.message }, 500);
  }
}
