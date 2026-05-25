import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type UploadedFile, MediaResolution } from '@/types';
import { useLiveModeHandler } from './useLiveModeHandler';
import { renderHook } from '@/test/render/renderer';
import { createAppSettings, createChatSettings } from '@/test/data/factories';

const { mockBuildContentParts, mockEnsureFilesApiReferences } = vi.hoisted(() => ({
  mockBuildContentParts: vi.fn(),
  mockEnsureFilesApiReferences: vi.fn(),
}));

vi.mock('@/utils/chat/builder', () => ({
  buildContentParts: mockBuildContentParts,
}));

vi.mock('@/features/message-sender/fileApiReference', () => ({
  ensureFilesApiReferences: mockEnsureFilesApiReferences,
}));

const makeFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
  id: 'file-1',
  name: 'clip.mp4',
  type: 'video/mp4',
  size: 100,
  uploadState: 'active',
  ...overrides,
});

describe('useLiveModeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildContentParts.mockResolvedValue({
      contentParts: [{ text: 'hello' }, { fileData: { mimeType: 'video/mp4', fileUri: 'files/clip' } }],
      enrichedFiles: [makeFile({ fileUri: 'files/clip' })],
    });
    mockEnsureFilesApiReferences.mockImplementation(async ({ files }) => ({ ok: true, files }));
  });

  it('routes non-live messages to the standard sender', async () => {
    const onSendMessage = vi.fn();
    const liveApi = {
      isConnected: false,
      connect: vi.fn(),
      sendText: vi.fn(),
      sendContent: vi.fn(),
    };

    const { result, unmount } = renderHook(() =>
      useLiveModeHandler({
        isNativeAudioModel: false,
        selectedFiles: [],
        setSelectedFiles: vi.fn(),
        setAppFileError: vi.fn(),
        appSettings: createAppSettings(),
        currentChatSettings: createChatSettings({ modelId: 'gemini-3.1-pro' }),
        currentModelId: 'gemini-3.1-pro',
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
        liveApi,
        onAddUserMessage: vi.fn(),
        onSendMessage,
      }),
    );

    await act(async () => {
      await result.current.handleSmartSendMessage('hello', { isFastMode: true });
    });

    expect(onSendMessage).toHaveBeenCalledWith('hello', { isFastMode: true });
    expect(liveApi.connect).not.toHaveBeenCalled();
    expect(liveApi.sendText).not.toHaveBeenCalled();
    unmount();
  });

  it('connects live mode, sends built file content, records the user turn, and clears attachments', async () => {
    const files = [makeFile()];
    const setSelectedFiles = vi.fn();
    const onAddUserMessage = vi.fn();
    const liveApi = {
      isConnected: false,
      connect: vi.fn().mockResolvedValue(true),
      sendText: vi.fn(),
      sendContent: vi.fn().mockResolvedValue(true),
    };

    const { result, unmount } = renderHook(() =>
      useLiveModeHandler({
        isNativeAudioModel: true,
        selectedFiles: files,
        setSelectedFiles,
        setAppFileError: vi.fn(),
        appSettings: createAppSettings({ useCustomApiConfig: true, apiKey: 'api-key' }),
        currentChatSettings: createChatSettings({ modelId: 'gemini-3.1-flash-live' }),
        currentModelId: 'gemini-3.1-flash-live',
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        liveApi,
        onAddUserMessage,
        onSendMessage: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleSmartSendMessage('hello');
    });

    expect(liveApi.connect).toHaveBeenCalledTimes(1);
    expect(mockBuildContentParts).toHaveBeenCalledWith(
      'hello',
      files,
      'gemini-3.1-flash-live',
      MediaResolution.MEDIA_RESOLUTION_LOW,
    );
    expect(liveApi.sendContent).toHaveBeenCalledWith([
      { text: 'hello' },
      { fileData: { mimeType: 'video/mp4', fileUri: 'files/clip' } },
    ]);
    expect(onAddUserMessage).toHaveBeenCalledWith('hello', [makeFile({ fileUri: 'files/clip' })]);
    expect(setSelectedFiles).toHaveBeenCalledWith([]);
    unmount();
  });

  it('refreshes Files API references before sending live file content', async () => {
    const staleFile = makeFile({
      id: 'file-stale',
      fileApiName: 'files/stale',
      fileUri: 'https://files/stale',
      rawFile: new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
    });
    const refreshedFile = {
      ...staleFile,
      fileApiName: 'files/refreshed',
      fileUri: 'https://files/refreshed',
    };
    const setSelectedFiles = vi.fn();
    const liveApi = {
      isConnected: true,
      connect: vi.fn(),
      sendText: vi.fn(),
      sendContent: vi.fn().mockResolvedValue(true),
    };
    mockEnsureFilesApiReferences.mockResolvedValue({ ok: true, files: [refreshedFile] });
    mockBuildContentParts.mockResolvedValue({
      contentParts: [{ fileData: { mimeType: 'video/mp4', fileUri: 'https://files/refreshed' } }],
      enrichedFiles: [refreshedFile],
    });

    const { result, unmount } = renderHook(() =>
      useLiveModeHandler({
        isNativeAudioModel: true,
        selectedFiles: [staleFile],
        setSelectedFiles,
        setAppFileError: vi.fn(),
        appSettings: createAppSettings({ useCustomApiConfig: true, apiKey: 'api-key' }),
        currentChatSettings: createChatSettings({ modelId: 'gemini-3.1-flash-live' }),
        currentModelId: 'gemini-3.1-flash-live',
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        liveApi,
        onAddUserMessage: vi.fn(),
        onSendMessage: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleSmartSendMessage('hello');
    });

    expect(mockEnsureFilesApiReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [staleFile],
        apiKey: 'api-key',
        abortSignal: expect.any(AbortSignal),
      }),
    );
    expect(mockBuildContentParts).toHaveBeenCalledWith(
      'hello',
      [refreshedFile],
      'gemini-3.1-flash-live',
      MediaResolution.MEDIA_RESOLUTION_LOW,
    );
    expect(liveApi.sendContent).toHaveBeenCalledWith([
      { fileData: { mimeType: 'video/mp4', fileUri: 'https://files/refreshed' } },
    ]);
    unmount();
  });
});
