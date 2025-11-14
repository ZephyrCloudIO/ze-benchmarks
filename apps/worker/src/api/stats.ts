import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Env } from '../types';
import { jsonResponse } from '../utils/response';
import * as schema from '../db/schema';

export async function getGlobalStats(request: Request, env: Env): Promise<Response> {
  try {
    const db = drizzle(env.DB);

    const stats = await db
      .select({
        totalRuns: sql<number>`COUNT(*)`,
        successfulRuns: sql<number>`COUNT(CASE WHEN is_successful = 1 THEN 1 END)`,
        avgScore: sql<number>`AVG(total_score)`,
        avgWeightedScore: sql<number>`AVG(weighted_score)`
      })
      .from(schema.benchmarkRuns)
      .where(eq(schema.benchmarkRuns.status, 'completed'))
      .get();

    return jsonResponse(stats);
  } catch (err: any) {
    console.error('Failed to get global stats:', err);
    return jsonResponse({ error: 'Failed to get global stats', details: err.message }, 500);
  }
}

export async function getAgentStats(request: Request, env: Env): Promise<Response> {
  try {
    const db = drizzle(env.DB);

    const stats = await db
      .select({
        agent: schema.benchmarkRuns.agent,
        runs: sql<number>`COUNT(*)`,
        avgScore: sql<number>`AVG(weighted_score)`,
        minScore: sql<number>`MIN(weighted_score)`,
        maxScore: sql<number>`MAX(weighted_score)`
      })
      .from(schema.benchmarkRuns)
      .where(
        and(
          eq(schema.benchmarkRuns.status, 'completed'),
          eq(schema.benchmarkRuns.isSuccessful, true)
        )
      )
      .groupBy(schema.benchmarkRuns.agent)
      .orderBy(desc(sql`avgScore`));

    return jsonResponse(stats);
  } catch (err: any) {
    console.error('Failed to get agent stats:', err);
    return jsonResponse({ error: 'Failed to get agent stats', details: err.message }, 500);
  }
}
