import { corsHeaders } from '../middleware/cors';

export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  });
}

export function errorResponse(message: string, status: number = 500): Response {
  return jsonResponse({ error: message }, status);
}
