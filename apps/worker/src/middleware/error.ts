import { jsonResponse } from '../utils/response';

export function errorHandler(err: any): Response {
  console.error('Error:', err);

  return jsonResponse(
    {
      error: err.message || 'Internal server error',
      ...(process.env.ENVIRONMENT === 'development' && { stack: err.stack })
    },
    500
  );
}
