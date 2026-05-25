import type { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalApiPlugin } from '../../../vite/localApiPlugin';

type Middleware = (
  request: { method?: string; url?: string; headers?: Record<string, string> } & Partial<
    AsyncIterable<Buffer | string | Uint8Array>
  >,
  response: {
    writeHead: (status: number, headers: Record<string, string>) => void;
    end: (body?: string | Uint8Array) => void;
  },
  next: () => void,
) => void;

const getRegisteredMiddleware = (): Middleware => {
  let middleware: Middleware | null = null;
  const plugin = createLocalApiPlugin() as {
    configureServer?: (server: { middlewares: { use: (handler: Middleware) => void } }) => void;
  };

  plugin.configureServer?.({
    middlewares: {
      use: (handler: Middleware) => {
        middleware = handler;
      },
    },
  } as never);

  if (!middleware) {
    throw new Error('Expected local API middleware to be registered.');
  }

  return middleware;
};

const waitForAsyncMiddleware = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('createLocalApiPlugin', () => {
  const originalFetch = globalThis.fetch;
  const originalMcpApiBaseUrl = process.env.MCP_API_BASE_URL;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMcpApiBaseUrl === undefined) {
      delete process.env.MCP_API_BASE_URL;
    } else {
      process.env.MCP_API_BASE_URL = originalMcpApiBaseUrl;
    }
  });

  it('proxies local MCP API requests to the configured API server', async () => {
    process.env.MCP_API_BASE_URL = 'http://127.0.0.1:3999';
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const middleware = getRegisteredMiddleware();
    const response = {
      writeHead: vi.fn((_status: number, _headers: Record<string, string>) => undefined),
      end: vi.fn((_body?: string | Uint8Array) => undefined),
    };
    const next = vi.fn();
    const requestBody = JSON.stringify({ servers: [] });

    middleware(
      {
        method: 'POST',
        url: '/api/mcp/tools',
        headers: {
          'content-type': 'application/json',
        },
        async *[Symbol.asyncIterator]() {
          yield requestBody;
        },
      },
      response,
      next,
    );
    await waitForAsyncMiddleware();

    expect(next).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe('http://127.0.0.1:3999/api/mcp/tools');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get('content-type')).toBe('application/json');
    expect(await (init?.body as Blob).text()).toBe(requestBody);
    expect(response.writeHead).toHaveBeenCalledWith(
      202,
      expect.objectContaining({
        'content-type': 'application/json; charset=utf-8',
      }),
    );
    const [body] = response.end.mock.calls[0] as [string | Uint8Array | undefined];
    expect(new TextDecoder().decode(body as Uint8Array)).toContain('"ok":true');
  });
});
