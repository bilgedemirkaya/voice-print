export type BandEnergies = { low: number; mid: number; high: number };

/** Raw acoustic features extracted from one analysis frame (all normalized 0..1 except rms). */
export type AudioFeatures = {
  rms: number; // overall loudness (0..~1, ~0.707 for a unit sine)
  bass: number; // low-band energy 0..1
  mid: number; // mid-band energy 0..1
  treble: number; // high-band energy 0..1
  brightness: number; // normalized spectral centroid 0..1
  roughness: number; // zero-crossing rate 0..1
};

/**
 * The single object every scene consumes (CLAUDE.md §5). Switching voice filters
 * changes the audio, which changes these params, which changes the animation.
 */
export type AnimationParams = {
  energy: number; // 0..1 global intensity
  bass: number; // 0..1
  mid: number; // 0..1
  treble: number; // 0..1
  brightness: number; // 0..1 → hue
  roughness: number; // 0..1 → glitch/jitter
  palette: [string, string, string]; // derived swatch
  waveform: Float32Array; // time-domain line
};
