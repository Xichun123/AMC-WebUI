import type { ChatSettings } from '@/types';

type CodeExecutionModeSettings = Pick<ChatSettings, 'isCodeExecutionEnabled' | 'isLocalPythonEnabled'>;

export const CODE_EXECUTION_TEXT_FILE_LIMIT_BYTES = 2 * 1024 * 1024;

export const isServerCodeExecutionMode = (settings: CodeExecutionModeSettings): boolean =>
  Boolean(settings.isCodeExecutionEnabled && !settings.isLocalPythonEnabled);
