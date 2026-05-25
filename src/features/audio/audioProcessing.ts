import { logService } from '@/services/logService';
import { decodeBase64ToArrayBuffer } from '@/utils/fileEncoding';
import { createManagedObjectUrl } from '@/services/objectUrlManager';

export { decodeBase64ToArrayBuffer };

/**
 * Decodes a raw PCM byte array into an AudioBuffer using the provided AudioContext.
 */
export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

/**
 * Encodes Float32 audio data (from AudioWorklet) into a PCM16 Base64 string.
 */
export const float32ToPCM16Base64 = (data: Float32Array): string => {
  const sampleCount = data.length;
  const int16 = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const byteLength = bytes.byteLength;
  for (let i = 0; i < byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const createWavBuffer = (pcmData: Uint8Array, sampleRate: number, numChannels: number): ArrayBuffer => {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const wav = new ArrayBuffer(44 + pcmData.length);
  const wavView = new DataView(wav);

  let writeOffset = 0;
  const writeString = (value: string) => {
    [...value].forEach((character) => wavView.setUint8(writeOffset++, character.charCodeAt(0)));
  };

  writeString('RIFF');
  wavView.setUint32(writeOffset, 36 + pcmData.length, true);
  writeOffset += 4;
  writeString('WAVEfmt ');
  wavView.setUint32(writeOffset, 16, true);
  writeOffset += 4;
  wavView.setUint16(writeOffset, 1, true);
  writeOffset += 2;
  wavView.setUint16(writeOffset, numChannels, true);
  writeOffset += 2;
  wavView.setUint32(writeOffset, sampleRate, true);
  writeOffset += 4;
  wavView.setUint32(writeOffset, sampleRate * blockAlign, true);
  writeOffset += 4;
  wavView.setUint16(writeOffset, blockAlign, true);
  writeOffset += 2;
  wavView.setUint16(writeOffset, bytesPerSample * 8, true);
  writeOffset += 2;
  writeString('data');
  wavView.setUint32(writeOffset, pcmData.length, true);
  writeOffset += 4;

  new Uint8Array(wav, 44).set(pcmData);
  return wav;
};

/**
 * Converts a base64 encoded PCM16 string to a WAV Blob URL.
 */
export function pcmBase64ToWavUrl(base64: string, sampleRate = 24_000, numChannels = 1): string {
  const pcm = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const wavBuffer = createWavBuffer(pcm, sampleRate, numChannels);
  return createManagedObjectUrl(new Blob([wavBuffer], { type: 'audio/wav' }));
}

/**
 * Combines multiple Base64 PCM16 chunks into a single WAV Blob URL.
 */
export const createWavBlobFromPCMChunks = (chunks: string[], sampleRate = 24000): string | null => {
  if (chunks.length === 0) return null;

  let totalLen = 0;
  const decodedChunks: Uint8Array[] = [];

  for (const chunk of chunks) {
    const decoded = decodeBase64ToArrayBuffer(chunk);
    decodedChunks.push(decoded);
    totalLen += decoded.length;
  }

  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of decodedChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const wavBuffer = createWavBuffer(merged, sampleRate, 1);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  return createManagedObjectUrl(blob);
};

/**
 * Combines microphone stream with system audio stream (screen share) if requested.
 * Returns the resulting mixed stream and a cleanup function.
 */
type ExtendedDisplayMediaStreamOptions = DisplayMediaStreamOptions & {
  systemAudio?: 'include' | 'exclude';
  selfBrowserSurface?: 'include' | 'exclude';
};

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export const SYSTEM_AUDIO_NOT_SHARED_WARNING =
  'System audio was not shared. Recording continued with microphone audio only.';
export const SYSTEM_AUDIO_CAPTURE_FAILED_WARNING =
  'System audio capture was cancelled or failed. Recording continued with microphone audio only.';

interface MixedAudioStreamResult {
  stream: MediaStream;
  cleanup: () => void;
  warning?: string;
}

export const getMixedAudioStream = async (
  micStream: MediaStream,
  includeSystemAudio: boolean = false,
): Promise<MixedAudioStreamResult> => {
  if (!includeSystemAudio) {
    return { stream: micStream, cleanup: () => {} };
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: 1,
        height: 1,
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      systemAudio: 'include',
      selfBrowserSurface: 'include',
    } as ExtendedDisplayMediaStreamOptions);

    const didShareSystemAudio = displayStream.getAudioTracks().length > 0;
    if (!didShareSystemAudio) {
      logService.warn("System audio not shared (user might have unchecked 'Share Audio').");
      displayStream.getTracks().forEach((t) => t.stop());
      return { stream: micStream, cleanup: () => {}, warning: SYSTEM_AUDIO_NOT_SHARED_WARNING };
    }

    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const mixedDestination = audioContext.createMediaStreamDestination();

    const microphoneSource = audioContext.createMediaStreamSource(micStream);
    const systemAudioSource = audioContext.createMediaStreamSource(displayStream);

    microphoneSource.connect(mixedDestination);
    systemAudioSource.connect(mixedDestination);

    const cleanup = () => {
      try {
        microphoneSource.disconnect();
        systemAudioSource.disconnect();
        displayStream.getTracks().forEach((t) => t.stop());
        audioContext.close().catch(() => {});
      } catch (e) {
        logService.error('Error cleaning up mixed stream:', e);
      }
    };

    return { stream: mixedDestination.stream, cleanup };
  } catch (error) {
    logService.warn('System audio capture cancelled or failed:', error);
    return { stream: micStream, cleanup: () => {}, warning: SYSTEM_AUDIO_CAPTURE_FAILED_WARNING };
  }
};
