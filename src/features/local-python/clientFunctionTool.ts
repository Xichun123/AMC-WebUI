import type { FunctionDeclaration, Type } from '@google/genai';
import type { ExecutionResult } from './pyodideService';
import type { UploadedFile } from '@/types';
import { createUploadedFileFromBase64 } from '@/utils/chat/parsing';
import { hasGeneratedImageFile } from './executionFiles';

type PythonRunOptions = { files?: UploadedFile[]; abortSignal?: AbortSignal };
type PythonRunResult = Omit<ExecutionResult, 'status'>;

const describeInputFile = ({ name, type }: UploadedFile) => ({ name, type });

const getAvailableInputFiles = (files: UploadedFile[] = []) =>
  files.filter((file) => !!file.rawFile).map(describeInputFile);

const formatAvailableInputFiles = (files: UploadedFile[] = []) => {
  const availableInputFiles = getAvailableInputFiles(files);
  if (availableInputFiles.length === 0) {
    return '';
  }

  return ` Uploaded files are mounted in the current working directory. Use these exact filenames: ${availableInputFiles
    .map((file) => `"${file.name}" (${file.type || 'unknown type'})`)
    .join(', ')}.`;
};

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

export const createLocalPythonToolDeclaration = (
  options: { inputFiles?: UploadedFile[] } = {},
): FunctionDeclaration => {
  const fileContext = formatAvailableInputFiles(options.inputFiles);

  return {
    name: 'run_local_python',
    description: `Execute Python code locally in the browser with Pyodide. Use this for calculations, data analysis, CSV inspection, image annotation, and lightweight plots.${fileContext} Use Pillow/PIL for image work; do not import cv2/OpenCV.`,
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        code: {
          type: 'STRING' as Type,
          description:
            'The Python code to execute locally. Uploaded files, if any, are mounted in the current working directory using their exact filenames.',
        },
      },
      required: ['code'],
    },
  };
};

export const createLocalPythonToolHandler = <RunOptions extends PythonRunOptions>({
  getRunOptions,
  runPython,
}: CreateLocalPythonToolHandlerOptions<RunOptions>) => {
  return async (args: unknown, options?: { abortSignal?: AbortSignal }) => {
    const code = typeof args === 'object' && args !== null ? (args as { code?: unknown }).code : undefined;

    if (typeof code !== 'string' || !code.trim()) {
      throw new Error('run_local_python requires a non-empty "code" string.');
    }

    const runOptions = getRunOptions(options);
    const availableInputFiles = getAvailableInputFiles(runOptions.files);
    let result: PythonRunResult;

    try {
      result = await runPython(code, runOptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        response: {
          status: 'failed',
          error: message,
          availableInputFiles,
          nextAction:
            'Do not retry the same code unchanged. If an import failed, use only the available Pyodide libraries such as PIL/Pillow, numpy, pandas, scipy, matplotlib, and sklearn. If a file was not found, use one of the exact availableInputFiles names. If the task cannot continue, explain the failure to the user.',
        },
        generatedFiles: [],
      };
    }

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
        availableInputFiles,
        generatedFiles: outputFiles.map(({ name, type }) => ({ name, type })),
        nextAction:
          'Use these execution results to answer the user. Do not call run_local_python again unless a new or corrected computation is required.',
      },
      generatedFiles,
    };
  };
};
