import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { jsonResponse } from '../utils/response';
import * as schema from '../db/schema';
import type { HumanScoreSubmission } from '../types';

/**
 * Submit a human score for a benchmark run
 * POST /api/runs/:runId/human-scores
 */
export async function submitHumanScore(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const runId = url.pathname.split('/')[3]; // /api/runs/:runId/human-scores

    console.debug(`[Worker:HumanScores] submitHumanScore request for runId: ${runId}`);

    if (!runId) {
      console.debug(`[Worker:HumanScores] submitHumanScore: Run ID missing`);
      return jsonResponse({ error: 'Run ID required' }, 400);
    }

    // Parse request body
    const body = await request.json() as HumanScoreSubmission;
    console.debug(`[Worker:HumanScores] Received score submission:`, {
      scorerName: body.scorerName,
      scoresCount: body.scores?.length || 0,
      overallScore: body.overallScore
    });

    // Validate required fields
    if (!body.scorerName || !body.scores || !Array.isArray(body.scores)) {
      console.debug(`[Worker:HumanScores] Validation failed: missing required fields`);
      return jsonResponse({
        error: 'Invalid request body',
        details: 'scorerName and scores array are required'
      }, 400);
    }

    // Validate score format
    for (const score of body.scores) {
      if (!score.category || typeof score.score !== 'number') {
        return jsonResponse({
          error: 'Invalid score format',
          details: 'Each score must have category and score (number)'
        }, 400);
      }
      if (score.score < 1 || score.score > 5) {
        return jsonResponse({
          error: 'Invalid score value',
          details: 'Score must be between 1 and 5'
        }, 400);
      }
    }

    const db = drizzle(env.DB);

    // Check if run exists
    console.debug(`[Worker:HumanScores] Checking if run exists: ${runId}`);
    const run = await db
      .select()
      .from(schema.benchmarkRuns)
      .where(eq(schema.benchmarkRuns.runId, runId))
      .get();

    if (!run) {
      console.debug(`[Worker:HumanScores] Run not found: ${runId}`);
      return jsonResponse({ error: 'Run not found' }, 404);
    }

    // Calculate overall score (normalized to 0-1.0)
    const avgScore = body.scores.reduce((sum, s) => sum + s.score, 0) / body.scores.length;
    const normalizedScore = (avgScore - 1) / 4; // Convert 1-5 scale to 0-1.0
    console.debug(`[Worker:HumanScores] Calculated overall score: ${normalizedScore.toFixed(3)} (from avg: ${avgScore.toFixed(2)})`);

    // Insert human score
    console.debug(`[Worker:HumanScores] Inserting human score into database`);
    const result = await db
      .insert(schema.humanScores)
      .values({
        runId: runId,
        scorerName: body.scorerName,
        scorerEmail: body.scorerEmail || null,
        scores: JSON.stringify(body.scores),
        overallScore: normalizedScore,
        timeSpentSeconds: body.timeSpentSeconds || null,
        notes: body.notes || null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      })
      .returning()
      .get();

    // Parse JSON fields for response
    const response = {
      ...result,
      scores: JSON.parse(result.scores),
      metadata: result.metadata ? JSON.parse(result.metadata) : null,
    };

    console.debug(`[Worker:HumanScores] Human score submitted successfully, id: ${result.id}`);
    return jsonResponse(response, 201);
  } catch (err: any) {
    console.debug(`[Worker:HumanScores] Failed to submit human score:`, err);
    console.error('Failed to submit human score:', err);
    return jsonResponse({
      error: 'Failed to submit human score',
      details: err.message
    }, 500);
  }
}

/**
 * Get all human scores for a benchmark run
 * GET /api/runs/:runId/human-scores
 */
export async function getHumanScores(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const runId = url.pathname.split('/')[3]; // /api/runs/:runId/human-scores

    console.debug(`[Worker:HumanScores] getHumanScores request for runId: ${runId}`);

    if (!runId) {
      console.debug(`[Worker:HumanScores] getHumanScores: Run ID missing`);
      return jsonResponse({ error: 'Run ID required' }, 400);
    }

    const db = drizzle(env.DB);

    const scores = await db
      .select()
      .from(schema.humanScores)
      .where(eq(schema.humanScores.runId, runId))
      .orderBy(desc(schema.humanScores.createdAt));

    // Parse JSON fields for each score
    const parsedScores = scores.map(score => ({
      ...score,
      scores: JSON.parse(score.scores),
      metadata: score.metadata ? JSON.parse(score.metadata) : null,
    }));

    console.debug(`[Worker:HumanScores] Returning ${parsedScores.length} human score(s) for runId: ${runId}`);
    return jsonResponse(parsedScores);
  } catch (err: any) {
    console.error('Failed to get human scores:', err);
    return jsonResponse({
      error: 'Failed to get human scores',
      details: err.message
    }, 500);
  }
}

/**
 * Get aggregate statistics for human scores
 * GET /api/human-scores/stats
 */
export async function getHumanScoreStats(request: Request, env: Env): Promise<Response> {
  try {
    console.debug(`[Worker:HumanScores] getHumanScoreStats request`);

    const db = drizzle(env.DB);

    // Get all human scores
    const allScores = await db
      .select()
      .from(schema.humanScores);

    console.debug(`[Worker:HumanScores] Calculating stats from ${allScores.length} score(s)`);

    // Calculate statistics
    const stats = {
      totalScores: allScores.length,
      uniqueRuns: new Set(allScores.map(s => s.runId)).size,
      uniqueScorers: new Set(allScores.map(s => s.scorerName)).size,
      avgOverallScore: allScores.length > 0
        ? allScores.reduce((sum, s) => sum + (s.overallScore || 0), 0) / allScores.length
        : 0,
      avgTimeSpent: allScores.filter(s => s.timeSpentSeconds).length > 0
        ? allScores
            .filter(s => s.timeSpentSeconds)
            .reduce((sum, s) => sum + (s.timeSpentSeconds || 0), 0) /
          allScores.filter(s => s.timeSpentSeconds).length
        : 0,
    };

    console.debug(`[Worker:HumanScores] Stats calculated:`, stats);
    return jsonResponse(stats);
  } catch (err: any) {
    console.debug(`[Worker:HumanScores] Failed to get stats:`, err);
    console.error('Failed to get human score stats:', err);
    return jsonResponse({
      error: 'Failed to get human score stats',
      details: err.message
    }, 500);
  }
}
