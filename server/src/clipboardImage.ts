import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getCorsHeaders, sendJson } from './cors.js';

export const LOCAL_CLIPBOARD_IMAGE_PATH = '/api/local-clipboard-image';

const MAX_LOCAL_CLIPBOARD_IMAGE_BYTES = 25 * 1024 * 1024;
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

export interface LocalClipboardImage {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { encoding: 'utf8'; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

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

export async function handleLocalClipboardImageRequest(
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
