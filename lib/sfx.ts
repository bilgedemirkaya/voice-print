import { useAudioStore } from "@/lib/store/audioStore";

// Synthesized retro UI beeps — no audio assets. Safe to call anywhere (no-op without WebAudio).

type Note = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number };

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function play(notes: Note[]): void {
  if (!useAudioStore.getState().soundEnabled) return;
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;
  for (const note of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.type ?? "square";
    osc.frequency.value = note.freq;
    const peak = note.gain ?? 0.05;
    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(peak, now + note.start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.02);
  }
}

export const sfx = {
  open: () => play([{ freq: 520, start: 0, dur: 0.06 }, { freq: 784, start: 0.05, dur: 0.08 }]),
  record: () => play([{ freq: 880, start: 0, dur: 0.09, type: "sine" }]),
  stop: () => play([{ freq: 440, start: 0, dur: 0.09, type: "sine" }]),
  apply: () =>
    play([
      { freq: 660, start: 0, dur: 0.07 },
      { freq: 990, start: 0.07, dur: 0.13, gain: 0.06 },
    ]),
  error: () =>
    play([
      { freq: 210, start: 0, dur: 0.18, type: "sawtooth", gain: 0.06 },
      { freq: 150, start: 0.12, dur: 0.22, type: "sawtooth", gain: 0.06 },
    ]),
};
