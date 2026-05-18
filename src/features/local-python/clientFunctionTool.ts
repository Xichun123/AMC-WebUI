import type { FunctionDeclaration, Type } from '@google/genai';
import type { ExecutionResult } from './pyodideService';
import type { UploadedFile } from '@/types';
import { createUploadedFileFromBase64 } from '@/utils/chat/parsing';
import { hasGeneratedImageFile } from './executionFiles';

type PythonRunOptions = { files?: UploadedFile[]; abortSignal?: AbortSignal };
type PythonRunResult = Omit<ExecutionResult, 'status'>;

const summarizeLocalPythonResult = (result: PythonRunResult, outputFiles: PythonRunResult['files'] = []): string => {
  const details: string[] = [];

  if (result.output?.trim()) {
    details.push('stdout/stderr output was captured');
  }
  if (result.result) {
    details.push('a Python expression result was returned');
  }
  if (result.image || outputFiles.some((file) => file.type.startsWith('image/'))) {
    details.push('an image artifact was generated');
  }
  if (outputFiles.length > 0) {
    details.push(`generated files: ${outputFiles.map((file) => file.name).join(', ')}`);
  }

  return details.length > 0
    ? `Python execution completed successfully; ${details.join('; ')}.`
    : 'Python execution completed successfully with no stdout or generated files.';
};

interface CreateLocalPythonToolHandlerOptions<RunOptions extends PythonRunOptions> {
  getRunOptions: (options?: { abortSignal?: AbortSignal }) => RunOptions;
  runPython: (code: string, options?: RunOptions) => Promise<PythonRunResult>;
}

export const createLocalPythonToolDeclaration = (): FunctionDeclaration => ({
  name: 'run_local_python',
  description:
    'Execute Python code locally in the browser with Pyodide. Use this for calculations, data analysis, CSV inspection, and lightweight plots.',
  parameters: {
    type: 'OBJECT' as Type,
    properties: {
      code: {
        type: 'STRING' as Type,
        description: 'The Python code to execute locally.',
      },
    },
    required: ['code'],
  },
});

export const createLocalPythonToolHandler = <RunOptions extends PythonRunOptions>({
  getRunOptions,
  runPython,
}: CreateLocalPythonToolHandlerOptions<RunOptions>) => {
  return async (args: unknown, options?: { abortSignal?: AbortSignal }) => {
    const code = typeof args === 'object' && args !== null ? (args as { code?: unknown }).code : undefined;

    if (typeof code !== 'string' || !code.trim()) {
      throw new Error('run_local_python requires a non-empty "code" string.');
    }

    const result = await runPython(code, getRunOptions(options));
    const outputFiles = result.files || [];
    const generatedFiles = [...outputFiles].map((file) =>
      createUploadedFileFromBase64(file.data, file.type, file.name),
    );

    if (result.image && !hasGeneratedImageFile(outputFiles)) {
      generatedFiles.unshift(createUploadedFileFromBase64(result.image, 'image/png', `generated-plot-${Date.now()}`));
    }

    return {
      response: {
        status: 'completed',
        summary: summarizeLocalPythonResult(result, outputFiles),
        output: result.output || null,
        result: result.result || null,
        imageGenerated: !!result.image,
        generatedFiles: outputFiles.map(({ name, type }) => ({ name, type })),
        nextAction:
          'Use these execution results to answer the user. Do not call run_local_python again unless a new or corrected computation is required.',
      },
      generatedFiles,
    };
  };
};
