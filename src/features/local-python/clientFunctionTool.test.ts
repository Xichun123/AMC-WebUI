import { Type } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
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
