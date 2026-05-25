import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseRecorder, mockCreateObjectURL, mockRevokeObjectURL } = vi.hoisted(() => ({
  mockUseRecorder: vi.fn(),
  mockCreateObjectURL: vi.fn(),
  mockRevokeObjectURL: vi.fn(),
}));

vi.mock('@/hooks/core/useRecorder', () => ({
  useRecorder: mockUseRecorder,
}));

import { useAudioRecorder } from './useAudioRecorder';
import { renderHook } from '@/test/render/renderer';

describe('useAudioRecorder', () => {
  const recorderState = {
    status: 'idle' as 'idle' | 'recording' | 'paused',
    isInitializing: false,
    duration: 0,
    error: null as string | null,
    stream: null as MediaStream | null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    onStop: undefined as ((blob: Blob) => void) | undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReset();
    mockRevokeObjectURL.mockReset();
    recorderState.status = 'idle';
    recorderState.isInitializing = false;
    recorderState.duration = 0;
    recorderState.error = null;
    recorderState.stream = null;
    recorderState.startRecording = vi.fn();
    recorderState.stopRecording = vi.fn();
    recorderState.cancelRecording = vi.fn();
    recorderState.onStop = undefined;
    mockCreateObjectURL
      .mockReturnValueOnce('blob:recording-url-1')
      .mockReturnValueOnce('blob:recording-url-2')
      .mockReturnValue('blob:recording-url-latest');

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mockCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mockRevokeObjectURL,
    });

    mockUseRecorder.mockImplementation((options?: { onStop?: (blob: Blob) => void }) => {
      recorderState.onStop = options?.onStop;
      return {
        status: recorderState.status,
        isInitializing: recorderState.isInitializing,
        duration: recorderState.duration,
        error: recorderState.error,
        stream: recorderState.stream,
        startRecording: recorderState.startRecording,
        stopRecording: recorderState.stopRecording,
        cancelRecording: recorderState.cancelRecording,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives review state from a completed recording and recording state from recorder status', () => {
    const { result, rerender, unmount } = renderHook(() => useAudioRecorder());

    expect(result.current.viewState).toBe('idle');

    recorderState.status = 'recording';
    rerender();

    expect(result.current.viewState).toBe('recording');

    const blob = new Blob(['audio'], { type: 'audio/webm' });

    act(() => {
      recorderState.onStop?.(blob);
    });

    expect(result.current.viewState).toBe('review');
    expect(result.current.audioBlob).toBe(blob);
    expect(result.current.audioUrl).toBe('blob:recording-url-1');

    unmount();
  });

  it('releases each replaced recording URL exactly once', () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());

    act(() => {
      recorderState.onStop?.(new Blob(['first'], { type: 'audio/webm' }));
    });

    expect(result.current.audioUrl).toBe('blob:recording-url-1');
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();

    act(() => {
      recorderState.onStop?.(new Blob(['second'], { type: 'audio/webm' }));
    });

    expect(result.current.audioUrl).toBe('blob:recording-url-2');
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:recording-url-1');

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    expect(mockRevokeObjectURL).toHaveBeenLastCalledWith('blob:recording-url-2');
  });

  it('does not release a discarded recording URL again on unmount', () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());

    act(() => {
      recorderState.onStop?.(new Blob(['audio'], { type: 'audio/webm' }));
    });

    expect(result.current.audioUrl).toBe('blob:recording-url-1');

    act(() => {
      result.current.discardRecording();
    });

    expect(result.current.audioUrl).toBeNull();
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:recording-url-1');

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
