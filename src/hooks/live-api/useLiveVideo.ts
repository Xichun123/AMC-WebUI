import { useState, useRef, useCallback, useEffect } from 'react';
import { logService } from '@/services/logService';

type VideoSource = 'camera' | 'screen' | null;
const FRAME_JPEG_QUALITY = 0.6;

export const useLiveVideo = () => {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [videoSource, setVideoSource] = useState<VideoSource>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopActiveStream = useCallback(() => {
    videoStream?.getTracks().forEach((track) => track.stop());
  }, [videoStream]);

  const stopVideo = useCallback(() => {
    stopActiveStream();
    setVideoStream(null);
    setVideoSource(null);
  }, [stopActiveStream]);

  const startCamera = useCallback(async (): Promise<boolean> => {
    if (videoSource === 'camera') return true;

    stopActiveStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setVideoStream(stream);
      setVideoSource('camera');
      return true;
    } catch (err) {
      logService.error('Failed to start camera', err);
      return false;
    }
  }, [stopActiveStream, videoSource]);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    if (videoSource === 'screen') return true;

    stopActiveStream();

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setVideoStream(stream);
      setVideoSource('screen');

      stream.getVideoTracks()[0].onended = () => {
        setVideoStream(null);
        setVideoSource(null);
      };
      return true;
    } catch (err) {
      logService.error('Failed to start screen share', err);
      return false;
    }
  }, [stopActiveStream, videoSource]);

  const captureFrame = useCallback((): string | null => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.paused || videoEl.ended) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY);
    return dataUrl.split(',')[1];
  }, []);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      const videoEl = videoRef.current;
      videoEl.srcObject = videoStream;
      void videoEl.play().catch((err) => {
        logService.error('Failed to play live video stream', err);
      });
    }
  }, [videoStream]);

  return {
    videoStream,
    videoSource,
    videoRef,
    startCamera,
    startScreenShare,
    stopVideo,
    captureFrame,
  };
};
