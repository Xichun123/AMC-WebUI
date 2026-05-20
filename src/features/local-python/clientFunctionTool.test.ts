import { Type } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { createUploadedFile } from '@/test/factories';
import { createLocalPythonToolDeclaration, createLocalPythonToolHandler } from './clientFunctionTool';

describe('local Python client function tool helpers', () => {
  it('builds the shared run_local_python declaration used by standard and live chat', () => {
    expect(createLocalPythonToolDeclaration()).toMatchObject({
      name: 'run_local_python',
      parameters: {
        type: Type.OBJECT,
        required: ['code'],
        properties: {
          code: {
            type: Type.STRING,
          },
        },
      },
    });
  });

  it('describes mounted input files with exact filenames for image annotation code', () => {
    const declaration = createLocalPythonToolDeclaration({
      inputFiles: [
        createUploadedFile({
          name: 'CleanShot 2026-05-20 at 11.21.51@2x.png',
          type: 'image/png',
          rawFile: new File(['png'], 'CleanShot 2026-05-20 at 11.21.51@2x.png', { type: 'image/png' }),
        }),
      ],
    });

    expect(declaration.description).toContain('CleanShot 2026-05-20 at 11.21.51@2x.png');
    expect(declaration.description).toContain('mounted in the current working directory');
    expect(declaration.description).toContain('Use these exact filenames');
  });

  it('runs Python with files and adapts output files into chat attachments', async () => {
    const runPython = vi.fn(async () => ({
      output: '42',
      result: '42',
      image: 'base64-image',
      files: [{ name: 'chart.png', type: 'image/png', data: 'Zm9v' }],
    }));
    const handler = createLocalPythonToolHandler({
      getRunOptions: () => ({ files: [] }),
      runPython,
    });

    await expect(handler({ code: 'print(42)' })).resolves.toMatchObject({
      response: {
        status: 'completed',
        summary:
          'Python execution completed successfully; stdout/stderr output was captured; a Python expression result was returned; an image artifact was generated; generated files: chart.png.',
        output: '42',
        result: '42',
        imageGenerated: true,
        availableInputFiles: [],
        generatedFiles: [{ name: 'chart.png', type: 'image/png' }],
        nextAction:
          'Use these execution results to answer the user. Do not call run_local_python again unless a new or corrected computation is required.',
      },
      generatedFiles: [
        {
          name: 'chart.png',
          type: 'image/png',
          uploadState: 'active',
        },
      ],
    });
    expect(runPython).toHaveBeenCalledWith('print(42)', { files: [] });
  });

  it('returns structured execution failures with mounted file context instead of throwing', async () => {
    const runPython = vi.fn(async () => {
      throw new Error("ModuleNotFoundError: No module named 'cv2'");
    });
    const screenshot = createUploadedFile({
      name: 'settings-screen.png',
      type: 'image/png',
      rawFile: new File(['png'], 'settings-screen.png', { type: 'image/png' }),
    });
    const handler = createLocalPythonToolHandler({
      getRunOptions: () => ({ files: [screenshot] }),
      runPython,
    });

    await expect(handler({ code: 'import cv2' })).resolves.toMatchObject({
      response: {
        status: 'failed',
        error: "ModuleNotFoundError: No module named 'cv2'",
        availableInputFiles: [{ name: 'settings-screen.png', type: 'image/png' }],
        nextAction: expect.stringContaining('Do not retry the same code unchanged'),
      },
      generatedFiles: [],
    });
  });

  it('keeps generated BMP output files as image attachments instead of .bin files', async () => {
    const runPython = vi.fn(async () => ({
      output: 'created bmp',
      files: [{ name: 'mime_fix_probe.bmp', type: 'image/bmp', data: 'Qk0=' }],
    }));
    const handler = createLocalPythonToolHandler({
      getRunOptions: () => ({ files: [] }),
      runPython,
    });

    await expect(handler({ code: 'write_bmp()' })).resolves.toMatchObject({
      response: {
        generatedFiles: [{ name: 'mime_fix_probe.bmp', type: 'image/bmp' }],
      },
      generatedFiles: [
        {
          name: 'mime_fix_probe.bmp',
          type: 'image/bmp',
          uploadState: 'active',
        },
      ],
    });
  });

  it('rejects missing Python code before calling the runner', async () => {
    const runPython = vi.fn();
    const handler = createLocalPythonToolHandler({
      getRunOptions: () => ({ files: [] }),
      runPython,
    });

    await expect(handler({})).rejects.toThrow('run_local_python requires a non-empty "code" string.');
    expect(runPython).not.toHaveBeenCalled();
  });
});
