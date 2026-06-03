import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const liveAudioPath = path.resolve(__dirname, './useLiveAudio.ts');

describe('useLiveAudio feedback prevention', () => {
  it('enables browser echo control for the Live microphone stream', () => {
    const source = fs.readFileSync(liveAudioPath, 'utf8');

    expect(source).toContain('echoCancellation: true');
    expect(source).toContain('noiseSuppression: true');
    expect(source).toContain('autoGainControl: true');
    expect(source).not.toContain('echoCancellation: false');
    expect(source).not.toContain('noiseSuppression: false');
    expect(source).not.toContain('autoGainControl: false');
  });

  it('suppresses outbound microphone frames while model audio is playing', () => {
    const source = fs.readFileSync(liveAudioPath, 'utf8');
    const outputSuppressionIndex = source.indexOf('if (outputAudioActiveRef.current)');
    const audioCallbackIndex = source.indexOf('onAudioData(inputSamples)');

    expect(source).toContain('outputAudioActiveRef');
    expect(source).toContain('outputAudioTailTimeoutRef');
    expect(outputSuppressionIndex).toBeGreaterThanOrEqual(0);
    expect(audioCallbackIndex).toBeGreaterThanOrEqual(0);
    expect(outputSuppressionIndex).toBeLessThan(audioCallbackIndex);
  });
});
