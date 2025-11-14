import type { Env } from '../types';
import { jsonResponse } from '../utils/response';

export async function authenticate(
  request: Request,
  env: Env
): Promise<Response | void> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);

  // For local development, accept dev-local-key
  const apiKey = env.API_SECRET_KEY || 'dev-local-key';

  if (token !== apiKey) {
    return jsonResponse({ error: 'Invalid API key' }, 403);
  }

  // Authentication successful, continue
}
