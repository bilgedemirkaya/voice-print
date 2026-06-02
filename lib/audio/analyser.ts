import { analyzeFrame } from "./params";
import type { AnimationParams } from "./types";

export type AudioAnalyser = {
  readonly analyser: AnalyserNode;
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

export type AnalyserOptions = {
  fftSize?: number;
  smoothing?: number;
  throttleMs?: number;
};

/**
 * Wire an AnalyserNode to a source and push AnimationParams on each (throttled) animation frame.
 * Browser-only glue: all DSP lives in the pure functions in features.ts / params.ts.
 */
export function createAudioAnalyser(
  context: AudioContext,
  source: AudioNode,
  onParams: (params: AnimationParams) => void,
  options: AnalyserOptions = {},
): AudioAnalyser {
  const { fftSize = 2048, smoothing = 0.8, throttleMs = 1000 / 60 } = options;

  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = smoothing;
  source.connect(analyser);

  const frequencyBytes = new Uint8Array(analyser.frequencyBinCount);
  const timeDomain = new Float32Array(analyser.fftSize);

  let rafId = 0;
  let lastFrame = 0;
  let running = false;

  const tick = (now: number): void => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (now - lastFrame < throttleMs) return;
    lastFrame = now;
    analyser.getByteFrequencyData(frequencyBytes);
    analyser.getFloatTimeDomainData(timeDomain);
    onParams(analyzeFrame(timeDomain, frequencyBytes, context.sampleRate, analyser.fftSize));
  };

  const start = (): void => {
    if (running) return;
    running = true;
    lastFrame = 0;
    rafId = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const dispose = (): void => {
    stop();
    try {
      source.disconnect(analyser);
    } catch {
      // already disconnected
    }
  };

  return { analyser, start, stop, dispose };
}
