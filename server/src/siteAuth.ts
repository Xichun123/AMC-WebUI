import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const COOKIE_NAME = 'amc_site_session';
const DEFAULT_SESSION_DAYS = 7;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

interface SiteAuthUser {
  username: string;
  passwordHash: string;
}

interface SiteAuthConfig {
  enabled: boolean;
  users: SiteAuthUser[];
  secret?: string;
  sessionDays: number;
}

interface EnvLike {
  [key: string]: string | undefined;
}

interface SiteSession {
  username: string;
  exp: number;
}

function deriveScryptKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function decodeBase64UrlJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function safeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.byteLength === bBuffer.byteLength && timingSafeEqual(aBuffer, bBuffer);
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSiteAuthUsers(rawUsers: string | undefined): SiteAuthUser[] {
  const trimmed = rawUsers?.trim();
  if (!trimmed) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `SITE_AUTH_USERS_JSON must be a JSON array of { username, passwordHash } entries: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('SITE_AUTH_USERS_JSON must be a JSON array.');
  }

  const users = parsed.map((entry, index): SiteAuthUser => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`SITE_AUTH_USERS_JSON entry ${index + 1} must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const username = typeof record.username === 'string' ? record.username.trim() : '';
    const passwordHash = typeof record.passwordHash === 'string' ? record.passwordHash.trim() : '';
    if (!username || !passwordHash) {
      throw new Error(`SITE_AUTH_USERS_JSON entry ${index + 1} requires username and passwordHash.`);
    }

    return { username, passwordHash };
  });

  const seen = new Set<string>();
  for (const user of users) {
    if (seen.has(user.username)) {
      throw new Error(`SITE_AUTH_USERS_JSON contains a duplicate username: ${user.username}`);
    }
    seen.add(user.username);
  }

  return users;
}

export function loadSiteAuthConfig(env: EnvLike = process.env): SiteAuthConfig {
  const users = parseSiteAuthUsers(env.SITE_AUTH_USERS_JSON);
  if (!users.length) {
    return { enabled: false, users: [], sessionDays: DEFAULT_SESSION_DAYS };
  }

  const secret = env.SITE_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('SITE_AUTH_SECRET is required when SITE_AUTH_USERS_JSON contains users.');
  }

  return {
    enabled: true,
    users,
    secret,
    sessionDays: parsePositiveInteger(env.SITE_AUTH_SESSION_DAYS, DEFAULT_SESSION_DAYS),
  };
}

export async function createSitePasswordHash(password: string, salt = randomBytes(SCRYPT_SALT_BYTES)): Promise<string> {
  const derivedKey = await deriveScryptKey(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64url')}:${derivedKey.toString('base64url')}`;
}

async function verifySitePassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  const n = Number.parseInt(rawN, 10);
  const r = Number.parseInt(rawR, 10);
  const p = Number.parseInt(rawP, 10);
  if (![n, r, p].every((value) => Number.isFinite(value) && value > 0)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(rawSalt, 'base64url');
    expected = Buffer.from(rawHash, 'base64url');
  } catch {
    return false;
  }

  if (!salt.byteLength || !expected.byteLength) {
    return false;
  }

  const actual = await deriveScryptKey(password, salt, expected.byteLength, { N: n, r, p });
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

function createSessionCookie(username: string, config: SiteAuthConfig, now = Date.now()): string {
  if (!config.secret) {
    throw new Error('Cannot create a site session without SITE_AUTH_SECRET.');
  }

  const payload = base64UrlJson({ username, exp: now + config.sessionDays * 24 * 60 * 60 * 1000 });
  const signature = sign(payload, config.secret);
  const maxAge = config.sessionDays * 24 * 60 * 60;
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(request: IncomingMessage, name: string): string | undefined {
  const rawCookie = request.headers.cookie;
  if (!rawCookie) {
    return undefined;
  }

  for (const cookiePart of rawCookie.split(';')) {
    const [rawName, ...rawValue] = cookiePart.trim().split('=');
    if (rawName === name) {
      return rawValue.join('=');
    }
  }

  return undefined;
}

function readSiteSession(request: IncomingMessage, config: SiteAuthConfig, now = Date.now()): SiteSession | null {
  if (!config.enabled) {
    return null;
  }

  const cookie = readCookie(request, COOKIE_NAME);
  const [payload, signature, ...extra] = cookie?.split('.') ?? [];
  if (!payload || !signature || extra.length > 0 || !config.secret) {
    return null;
  }

  if (!safeEqualString(sign(payload, config.secret), signature)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = decodeBase64UrlJson(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const { username, exp } = parsed as Record<string, unknown>;
  if (typeof username !== 'string' || typeof exp !== 'number' || exp <= now) {
    return null;
  }

  if (!config.users.some((user) => user.username === username)) {
    return null;
  }

  return { username, exp };
}

function sendAuthJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

async function readJsonRequestBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  return await new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    request.on('data', (chunk: Buffer) => {
      received += chunk.byteLength;
      if (received > maxBytes) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    request.on('error', reject);
  });
}

export async function handleSiteAuthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: SiteAuthConfig,
): Promise<boolean> {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const path = requestUrl.pathname;
  const method = request.method || 'GET';

  if (path === '/api/auth/check') {
    if (!config.enabled || readSiteSession(request, config)) {
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return true;
    }

    sendAuthJson(response, 401, { error: 'AUTH_REQUIRED' });
    return true;
  }

  if (path === '/api/auth/session') {
    const session = readSiteSession(request, config);
    sendAuthJson(response, 200, {
      enabled: config.enabled,
      authenticated: !config.enabled || Boolean(session),
      username: session?.username ?? null,
      expiresAt: session ? new Date(session.exp).toISOString() : null,
    });
    return true;
  }

  if (path === '/api/auth/login') {
    if (method !== 'POST') {
      sendAuthJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      return true;
    }

    if (!config.enabled) {
      sendAuthJson(response, 200, { enabled: false, authenticated: true, username: null });
      return true;
    }

    let credentials: unknown;
    try {
      credentials = await readJsonRequestBody(request, 16 * 1024);
    } catch {
      sendAuthJson(response, 400, { error: 'INVALID_REQUEST' });
      return true;
    }

    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
      sendAuthJson(response, 400, { error: 'INVALID_REQUEST' });
      return true;
    }

    const { username, password } = credentials as Record<string, unknown>;
    if (typeof username !== 'string' || typeof password !== 'string') {
      sendAuthJson(response, 400, { error: 'INVALID_REQUEST' });
      return true;
    }

    const user = config.users.find((entry) => entry.username === username.trim());
    if (!user || !(await verifySitePassword(password, user.passwordHash))) {
      sendAuthJson(response, 401, { error: 'INVALID_CREDENTIALS' });
      return true;
    }

    response.setHeader('set-cookie', createSessionCookie(user.username, config));
    sendAuthJson(response, 200, {
      enabled: true,
      authenticated: true,
      username: user.username,
      sessionDays: config.sessionDays,
    });
    return true;
  }

  return false;
}
