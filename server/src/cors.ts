import type { IncomingMessage, ServerResponse } from 'node:http';

export function getCorsHeaders(request: IncomingMessage, allowedOrigins: string[]): Record<string, string> {
  if (!allowedOrigins.length) {
    return {};
  }

  const origin = request.headers.origin;
  if (!origin) {
    return {};
  }

  const allowAll = allowedOrigins.includes('*');
  const isAllowed = allowAll || allowedOrigins.includes(origin);
  if (!isAllowed) {
    return {};
  }

  return {
    'access-control-allow-origin': allowAll ? '*' : origin,
    vary: 'Origin',
  };
}

export function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
  allowedOrigins: string[],
): void {
  if (response.headersSent || response.destroyed) {
    response.destroy();
    return;
  }

  const corsHeaders = getCorsHeaders(request, allowedOrigins);
  response.writeHead(statusCode, {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}
