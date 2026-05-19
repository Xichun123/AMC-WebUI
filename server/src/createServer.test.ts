// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, readMacOsClipboardPng } from './createServer';
import { createGcsFilesAdapter, type StorageLike } from './gcsFilesAdapter';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { Writable } from 'node:stream';

function createInMemoryAdapter() {
  const files = new Map<string, { data: Buffer; contentType: string; metadata: Record<string, string> }>();
  const storage: StorageLike = {
    bucket: (bucketName: string) => ({
      file: (path: string) => {
        const key = `${bucketName}/${path}`;
        return {
          save: async (data: Buffer, options) => {
            files.set(key, {
              data,
              contentType: options.metadata?.contentType ?? options.contentType ?? 'application/octet-stream',
              metadata: options.metadata?.metadata ?? {},
            });
          },
          createWriteStream: (options) => {
            const chunks: Buffer[] = [];
            return new Writable({
              write: (chunk, _encoding, callback) => {
                chunks.push(Buffer.from(chunk));
                callback();
              },
              final: (callback) => {
                files.set(key, {
                  data: Buffer.concat(chunks),
                  contentType: options.metadata?.contentType ?? options.contentType ?? 'application/octet-stream',
                  metadata: options.metadata?.metadata ?? {},
                });
                callback();
              },
            });
          },
          getMetadata: async () => {
            const f = files.get(key);
            if (!f) throw new Error('not found');
            return [
              {
                size: f.data.byteLength,
                contentType: f.contentType,
                metadata: f.metadata,
                timeCreated: '2026-05-18T00:00:00.000Z',
                updated: '2026-05-18T00:00:00.000Z',
              },
            ];
          },
          exists: async () => [files.has(key)],
        };
      },
    }),
  };

  return createGcsFilesAdapter({
    storage,
    config: { bucketName: 'test-bucket', objectPrefix: 'amc-files/', maxFileBytes: 1024 * 1024 },
    randomId: () => 'test-id',
    now: () => new Date('2026-05-18T12:00:00.000Z'),
  });
}

async function startHttpServer(server: http.Server): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

const cleanupCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanupCallbacks.length) {
    const close = cleanupCallbacks.pop();
    if (close) {
      await close();
    }
  }
});

describe('createServer', () => {
  it('returns health details from GET /health', async () => {
    const app = createServer({
      geminiApiBase: 'https://generativelanguage.googleapis.com',
      geminiApiKey: 'server-key',
    });
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/health`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });

  it('does not expose a Live API token endpoint', async () => {
    const app = createServer({
      geminiApiBase: 'https://generativelanguage.googleapis.com',
      geminiApiKey: 'server-key',
    });
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/live-token`, { method: 'POST' });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Not found' });
  });

  it('allows Nginx auth checks when site auth is disabled', async () => {
    const app = createServer({
      geminiApiBase: 'https://generativelanguage.googleapis.com',
      geminiApiKey: 'server-key',
    });
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/auth/check`);

    expect(response.status).toBe(204);
  });

  it('creates a signed HttpOnly session cookie for valid Unicode site credentials', async () => {
    const app = createServer({
      geminiApiBase: 'https://generativelanguage.googleapis.com',
      geminiApiKey: 'server-key',
      siteAuth: {
        enabled: true,
        users: [
          {
            username: '慧慧',
            passwordHash:
              'scrypt:16384:8:1:MTIzNDU2Nzg5MGFiY2RlZg:h_ic4pcaUFg3JgmnKJiC2SSVD8neGU1N9akiIuiOgajCqineFdTcYi8Jw_BAHTav1pnBYFyq-QlhH-NG_rnmtA',
          },
        ],
        secret: 'test-secret',
        sessionDays: 7,
      },
    });
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const loginResponse = await fetch(`${started.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: '慧慧', password: '棒棒棒' }),
    });
    const loginBody = (await loginResponse.json()) as Record<string, unknown>;
    const cookie = loginResponse.headers.get('set-cookie');

    expect(loginResponse.status).toBe(200);
    expect(loginBody).toEqual({ enabled: true, authenticated: true, username: '慧慧', sessionDays: 7 });
    expect(cookie).toContain('amc_site_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const checkResponse = await fetch(`${started.baseUrl}/api/auth/check`, { headers: { cookie: cookie ?? '' } });
    const sessionResponse = await fetch(`${started.baseUrl}/api/auth/session`, { headers: { cookie: cookie ?? '' } });
    const sessionBody = (await sessionResponse.json()) as Record<string, unknown>;

    expect(checkResponse.status).toBe(204);
    expect(sessionBody).toMatchObject({ enabled: true, authenticated: true, username: '慧慧' });
  });

  it('rejects invalid site credentials without setting a session cookie', async () => {
    const app = createServer({
      geminiApiBase: 'https://generativelanguage.googleapis.com',
      geminiApiKey: 'server-key',
      siteAuth: {
        enabled: true,
        users: [
          {
            username: 'amc',
            passwordHash:
              'scrypt:16384:8:1:MTIzNDU2Nzg5MGFiY2RlZg:LzZ3EClQHEFDhBxqzSupMkVXSEduprZmI7_139ButtFSI53MujICti6-yymDn8IXJdEjzDvUOYZk0fUnkXxI_g',
          },
        ],
        secret: 'test-secret',
        sessionDays: 7,
      },
    });
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'amc', password: 'wrong' }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'INVALID_CREDENTIALS' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('proxies /api/gemini/* preserving method/path/query/body and streaming response', async () => {
    const upstreamRequests: Array<{
      method: string;
      url: string;
      body: string;
      headers: http.IncomingHttpHeaders;
    }> = [];

    const upstream = http.createServer((request, response) => {
      const bodyChunks: Buffer[] = [];
      request.on('data', (chunk) => bodyChunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        upstreamRequests.push({
          method: request.method ?? '',
          url: request.url ?? '',
          body: Buffer.concat(bodyChunks).toString('utf8'),
          headers: request.headers,
        });

        response.writeHead(201, {
          'content-type': 'text/event-stream',
          'x-upstream': 'yes',
        });
        response.write('chunk-1\n');
        setTimeout(() => {
          response.write('chunk-2\n');
          response.end();
        }, 25);
      });
    });

    const upstreamStarted = await startHttpServer(upstream);
    cleanupCallbacks.push(upstreamStarted.close);

    const app = createServer({
      geminiApiBase: upstreamStarted.baseUrl,
      geminiApiKey: 'server-key',
    });
    const appStarted = await startHttpServer(app);
    cleanupCallbacks.push(appStarted.close);

    const proxyResponse = await fetch(
      `${appStarted.baseUrl}/api/gemini/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-client-header': 'present',
        },
        body: JSON.stringify({ prompt: 'hello' }),
      },
    );

    const proxyBody = await proxyResponse.text();

    expect(proxyResponse.status).toBe(201);
    expect(proxyResponse.headers.get('content-type')).toContain('text/event-stream');
    expect(proxyResponse.headers.get('x-upstream')).toBe('yes');
    expect(proxyBody).toContain('chunk-1');
    expect(proxyBody).toContain('chunk-2');

    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].method).toBe('POST');
    expect(upstreamRequests[0].url).toBe('/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse');
    expect(upstreamRequests[0].body).toBe(JSON.stringify({ prompt: 'hello' }));
    expect(upstreamRequests[0].headers['x-goog-api-key']).toBe('server-key');
    expect(upstreamRequests[0].headers['x-client-header']).toBe('present');
  });

  it('filters hop-by-hop and sensitive request headers before proxying', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('proxied', { status: 202 });
    });
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      { fetchImpl },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
      const request = http.request(`${started.baseUrl}/api/gemini/v1beta/models`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          connection: 'keep-alive',
          te: 'trailers',
          authorization: 'Bearer user-token',
          cookie: 'session=abc',
          'accept-encoding': 'gzip',
          'x-client-header': 'present',
        },
      });

      request.on('response', (proxyResponse) => {
        proxyResponse.resume();
        proxyResponse.on('end', () => {
          resolve({ statusCode: proxyResponse.statusCode ?? 0 });
        });
      });
      request.on('error', reject);
      request.end(JSON.stringify({ prompt: 'hello' }));
    });

    expect(response.statusCode).toBe(202);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error('Expected fetchImpl to be called once');
    }

    const init = firstCall[1];
    expect(init).toBeDefined();
    if (!init) {
      throw new Error('Expected fetchImpl to receive RequestInit');
    }

    const headers = init.headers;
    expect(headers).toBeInstanceOf(Headers);
    if (!(headers instanceof Headers)) {
      throw new Error('Expected proxy request headers to be a Headers instance');
    }

    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-client-header')).toBe('present');
    expect(headers.get('x-goog-api-key')).toBe('server-key');
    expect(headers.get('connection')).toBeNull();
    expect(headers.get('te')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('accept-encoding')).toBeNull();
  });

  it('uses the browser-provided Gemini API key for proxy requests when no server key is configured', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('proxied', { status: 202 });
    });
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: '',
      },
      { fetchImpl },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/gemini/v1beta/models`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': 'browser-key',
      },
      body: JSON.stringify({ prompt: 'hello' }),
    });

    expect(response.status).toBe(202);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const init = fetchImpl.mock.calls[0][1];
    if (!init?.headers || !(init.headers instanceof Headers)) {
      throw new Error('Expected proxy request headers to be a Headers instance');
    }

    expect(init.headers.get('x-goog-api-key')).toBe('browser-key');
  });

  it('returns a 502 JSON error when Gemini upstream fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      { fetchImpl },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/gemini/v1beta/models`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: 'Gemini upstream request failed: network down',
    });
  });

  it('proxies external images through GET /api/image-proxy for PDF export', async () => {
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        fetchImpl: vi.fn(async () => {
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: {
              'content-type': 'image/png',
            },
          });
        }),
      },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(
      `${started.baseUrl}/api/image-proxy?url=${encodeURIComponent('https://cdn.example.com/diagram.png')}`,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('max-age');
    expect(Array.from(bytes)).toEqual([137, 80, 78, 71]);
  });

  it('rejects non-image image proxy responses', async () => {
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        fetchImpl: vi.fn(async () => {
          return new Response('not an image', {
            status: 200,
            headers: {
              'content-type': 'text/html',
            },
          });
        }),
      },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(
      `${started.baseUrl}/api/image-proxy?url=${encodeURIComponent('https://cdn.example.com/not-image')}`,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(415);
    expect(body).toEqual({ error: 'Image proxy target did not return an image.' });
  });

  it('rejects private network image proxy targets', async () => {
    const fetchImpl = vi.fn();
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      { fetchImpl },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(
      `${started.baseUrl}/api/image-proxy?url=${encodeURIComponent('http://127.0.0.1/private.png')}`,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Image proxy URL is not allowed.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the local clipboard image when available', async () => {
    const readLocalClipboardImage = vi.fn(async () => ({
      data: Buffer.from([137, 80, 78, 71]),
      mimeType: 'image/png',
      fileName: 'clipboard-image.png',
    }));
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      { readLocalClipboardImage },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/local-clipboard-image`);
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-clipboard-file-name')).toBe('clipboard-image.png');
    expect(Array.from(bytes)).toEqual([137, 80, 78, 71]);
  });

  it('returns 404 when no local clipboard image is available', async () => {
    const readLocalClipboardImage = vi.fn(async () => null);
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      { readLocalClipboardImage },
    );
    const started = await startHttpServer(app);
    cleanupCallbacks.push(started.close);

    const response = await fetch(`${started.baseUrl}/api/local-clipboard-image`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'No local clipboard image is available.' });
  });

  it('reads macOS clipboard PNG data from the JXA public.png pasteboard type', async () => {
    const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const execFileImpl = vi.fn(async () => ({
      stdout: `${pngBytes.toString('base64')}\n`,
      stderr: '',
    }));

    const image = await readMacOsClipboardPng(execFileImpl, 'darwin');

    expect(execFileImpl).toHaveBeenCalledWith(
      'osascript',
      ['-l', 'JavaScript', '-e', expect.stringContaining("dataForType($('public.png'))")],
      expect.objectContaining({
        encoding: 'utf8',
      }),
    );
    expect(image).not.toBeNull();
    expect(image?.mimeType).toBe('image/png');
    expect(image?.fileName).toBe('clipboard-image.png');
    expect(image?.data.equals(pngBytes)).toBe(true);
  });

  describe('vertex backend', () => {
    it('rewrites host, path, and headers to the Vertex publisher endpoint', async () => {
      const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response('vertex-ok', { status: 200 });
      });
      const vertexAuth = { getAccessToken: vi.fn(async () => 'access-token-123') };
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'my-proj', location: 'us-central1' },
        },
        { fetchImpl, vertexAuth },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(
        `${started.baseUrl}/api/gemini/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contents: [] }),
        },
      );

      expect(response.status).toBe(200);
      expect(vertexAuth.getAccessToken).toHaveBeenCalledTimes(1);

      const [url, init] = fetchImpl.mock.calls[0];
      expect(String(url)).toBe(
        'https://us-central1-aiplatform.googleapis.com/v1/projects/my-proj/locations/us-central1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      );
      expect(init?.headers).toBeInstanceOf(Headers);
      const headers = init?.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer access-token-123');
      expect(headers.get('x-goog-api-key')).toBeNull();
    });

    it('removes AI Studio-only toolConfig fields before forwarding model invocations to Vertex', async () => {
      const capturedRequests: Array<{ body: string; headers: Headers }> = [];
      const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          init?.body instanceof Uint8Array ? Buffer.from(init.body).toString('utf8') : String(init?.body ?? '');
        capturedRequests.push({ body, headers: init?.headers as Headers });
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      });
      const vertexAuth = { getAccessToken: vi.fn(async () => 'tok') };
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { fetchImpl, vertexAuth },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(
        `${started.baseUrl}/api/gemini/v1beta/models/gemini-3-flash-preview:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [],
            tools: [{ googleSearch: {} }],
            toolConfig: {
              includeServerSideToolInvocations: true,
            },
          }),
        },
      );

      expect(response.status).toBe(200);
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0].headers.get('content-length')).toBe(
        String(Buffer.byteLength(capturedRequests[0].body)),
      );
      expect(JSON.parse(capturedRequests[0].body)).toEqual({
        contents: [],
        tools: [{ googleSearch: {} }],
      });
    });

    it('preserves other toolConfig fields when removing Vertex-unsupported fields', async () => {
      const capturedBodies: string[] = [];
      const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          init?.body instanceof Uint8Array ? Buffer.from(init.body).toString('utf8') : String(init?.body ?? '');
        capturedBodies.push(body);
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      });
      const vertexAuth = { getAccessToken: vi.fn(async () => 'tok') };
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { fetchImpl, vertexAuth },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      await fetch(`${started.baseUrl}/api/gemini/v1beta/models/gemini-3-flash-preview:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [],
          toolConfig: {
            functionCallingConfig: { mode: 'AUTO' },
            includeServerSideToolInvocations: true,
          },
        }),
      });

      expect(JSON.parse(capturedBodies[0])).toEqual({
        contents: [],
        toolConfig: {
          functionCallingConfig: { mode: 'AUTO' },
        },
      });
    });

    it('removes functionResponse ids before forwarding tool responses to Vertex', async () => {
      const capturedBodies: string[] = [];
      const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          init?.body instanceof Uint8Array ? Buffer.from(init.body).toString('utf8') : String(init?.body ?? '');
        capturedBodies.push(body);
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      });
      const vertexAuth = { getAccessToken: vi.fn(async () => 'tok') };
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { fetchImpl, vertexAuth },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      await fetch(`${started.baseUrl}/api/gemini/v1beta/models/gemini-3-flash-preview:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    id: 'call-1',
                    name: 'run_local_python',
                    response: { output: '42' },
                  },
                },
              ],
            },
          ],
        }),
      });

      expect(JSON.parse(capturedBodies[0])).toEqual({
        contents: [
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'run_local_python',
                  response: { output: '42' },
                },
              },
            ],
          },
        ],
      });
    });

    it('returns 500 when access token retrieval fails', async () => {
      const fetchImpl = vi.fn();
      const vertexAuth = {
        getAccessToken: vi.fn(async () => {
          throw new Error('credential file missing');
        }),
      };
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'my-proj', location: 'us-central1' },
        },
        { fetchImpl, vertexAuth },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(`${started.baseUrl}/api/gemini/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(500);
      expect(body.error).toMatch(/credential file missing/);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('returns 500 when vertexAuth dependency is missing', async () => {
      const fetchImpl = vi.fn();
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'my-proj', location: 'us-central1' },
        },
        { fetchImpl },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(`${started.baseUrl}/api/gemini/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(500);
      expect(body.error).toMatch(/Vertex auth provider/);
    });
  });

  describe('vertex backend with GCS files adapter', () => {
    it('returns 503 for Files API routes when adapter is not configured', async () => {
      const vertexAuth = { getAccessToken: vi.fn(async () => 'access-token') };
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { vertexAuth },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(`${started.baseUrl}/api/gemini/upload/v1beta/files`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: { displayName: 'a', mimeType: 'text/plain', sizeBytes: '1' } }),
      });

      expect(response.status).toBe(503);
    });

    it('initiate → chunk → finalize → metadata flow returns AI-Studio shaped File', async () => {
      const vertexAuth = { getAccessToken: vi.fn(async () => 'tok') };
      const adapter = createInMemoryAdapter();
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { vertexAuth, gcsFilesAdapter: adapter },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const initiate = await fetch(`${started.baseUrl}/api/gemini/upload/v1beta/files`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          file: { displayName: 'doc.bin', mimeType: 'application/octet-stream', sizeBytes: '6' },
        }),
      });
      expect(initiate.status).toBe(200);
      const uploadUrl = initiate.headers.get('x-goog-upload-url');
      expect(uploadUrl).toMatch(/__gcs-upload-chunk__\//);

      const sessionId = uploadUrl!.split('/').pop()!;

      const firstChunk = await fetch(`${started.baseUrl}/api/gemini/__gcs-upload-chunk__/${sessionId}`, {
        method: 'POST',
        headers: { 'x-goog-upload-offset': '0', 'x-goog-upload-command': 'upload' },
        body: Buffer.from('foo'),
      });
      expect(firstChunk.status).toBe(200);
      expect(firstChunk.headers.get('x-goog-upload-status')).toBe('active');

      const finalChunk = await fetch(`${started.baseUrl}/api/gemini/__gcs-upload-chunk__/${sessionId}`, {
        method: 'POST',
        headers: { 'x-goog-upload-offset': '3', 'x-goog-upload-command': 'upload, finalize' },
        body: Buffer.from('bar'),
      });
      expect(finalChunk.status).toBe(200);
      expect(finalChunk.headers.get('x-goog-upload-status')).toBe('final');
      const finalBody = (await finalChunk.json()) as { file: { name: string; uri: string; state: string } };
      expect(finalBody.file.name).toBe('files/test-id');
      expect(finalBody.file.uri).toBe('https://generativelanguage.googleapis.com/v1beta/files/test-id');
      expect(finalBody.file.state).toBe('ACTIVE');

      const meta = await fetch(`${started.baseUrl}/api/gemini/v1beta/files/test-id`);
      expect(meta.status).toBe(200);
      const metaBody = (await meta.json()) as { name: string; state: string };
      expect(metaBody.name).toBe('files/test-id');
      expect(metaBody.state).toBe('ACTIVE');
    });

    it('allows initiating a 400MB video upload when the GCS limit permits it', async () => {
      const vertexAuth = { getAccessToken: vi.fn(async () => 'tok') };
      const storage: StorageLike = {
        bucket: () => ({
          file: () => ({
            save: vi.fn(),
            getMetadata: vi.fn(),
            exists: vi.fn(async (): Promise<[boolean]> => [false]),
          }),
        }),
      };
      const adapter = createGcsFilesAdapter({
        storage,
        config: { bucketName: 'test-bucket', objectPrefix: 'amc-files/', maxFileBytes: 2 * 1024 * 1024 * 1024 },
        randomId: () => 'video-session',
      });
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { vertexAuth, gcsFilesAdapter: adapter },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(`${started.baseUrl}/api/gemini/upload/v1beta/files`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          file: { displayName: 'large.mp4', mimeType: 'video/mp4', sizeBytes: String(400 * 1024 * 1024) },
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('x-goog-upload-status')).toBe('active');
      expect(response.headers.get('x-goog-upload-url')).toContain('/__gcs-upload-chunk__/video-session');
    });

    it('rewrites AI Studio file URIs in generateContent body to gs:// URIs', async () => {
      const capturedRequests: Array<{ url: string; body: string }> = [];
      const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body =
          init?.body instanceof Uint8Array ? Buffer.from(init.body).toString('utf8') : String(init?.body ?? '');
        capturedRequests.push({ url: String(input), body });
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      });
      const vertexAuth = { getAccessToken: vi.fn(async () => 'tok') };
      const adapter = createInMemoryAdapter();
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { fetchImpl, vertexAuth, gcsFilesAdapter: adapter },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: 'image/png',
                  fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc-123',
                },
              },
            ],
          },
        ],
      };

      const response = await fetch(`${started.baseUrl}/api/gemini/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(200);
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0].body).toContain('"fileUri":"gs://test-bucket/amc-files/abc-123"');
      expect(capturedRequests[0].body).not.toContain('generativelanguage.googleapis.com');
    });

    it('returns 400 when initiate metadata is malformed', async () => {
      const vertexAuth = { getAccessToken: vi.fn() };
      const adapter = createInMemoryAdapter();
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { vertexAuth, gcsFilesAdapter: adapter },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(`${started.baseUrl}/api/gemini/upload/v1beta/files`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"file":{"displayName":"a"}}',
      });

      expect(response.status).toBe(400);
    });

    it('returns 404 for unknown file metadata', async () => {
      const vertexAuth = { getAccessToken: vi.fn() };
      const adapter = createInMemoryAdapter();
      const app = createServer(
        {
          geminiApiBase: 'https://example.test',
          geminiApiKey: '',
          backendFlavor: 'vertex',
          vertex: { projectId: 'p', location: 'us-central1' },
        },
        { vertexAuth, gcsFilesAdapter: adapter },
      );
      const started = await startHttpServer(app);
      cleanupCallbacks.push(started.close);

      const response = await fetch(`${started.baseUrl}/api/gemini/v1beta/files/missing-id`);
      expect(response.status).toBe(404);
    });
  });
});
