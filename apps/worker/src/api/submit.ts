import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type { Env, SubmitResultsPayload } from '../types';
import { jsonResponse } from '../utils/response';
import * as schema from '../db/schema';

export async function submitResults(request: Request, env: Env): Promise<Response> {
  try {
    const payload: SubmitResultsPayload = await request.json();

    console.debug(`[Worker:Submit] Received run submission: ${payload.runId}`, {
      suite: payload.suite,
      scenario: payload.scenario,
      tier: payload.tier,
      agent: payload.agent,
      evaluationsCount: payload.evaluations?.length || 0,
      hasTelemetry: !!payload.telemetry
    });

    // Validate payload
    if (!payload.runId || !payload.suite || !payload.scenario || !payload.tier || !payload.agent) {
      console.debug(`[Worker:Submit] Validation failed: missing required fields`);
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const db = drizzle(env.DB);

    // Ensure batch exists if batchId is provided
    if (payload.batchId) {
      console.debug(`[Worker:Submit] Ensuring batch exists: ${payload.batchId}`);
      try {
        // Check if batch exists
        const existingBatch = await db.select()
          .from(schema.batchRuns)
          .where(eq(schema.batchRuns.batchId, payload.batchId))
          .limit(1);

        // If batch doesn't exist, create it
        if (existingBatch.length === 0) {
          await db.insert(schema.batchRuns).values({
            batchId: payload.batchId,
            createdAt: new Date(),
            totalRuns: 0,
            successfulRuns: 0
          });
          console.debug(`[Worker:Submit] Auto-created batch: ${payload.batchId}`);
        } else {
          console.debug(`[Worker:Submit] Batch already exists: ${payload.batchId}`);
        }
      } catch (batchError: any) {
        console.debug(`[Worker:Submit] Failed to ensure batch exists:`, batchError);
        console.error('Failed to ensure batch exists:', batchError);
        // Continue anyway - the foreign key constraint will catch it if there's still an issue
      }
    }

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
    
    // Try to insert with specialist fields, but fallback if columns don't exist
    if (payload.specialistEnabled !== undefined) {
      runValues.specialistEnabled = payload.specialistEnabled;
    }
    if (payload.specialistName !== undefined) {
      runValues.specialistName = payload.specialistName;
    }
    if (payload.specialistVersion !== undefined) {
      runValues.specialistVersion = payload.specialistVersion;
    }
    
    console.debug(`[Worker:Submit] Inserting benchmark run: ${payload.runId}`);
    try {
      await db.insert(schema.benchmarkRuns).values(runValues);
      console.debug(`[Worker:Submit] Benchmark run inserted successfully`);
    } catch (dbError: any) {
      // If error is about missing column, retry without specialist fields
      if (dbError?.message?.includes('no column named') || dbError?.message?.includes('specialist')) {
        console.debug(`[Worker:Submit] Retrying without specialist columns`);
        console.warn('Database missing specialist columns, retrying without them:', dbError?.message);
        // Remove all specialist-related fields that might not exist in older schemas
        delete runValues.specialistEnabled;
        delete runValues.specialistName;
        delete runValues.specialistVersion;
        await db.insert(schema.benchmarkRuns).values(runValues);
        console.debug(`[Worker:Submit] Benchmark run inserted successfully (retry without specialist fields)`);
      } else {
        console.debug(`[Worker:Submit] Database error:`, dbError);
        throw dbError;
      }
    }

    // Insert evaluations
    if (payload.evaluations && payload.evaluations.length > 0) {
      console.debug(`[Worker:Submit] Inserting ${payload.evaluations.length} evaluation(s)`);
      await db.insert(schema.evaluationResults).values(
        payload.evaluations.map(e => ({
          runId: payload.runId,
          evaluatorName: e.evaluatorName,
          score: e.score,
          maxScore: e.maxScore,
          details: e.details
        }))
      );
      console.debug(`[Worker:Submit] Evaluations inserted successfully`);
    } else {
      console.debug(`[Worker:Submit] No evaluations to insert`);
    }

    // Insert telemetry
    if (payload.telemetry) {
      console.debug(`[Worker:Submit] Inserting telemetry data`, {
        toolCalls: payload.telemetry.toolCalls,
        tokensIn: payload.telemetry.tokensIn,
        tokensOut: payload.telemetry.tokensOut,
        costUsd: payload.telemetry.costUsd
      });
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
      console.debug(`[Worker:Submit] Telemetry inserted successfully`);
    } else {
      console.debug(`[Worker:Submit] No telemetry to insert`);
    }

    console.debug(`[Worker:Submit] Run submission completed successfully: ${payload.runId}`);
    return jsonResponse({ success: true, runId: payload.runId }, 201);
  } catch (err: any) {
    console.debug(`[Worker:Submit] Run submission failed:`, err);
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
