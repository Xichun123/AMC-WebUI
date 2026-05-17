import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import net from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ApiServerConfig } from './config.js';
import type { GcsFilesAdapter } from './gcsFilesAdapter.js';
import type { VertexAccessTokenProvider } from './vertexAuth.js';
import { rewriteToVertex } from './vertexPathRewriter.js';

const GEMINI_PROXY_PREFIX = '/api/gemini';
const IMAGE_PROXY_PATH = '/api/image-proxy';
const LOCAL_CLIPBOARD_IMAGE_PATH = '/api/local-clipboard-image';
const MAX_IMAGE_PROXY_BYTES = 25 * 1024 * 1024;
const MAX_LOCAL_CLIPBOARD_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_REWRITE_BODY_BYTES = 50 * 1024 * 1024;
const MAX_INITIATE_BODY_BYTES = 64 * 1024;
const GCS_UPLOAD_INITIATE_PATH = '/upload/v1beta/files';
const GCS_UPLOAD_CHUNK_PATTERN = /^\/__gcs-upload-chunk__\/([\w-]+)$/;
const GCS_FILE_METADATA_PATTERN = /^\/v\d+(?:beta\d*|alpha\d*)?\/files\/([\w-]+)$/;
const PNG_HEX_PREFIX = '89504e470d0a1a0a';
const MACOS_CLIPBOARD_PNG_SCRIPT = `
(() => {
  ObjC.import('AppKit');
  ObjC.import('Foundation');
  const pasteboard = $.NSPasteboard.generalPasteboard;
  const data = pasteboard.dataForType($('public.png'));
  if (!data || data.isNil()) {
    return '';
  }
  return ObjC.unwrap(data.base64EncodedStringWithOptions(0));
})()
`.trim();
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const STRIPPED_PROXY_REQUEST_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  'accept-encoding',
  'authorization',
  'content-length',
  'cookie',
  'host',
]);
const STRIPPED_PROXY_RESPONSE_HEADERS = new Set([...HOP_BY_HOP_HEADERS, 'content-encoding', 'content-length']);

interface CreateServerDependencies {
  fetchImpl?: typeof fetch;
  readLocalClipboardImage?: () => Promise<LocalClipboardImage | null>;
  vertexAuth?: VertexAccessTokenProvider;
  gcsFilesAdapter?: GcsFilesAdapter;
}

interface LocalClipboardImage {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { encoding: 'utf8'; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

type CreateServerConfig = Pick<ApiServerConfig, 'geminiApiBase' | 'geminiApiKey'> &
  Partial<Pick<ApiServerConfig, 'allowedOrigins' | 'backendFlavor' | 'vertex' | 'gcs'>>;

interface ResolvedServerConfig extends CreateServerConfig {
  allowedOrigins: string[];
  backendFlavor: NonNullable<ApiServerConfig['backendFlavor']>;
}

function getCorsHeaders(request: IncomingMessage, allowedOrigins: string[]): Record<string, string> {
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

function sendJson(
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

const execFileAsync = promisify(execFile) as ExecFileAsync;

function parsePngBase64Data(value: string): Buffer | null {
  const base64 = value.trim();
  if (!base64) {
    return null;
  }

  const data = Buffer.from(base64, 'base64');
  if (!data.byteLength || !data.toString('hex', 0, 8).startsWith(PNG_HEX_PREFIX)) {
    return null;
  }

  return data;
}

export async function readMacOsClipboardPng(
  execFileImpl: ExecFileAsync = execFileAsync,
  platform: NodeJS.Platform = process.platform,
): Promise<LocalClipboardImage | null> {
  if (platform !== 'darwin') {
    return null;
  }

  let stdout: string;
  try {
    const result = await execFileImpl('osascript', ['-l', 'JavaScript', '-e', MACOS_CLIPBOARD_PNG_SCRIPT], {
      encoding: 'utf8',
      maxBuffer: MAX_LOCAL_CLIPBOARD_IMAGE_BYTES * 2 + 1024,
    });
    stdout = result.stdout;
  } catch {
    return null;
  }

  const data = parsePngBase64Data(stdout);
  if (!data || data.byteLength > MAX_LOCAL_CLIPBOARD_IMAGE_BYTES) {
    return null;
  }

  return {
    data,
    mimeType: 'image/png',
    fileName: 'clipboard-image.png',
  };
}

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

async function proxyExternalImage(
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

async function handleLocalClipboardImageRequest(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
  readLocalClipboardImage: () => Promise<LocalClipboardImage | null>,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(request, response, 405, { error: 'Method not allowed' }, allowedOrigins);
    return;
  }

  const image = await readLocalClipboardImage();
  if (!image) {
    sendJson(request, response, 404, { error: 'No local clipboard image is available.' }, allowedOrigins);
    return;
  }

  response.writeHead(200, {
    ...getCorsHeaders(request, allowedOrigins),
    'content-type': image.mimeType,
    'content-length': String(image.data.byteLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-clipboard-file-name': encodeURIComponent(image.fileName),
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  response.end(image.data);
}

function getConnectionManagedHeaders(value: string | null | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(',')
      .map((headerName) => headerName.trim().toLowerCase())
      .filter((headerName) => headerName.length > 0),
  );
}

function resolveRequestApiKey(request: IncomingMessage, serverApiKey?: string): string {
  const trimmedServerApiKey = serverApiKey?.trim();
  if (trimmedServerApiKey) {
    return trimmedServerApiKey;
  }

  const browserApiKey = request.headers['x-goog-api-key'];
  if (Array.isArray(browserApiKey)) {
    return browserApiKey[0]?.trim() ?? '';
  }

  return browserApiKey?.trim() ?? '';
}

function buildProxyHeaders(request: IncomingMessage, auth: ProxyAuth): Headers {
  const headers = new Headers();
  const connectionManagedHeaders = getConnectionManagedHeaders(
    Array.isArray(request.headers.connection) ? request.headers.connection.join(',') : request.headers.connection,
  );

  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'undefined') {
      continue;
    }

    const normalizedName = name.toLowerCase();
    if (STRIPPED_PROXY_REQUEST_HEADERS.has(normalizedName) || connectionManagedHeaders.has(normalizedName)) {
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(normalizedName, value.join(','));
      continue;
    }

    headers.set(normalizedName, value);
  }

  if (auth.kind === 'apiKey') {
    headers.set('x-goog-api-key', auth.apiKey);
  } else {
    headers.delete('x-goog-api-key');
    headers.set('authorization', `Bearer ${auth.accessToken}`);
  }
  return headers;
}

type ProxyAuth = { kind: 'apiKey'; apiKey: string } | { kind: 'bearer'; accessToken: string };

function buildProxyResponseHeaders(
  request: IncomingMessage,
  upstreamResponse: Response,
  allowedOrigins: string[],
): Record<string, string> {
  const responseHeaders: Record<string, string> = {};
  const connectionManagedHeaders = getConnectionManagedHeaders(upstreamResponse.headers.get('connection'));

  upstreamResponse.headers.forEach((value, key) => {
    const normalizedName = key.toLowerCase();
    if (STRIPPED_PROXY_RESPONSE_HEADERS.has(normalizedName) || connectionManagedHeaders.has(normalizedName)) {
      return;
    }

    responseHeaders[normalizedName] = value;
  });

  Object.assign(responseHeaders, getCorsHeaders(request, allowedOrigins));
  return responseHeaders;
}

async function readBufferedBody(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let aborted = false;

    const onData = (chunk: Buffer) => {
      if (aborted) {
        return;
      }

      received += chunk.byteLength;
      if (received > maxBytes) {
        aborted = true;
        request.off('data', onData);
        request.off('end', onEnd);
        request.off('error', onError);
        reject(new RequestBodyTooLargeError(maxBytes));
        return;
      }

      chunks.push(chunk);
    };

    const onEnd = () => {
      if (!aborted) {
        resolve(Buffer.concat(chunks));
      }
    };

    const onError = (error: unknown) => {
      if (!aborted) {
        aborted = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
  });
}

class RequestBodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes.`);
    this.name = 'RequestBodyTooLargeError';
  }
}

interface InitiateUploadMetadata {
  displayName: string;
  mimeType: string;
  sizeBytes: number;
}

function parseInitiateUploadMetadata(body: Buffer): InitiateUploadMetadata | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const fileWrapper = (parsed as { file?: unknown }).file;
  const fileRecord = (typeof fileWrapper === 'object' && fileWrapper !== null ? fileWrapper : parsed) as {
    displayName?: unknown;
    display_name?: unknown;
    mimeType?: unknown;
    mime_type?: unknown;
    sizeBytes?: unknown;
    size_bytes?: unknown;
  };

  const displayName = typeof fileRecord.displayName === 'string' ? fileRecord.displayName : fileRecord.display_name;
  const mimeType = typeof fileRecord.mimeType === 'string' ? fileRecord.mimeType : fileRecord.mime_type;
  const rawSize = typeof fileRecord.sizeBytes !== 'undefined' ? fileRecord.sizeBytes : fileRecord.size_bytes;
  const sizeBytes =
    typeof rawSize === 'number' ? rawSize : Number.parseInt(typeof rawSize === 'string' ? rawSize : '', 10);

  if (typeof displayName !== 'string' || typeof mimeType !== 'string' || !Number.isFinite(sizeBytes)) {
    return null;
  }

  return { displayName, mimeType, sizeBytes };
}

function readHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

async function handleGcsFilesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  upstreamPath: string,
  adapter: GcsFilesAdapter,
  allowedOrigins: string[],
): Promise<boolean> {
  const method = request.method || 'GET';
  const corsHeaders = getCorsHeaders(request, allowedOrigins);

  if (
    method === 'POST' &&
    (upstreamPath === GCS_UPLOAD_INITIATE_PATH || upstreamPath === `${GCS_UPLOAD_INITIATE_PATH}/`)
  ) {
    let bodyBuffer: Buffer;
    try {
      bodyBuffer = await readBufferedBody(request, MAX_INITIATE_BODY_BYTES);
    } catch (error) {
      const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
      sendJson(request, response, status, { error: 'Failed to read initiate body.' }, allowedOrigins);
      return true;
    }

    const metadata = parseInitiateUploadMetadata(bodyBuffer);
    if (!metadata) {
      sendJson(request, response, 400, { error: 'Invalid file metadata in upload initiate request.' }, allowedOrigins);
      return true;
    }

    let initiated: ReturnType<GcsFilesAdapter['initiateUpload']>;
    try {
      initiated = adapter.initiateUpload(metadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown initiate error';
      sendJson(request, response, 413, { error: message }, allowedOrigins);
      return true;
    }

    response.writeHead(200, {
      ...corsHeaders,
      'x-goog-upload-url': initiated.uploadUrl,
      'x-goog-upload-status': 'active',
      'content-type': 'application/json; charset=utf-8',
    });
    response.end('{}');
    return true;
  }

  const chunkMatch = GCS_UPLOAD_CHUNK_PATTERN.exec(upstreamPath);
  if (method === 'POST' && chunkMatch) {
    const sessionId = chunkMatch[1];
    const offsetHeader = readHeader(request, 'x-goog-upload-offset');
    const commandHeader = readHeader(request, 'x-goog-upload-command');
    const offset = Number.parseInt(offsetHeader ?? '', 10);
    if (!Number.isFinite(offset) || offset < 0 || !commandHeader) {
      sendJson(request, response, 400, { error: 'Missing or invalid upload offset/command headers.' }, allowedOrigins);
      return true;
    }

    let chunk: Buffer;
    try {
      chunk = await readBufferedBody(request, MAX_REWRITE_BODY_BYTES);
    } catch (error) {
      const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
      sendJson(request, response, status, { error: 'Upload chunk exceeded size limit.' }, allowedOrigins);
      return true;
    }

    let result: Awaited<ReturnType<GcsFilesAdapter['uploadChunk']>>;
    try {
      result = await adapter.uploadChunk({ sessionId, offset, command: commandHeader, chunk });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown chunk upload error';
      sendJson(request, response, 400, { error: message }, allowedOrigins);
      return true;
    }

    if (result.file) {
      response.writeHead(200, {
        ...corsHeaders,
        'x-goog-upload-status': 'final',
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify({ file: result.file }));
      return true;
    }

    response.writeHead(200, { ...corsHeaders, 'x-goog-upload-status': 'active' });
    response.end();
    return true;
  }

  const getMatch = GCS_FILE_METADATA_PATTERN.exec(upstreamPath);
  if (method === 'GET' && getMatch) {
    const fileId = getMatch[1];
    const metadata = await adapter.getFileMetadata(fileId);
    if (!metadata) {
      sendJson(request, response, 404, { error: 'File not found.' }, allowedOrigins);
      return true;
    }
    sendJson(request, response, 200, metadata as unknown as Record<string, unknown>, allowedOrigins);
    return true;
  }

  return false;
}

async function proxyGeminiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: ResolvedServerConfig,
  fetchImpl: typeof fetch,
  vertexAuth: VertexAccessTokenProvider | undefined,
  gcsFilesAdapter: GcsFilesAdapter | undefined,
): Promise<void> {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const upstreamPath = requestUrl.pathname.slice(GEMINI_PROXY_PREFIX.length) || '/';

  if (config.backendFlavor === 'vertex') {
    const looksLikeFilesRoute =
      upstreamPath === GCS_UPLOAD_INITIATE_PATH ||
      upstreamPath === `${GCS_UPLOAD_INITIATE_PATH}/` ||
      GCS_UPLOAD_CHUNK_PATTERN.test(upstreamPath) ||
      GCS_FILE_METADATA_PATTERN.test(upstreamPath);

    if (looksLikeFilesRoute) {
      if (!gcsFilesAdapter) {
        sendJson(
          request,
          response,
          503,
          { error: 'GCS Files adapter is not configured; set GCS_BUCKET to enable Files API in vertex mode.' },
          config.allowedOrigins,
        );
        return;
      }

      const handled = await handleGcsFilesRequest(
        request,
        response,
        upstreamPath,
        gcsFilesAdapter,
        config.allowedOrigins,
      );
      if (handled) {
        return;
      }
    }
  }

  let upstreamUrl: string;
  let auth: ProxyAuth;
  let isModelInvocation = false;

  if (config.backendFlavor === 'vertex') {
    if (!config.vertex) {
      sendJson(request, response, 500, { error: 'Vertex backend config is missing.' }, config.allowedOrigins);
      return;
    }
    if (!vertexAuth) {
      sendJson(request, response, 500, { error: 'Vertex auth provider is not configured.' }, config.allowedOrigins);
      return;
    }

    let accessToken: string;
    try {
      accessToken = await vertexAuth.getAccessToken();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown auth error';
      sendJson(
        request,
        response,
        500,
        { error: `Vertex access token retrieval failed: ${message}` },
        config.allowedOrigins,
      );
      return;
    }

    const rewritten = rewriteToVertex(upstreamPath, requestUrl.search, config.vertex);
    upstreamUrl = rewritten.url;
    isModelInvocation = rewritten.isModelInvocation;
    auth = { kind: 'bearer', accessToken };
  } else {
    const apiKeyForProxy = resolveRequestApiKey(request, config.geminiApiKey);
    if (!apiKeyForProxy) {
      sendJson(request, response, 500, { error: 'GEMINI_API_KEY is not configured.' }, config.allowedOrigins);
      return;
    }

    const targetBase = config.geminiApiBase.replace(/\/$/, '');
    upstreamUrl = `${targetBase}${upstreamPath}${requestUrl.search}`;
    auth = { kind: 'apiKey', apiKey: apiKeyForProxy };
  }

  const method = request.method || 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method);
  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };

  const requestInit: RequestInit & { duplex?: 'half' } = {
    method,
    headers: buildProxyHeaders(request, auth),
    signal: abortController.signal,
  };

  const shouldRewriteBody =
    hasBody && config.backendFlavor === 'vertex' && gcsFilesAdapter !== undefined && isModelInvocation;

  if (shouldRewriteBody) {
    let bodyBuffer: Buffer;
    try {
      bodyBuffer = await readBufferedBody(request, MAX_REWRITE_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        sendJson(
          request,
          response,
          413,
          { error: `Request body exceeds ${MAX_REWRITE_BODY_BYTES} bytes; cannot rewrite file URIs.` },
          config.allowedOrigins,
        );
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to read request body.';
      sendJson(request, response, 400, { error: message }, config.allowedOrigins);
      return;
    }

    const rewrittenBody = gcsFilesAdapter.rewriteFileUriInJsonBody(bodyBuffer);
    const rewrittenBodyView = new Uint8Array(rewrittenBody.buffer, rewrittenBody.byteOffset, rewrittenBody.byteLength);
    requestInit.body = rewrittenBodyView as unknown as BodyInit;
    requestInit.headers = new Headers(requestInit.headers);
    (requestInit.headers as Headers).set('content-length', String(rewrittenBody.byteLength));
  } else if (hasBody) {
    requestInit.body = request as unknown as BodyInit;
    requestInit.duplex = 'half';
  }

  request.once('aborted', abortUpstream);
  response.once('close', abortUpstream);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(upstreamUrl, requestInit);
  } catch (error) {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
    if (abortController.signal.aborted) {
      if (!response.destroyed) {
        response.destroy();
      }
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    sendJson(request, response, 502, { error: `Gemini upstream request failed: ${message}` }, config.allowedOrigins);
    return;
  }

  response.writeHead(
    upstreamResponse.status,
    buildProxyResponseHeaders(request, upstreamResponse, config.allowedOrigins),
  );

  if (!upstreamResponse.body) {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
    response.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstreamResponse.body as unknown as NodeReadableStream), response);
  } catch (error) {
    if (!abortController.signal.aborted && !response.destroyed) {
      response.destroy(error instanceof Error ? error : undefined);
    }
  } finally {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
  }
}

export function createServer(config: CreateServerConfig, dependencies: CreateServerDependencies = {}): http.Server {
  const resolvedConfig: ResolvedServerConfig = {
    ...config,
    allowedOrigins: config.allowedOrigins ?? [],
    backendFlavor: config.backendFlavor ?? 'aistudio',
  };

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const readLocalClipboardImage = dependencies.readLocalClipboardImage ?? readMacOsClipboardPng;
  const vertexAuth = dependencies.vertexAuth;
  const gcsFilesAdapter = dependencies.gcsFilesAdapter;

  return http.createServer(async (request, response) => {
    try {
      const corsHeaders = getCorsHeaders(request, resolvedConfig.allowedOrigins);
      const requestUrl = new URL(request.url || '/', 'http://localhost');
      const path = requestUrl.pathname;
      const method = request.method || 'GET';

      if (method === 'OPTIONS') {
        response.writeHead(204, {
          ...corsHeaders,
          'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers':
            (request.headers['access-control-request-headers'] as string | undefined) || '*',
        });
        response.end();
        return;
      }

      if (method === 'GET' && path === '/health') {
        sendJson(
          request,
          response,
          200,
          {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
          },
          resolvedConfig.allowedOrigins,
        );
        return;
      }

      if (path === IMAGE_PROXY_PATH) {
        await proxyExternalImage(request, response, requestUrl, resolvedConfig.allowedOrigins, fetchImpl);
        return;
      }

      if (path === LOCAL_CLIPBOARD_IMAGE_PATH) {
        await handleLocalClipboardImageRequest(
          request,
          response,
          resolvedConfig.allowedOrigins,
          readLocalClipboardImage,
        );
        return;
      }

      if (path === GEMINI_PROXY_PREFIX || path.startsWith(`${GEMINI_PROXY_PREFIX}/`)) {
        await proxyGeminiRequest(request, response, resolvedConfig, fetchImpl, vertexAuth, gcsFilesAdapter);
        return;
      }

      sendJson(request, response, 404, { error: 'Not found' }, resolvedConfig.allowedOrigins);
    } catch {
      sendJson(request, response, 500, { error: 'Internal server error' }, resolvedConfig.allowedOrigins);
    }
  });
}
