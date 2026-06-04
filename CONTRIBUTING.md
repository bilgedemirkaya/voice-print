# Contributing to VOICEPRINT.SCR

Ideas, bug reports, and PRs are all welcome — this is a playful project and **we're always open to new screensavers, UX polish, and improvements.** Got a wild idea? Open an issue and let's talk. For small fixes, just send a PR.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # add your ELEVENLABS_API_KEY (only the voice-transform step needs it)
pnpm dev                     # http://localhost:3000 — local dev is unlimited, no gating
```

The [README](README.md) has the full picture; [CLAUDE.md](CLAUDE.md) explains the design rationale.

## Before you open a PR

Everything should be green:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

- **TypeScript strict — no `any`** in committed code.
- **Match the surrounding code**: naming, comment density, idiom.
- Run `pnpm format` (Prettier) before committing.
- Keep PRs focused, and say *what* and *why*.

## Architecture in one breath

- Audio analysis is **pure functions** (`lib/audio/*`) — no React, no Three.js — turning the mic/clip into a typed `AnimationParams` each frame.
- **Scenes are dumb consumers** of `AnimationParams`. Each is a **pure `*Style.ts` mapping (unit-tested)** + a renderer (WebGL for Wavefield, 2D canvas for the rest).
- **Secrets live server-side only.** The browser never holds the ElevenLabs key — calls go through `/api/transform` → `lib/elevenlabs.ts`.

## Adding a screensaver (the fun part)

Scenes appear in the Display Properties picker automatically. To add one — say `RAIN`:

1. **`components/scenes/rainStyle.ts`** — a pure `rainStyle(params, { reducedMotion }): RainStyle` mapping `AnimationParams` → drawing numbers (speed / size / color…). No canvas, no React.
2. **`components/scenes/rainStyle.test.ts`** — assert it reacts to the params (e.g. more energy → faster) and damps under reduced motion.
3. **`components/scenes/Rain.tsx`** — a 2D-canvas renderer: read the store each frame, merge `voicePalette`, call your style fn, draw. Call `fitCanvasCover(canvas, ctx, W, H)` at the top of the loop so it fills the window, and respect `prefers-reduced-motion`.
4. **Register it**: add `"rain"` to `SceneId` in `lib/store/audioStore.ts`, plus the entry + `SceneView` case in `components/scenes/registry.tsx`.

Copy an existing scene (`Starfield.tsx` + `starfieldStyle.ts`) as a template. Keep the analysis out of the scene — let the voice drive everything through `AnimationParams`.

## Ideas & feedback

Have an idea for a new scene, an export format, or a UX trick? **Open an issue** — we're always up for it. 🐱🌈
