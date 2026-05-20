import type { IncomingMessage, ServerResponse } from 'node:http';
import net from 'node:net';
import { getCorsHeaders, sendJson } from './cors.js';

export const IMAGE_PROXY_PATH = '/api/image-proxy';

const MAX_IMAGE_PROXY_BYTES = 25 * 1024 * 1024;

function isPrivateIpAddress(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(normalizedHostname);

  if (ipVersion === 4) {
    const parts = normalizedHostname.split('.').map((part) => Number(part));
    const [first, second] = parts;
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254) ||
      first === 0
    );
  }

  if (ipVersion === 6) {
    const lower = normalizedHostname.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }

  return ['localhost', 'localhost.localdomain'].includes(normalizedHostname.toLowerCase());
}

function parseAllowedImageProxyUrl(value: string | null): URL | null {
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }
    if (parsedUrl.username || parsedUrl.password || isPrivateIpAddress(parsedUrl.hostname)) {
      return null;
    }
    return parsedUrl;
  } catch {
    return null;
  }
}

export async function proxyExternalImage(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
  allowedOrigins: string[],
  fetchImpl: typeof fetch,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(request, response, 405, { error: 'Method not allowed' }, allowedOrigins);
    return;
  }

  const targetUrl = parseAllowedImageProxyUrl(requestUrl.searchParams.get('url'));
  if (!targetUrl) {
    sendJson(request, response, 400, { error: 'Image proxy URL is not allowed.' }, allowedOrigins);
    return;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(targetUrl, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'AMC-WebUI image proxy',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    sendJson(request, response, 502, { error: `Image proxy request failed: ${message}` }, allowedOrigins);
    return;
  }

  if (!upstreamResponse.ok) {
    sendJson(
      request,
      response,
      502,
      { error: `Image proxy target returned ${upstreamResponse.status}.` },
      allowedOrigins,
    );
    return;
  }

  const contentType = upstreamResponse.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    sendJson(request, response, 415, { error: 'Image proxy target did not return an image.' }, allowedOrigins);
    return;
  }

  const contentLength = Number(upstreamResponse.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_PROXY_BYTES) {
    sendJson(request, response, 413, { error: 'Image proxy target is too large.' }, allowedOrigins);
    return;
  }

  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_PROXY_BYTES) {
    sendJson(request, response, 413, { error: 'Image proxy target is too large.' }, allowedOrigins);
    return;
  }

  response.writeHead(upstreamResponse.status, {
    ...getCorsHeaders(request, allowedOrigins),
    'content-type': contentType,
    'cache-control': 'public, max-age=86400',
    'x-content-type-options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  response.end(body);
}
