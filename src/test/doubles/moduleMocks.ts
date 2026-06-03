import { vi } from 'vitest';
import { createMockDbService, createMockLogService } from './services';

export const createDbServiceMockModule = (overrides?: Parameters<typeof createMockDbService>[0]) => ({
  dbService: createMockDbService(overrides),
});

export const createLogServiceMockModule = (overrides?: Parameters<typeof createMockLogService>[0]) => ({
  logService: createMockLogService(overrides),
});

type CreateMessage = (
  role: string,
  content: string,
  options?: Record<string, unknown>,
) => {
  id: unknown;
  role: string;
  content: string;
  timestamp: Date;
  [key: string]: unknown;
};

type ChatSessionMockModuleOptions = {
  performOptimisticSessionUpdate?: (prev: unknown, ...args: unknown[]) => unknown;
  createMessage?: CreateMessage;
  generateSessionTitle?: () => string;
  generatedTitle?: string;
};

export const createChatSessionMockModule = (options: ChatSessionMockModuleOptions = {}) => ({
  performOptimisticSessionUpdate: options.performOptimisticSessionUpdate ?? vi.fn((prev: unknown) => prev),
  createMessage:
    options.createMessage ??
    ((role: string, content: string, messageOptions: Record<string, unknown> = {}) => ({
      id: messageOptions.id ?? `${role}-message`,
      role,
      content,
      timestamp: new Date('2026-04-21T00:00:00.000Z'),
      ...messageOptions,
    })),
  generateSessionTitle: options.generateSessionTitle ?? vi.fn(() => options.generatedTitle ?? 'Generated Title'),
});
