export const audioCompressionWorkerCode = `
importScripts('/lame.min.js');

self.onmessage = function(event) {
    try {
        const { pcmData, sampleRate, kbps } = event.data;

        const samples = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            const clampedSample = Math.max(-1, Math.min(1, pcmData[i]));
            samples[i] = clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7FFF;
        }

        if (typeof lamejs === 'undefined') {
            throw new Error('lamejs not loaded in worker');
        }

        const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
        const mp3Data = [];
        const sampleBlockSize = 1152;

        for (let i = 0; i < samples.length; i += sampleBlockSize) {
            const chunk = samples.subarray(i, i + sampleBlockSize);
            const encodedChunk = mp3Encoder.encodeBuffer(chunk);
            if (encodedChunk.length > 0) {
                mp3Data.push(encodedChunk);
            }
        }

        const finalChunk = mp3Encoder.flush();
        if (finalChunk.length > 0) {
            mp3Data.push(finalChunk);
        }

        self.postMessage({ type: 'success', buffers: mp3Data });
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
};
`;
