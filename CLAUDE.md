# CLAUDE.md

> Project guide for **VOICEPRINT.SCR** — a retro-90s Microsoft-screensaver-style voice visualizer with ElevenLabs voice transformation, called server-side from the Next.js app.
>
> This file is the single source of truth for how the project is built and why. Read it before writing code.

---

## 1. What this is

A portfolio piece. The headline goal is **not** "a screensaver app" — it's to demonstrate two skills convincingly:

1. **Frontend / UI-UX craft** — a polished, tasteful recreation of the Windows 95/98 desktop aesthetic married to real-time WebGL audio-reactive visuals. The work should look intentional and designed, not like a default Bootstrap page with a teal background.
2. **Real-time audio engineering + a clean full-stack integration** — pure-function DSP turns the voice into typed `AnimationParams` that drive the visuals, and ElevenLabs is integrated securely server-side (the browser never holds a key) behind a layered access model (local / free-trial / access-code / bring-your-own-key).

> **Architecture note:** an earlier version routed ElevenLabs through a standalone MCP server. It was removed — this app has no LLM in the loop, and MCP exists to expose tools to an LLM host, so it was indirection without a payoff. ElevenLabs is now called directly from the Next.js server in `lib/elevenlabs.ts`.

Everything below serves those two goals. When a decision is ambiguous, pick the option that better *shows the skill*.

---

## 2. The core concept

The user records their voice **once**. From that single recording the app produces a live visual representation — a 90s-screensaver-style animation whose motion, color palette, and waveform are driven by the audio.

The user then applies **voice filters** (ElevenLabs voice transformations: e.g. robotic, deep, chipmunk, "radio announcer", etc.). Each filter re-renders the audio through ElevenLabs, and the new audio drives a visibly different animation — different palette, different energy, different waveform shape.

So the loop is:

```
record once → analyze → visualize
        ↓
pick a filter
        ↓
Next.js API route → ElevenLabs voice transform
        ↓
new audio → re-analyze → animation changes
```

The "wow" moment is that **changing the voice visibly changes the animation**. The user hears a different voice and simultaneously sees the screensaver respond.

### Iterated idea (recommended additions)

These extend the brief without changing its spirit. Treat as opt-in:

- **Named presets as "screensavers"** — each filter maps to a named retro scene (e.g. "MYSTIFY", "STARFIELD", "NYAN"), shown in a fake Display Properties dialog. This frames filter-switching as picking a screensaver, which sells the theme.- **Shareable "voiceprint"** — export the final state as a short looping video or a generated retro "About this voice" card.

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server routes handle secrets + heavy audio work. |
| Rendering | **Three.js via `@react-three/fiber`** + `@react-three/drei` | r3f gives a clean React DX for the scenes. Plain three.js is fine if a scene needs imperative control. |
| Audio analysis | **Web Audio API** (`AnalyserNode`) | FFT + time-domain data drive the visuals. No external lib needed. |
| Voice transform | **ElevenLabs API** (Speech-to-Speech / Voice Changer) | The core integration. Called server-side from the Next.js app (`lib/elevenlabs.ts`); the key never reaches the browser. |
| Styling | **Tailwind CSS** + a small hand-written 95/98 component layer | Don't pull in a heavy retro-UI kit and call it done; build the chrome yourself to show craft. |
| Client state | **Zustand** | The user's working session: recording, converted *takes*, scene selection, animation params. Domain types live in `lib/types.ts`. |
| Server state | **TanStack Query** | Voices list (`useVoices`) + transform/access requests. Owns fetch caching/dedupe/status; the *results* that persist (takes) live in Zustand. Hooks in `lib/queries.ts` + `useTransform`. |
| Animation polish | **Framer Motion** (UI only, not the canvas) | Window open/close, dialog transitions. |

> `three.js (maybe)` from the brief → **resolved to yes**, via react-three-fiber. The audio-reactive WebGL scene is what makes the FE work impressive.

---

## 4. Architecture

Two layers with a clean boundary; secrets stay server-side.

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js / React / r3f)            │
│  - 95/98 desktop UI                          │
│  - mic capture (MediaRecorder)               │
│  - Web Audio analysis → animation params     │
│  - Three.js scene reacts in real time        │
└───────────────┬─────────────────────────────┘
                │ HTTP (Next.js API routes)
                ▼
┌─────────────────────────────────────────────┐
│  Next.js server (API routes / Route Handlers)│
│  - holds the ElevenLabs key                  │
│  - enforces access (local / trial / code / BYOK)│
│  - calls ElevenLabs (lib/elevenlabs.ts)      │
│  - streams converted audio back (no storage) │
└───────────────┬─────────────────────────────┘
                │ REST
                ▼
        ElevenLabs API (voices + speech-to-speech)
```

**Why this shape:** the browser never sees an API key and never calls ElevenLabs directly — every call goes through the Next.js server, which also enforces the access model. The key lives in server env only.

**Audio data:** the converted clip is **streamed straight back** to the browser from `/api/transform` (binary body; trial metadata in response headers), which makes an object URL to play it. It is never persisted server-side and never base64-encoded — so the app runs anywhere, including serverless/Vercel.

---

## 5. Voice → visual mapping (the spec that matters most)

This is where FE credibility lives. Don't hand-wave it.

From the `AnalyserNode` each frame, compute:

- **RMS / overall volume** → global energy (motion amplitude, particle speed, line jitter).
- **Band energies** (split FFT into low / mid / high) → low = background pulse & scale, mid = primary motion, high = sparkle / sharpness.
- **Spectral centroid** ("brightness") → drives **hue**. Darker voice → cooler palette; brighter → warmer/hotter palette.
- **Zero-crossing rate** → roughness / glitch amount.
- **Time-domain buffer** → the literal waveform line (used directly in Mystify-style scenes).

Map these to a small, well-typed `AnimationParams` object the scenes consume:

```ts
type AnimationParams = {
  energy: number;        // 0..1  global intensity
  bass: number;          // 0..1
  mid: number;           // 0..1
  treble: number;        // 0..1
  brightness: number;    // 0..1  → hue
  roughness: number;     // 0..1  → glitch/jitter
  palette: [string, string, string]; // derived swatch
  waveform: Float32Array;
};
```

Each scene reads `AnimationParams`; switching filters changes the audio, which changes the params, which changes the scene. Keep the analysis pure and the scenes dumb consumers — this keeps it testable and lets filters "tune" the visuals by changing the audio, not by reaching into Three.js.

### Scenes to build (retro screensaver homages — original implementations, no MS assets)

1. **WAVEFIELD** — a displaced wireframe terrain driven directly by FFT bins (most clearly "voice-shaped"); additive-blended neon glow that brightens with `energy`.
2. **MYSTIFY** — bouncing polylines with trailing afterimages; vertices jitter by `energy`, palette by `brightness`.
3. **STARFIELD** — warp-speed star streaks; speed by `energy`, color by band split.
4. **NYAN** — a pixel cat that bobs to the voice (`energy`), trailing a marching rainbow; flap/scroll by `treble`.
5. **TOASTERS** — After Dark flying toasters; drift speed by `energy`, wing-flap by `treble`.

Each scene is a pure `*Style.ts` mapping (unit-tested) + a dumb renderer (WebGL for Wavefield, 2D canvas for the rest).

---

## 6. ElevenLabs integration

- Core endpoint: **Speech-to-Speech / Voice Changer** (record → convert to a target voice, preserving cadence/emotion).
- Also use **list voices** to populate the filter picker.
- Expose voice **settings** (stability, similarity, style) as advanced sliders; changing them re-runs the conversion.
- Treat conversion as **request/response** for v1 (record → convert → play converted clip with live visualization). Real-time streaming STS is a stretch goal — do not block on it.
- All ElevenLabs calls live **only** on the Next.js server (`lib/elevenlabs.ts`). The key is read from server env, never shipped to the browser.

> Note: ElevenLabs' exact endpoint names, model IDs, and limits change. **Verify against current ElevenLabs docs before implementing** rather than trusting any specifics memorized here.

---

## 7. Server integration & access model

ElevenLabs is wrapped in `lib/elevenlabs.ts` (server-only) and called from API routes:

| Route | Purpose |
|---|---|
| `GET /api/voices` | List voices for the filter picker. |
| `POST /api/transform` | Convert recorded audio → **streams the converted clip back** (binary body; `X-Voice-Id` / `X-Duration-Ms` / `X-Trial-Remaining` headers). |
| `POST /api/access` | Validate a friend's access code (never echoes the real one). |

The converted audio is returned in the response body and never stored server-side — the browser plays it via an object URL.

**Access model** (so a public demo doesn't drain one account): local dev is unlimited; otherwise a signed-cookie **free trial** (with an optional per-IP Upstash backstop) applies, until a visitor enters the shared **access code** (`ACCESS_CODE` env, never committed) or brings their **own ElevenLabs key** (sent per-request, never stored). See `lib/trial.ts`, `lib/trialIp.ts`, `lib/access.ts`.

---

## 8. Directory structure

```
/app                      Next.js App Router
  /api
    /transform            upload → ElevenLabs → stream converted audio back (POST)
    /voices               list voices (GET)
    /access               validate the access code (POST)
  page.tsx                the "desktop" entry (served at /)
  providers.tsx           client providers (TanStack Query client)
/components
  /retro                  hand-built 95/98 chrome (Window, Button, Dialog, TaskBar)
  /scenes                 scenes (Wavefield WebGL; Mystify, Starfield, Nyan, Toasters 2D)
  /controls               recorder, filter picker, sliders, export, useTransform (transform mutation)
/lib
  /audio                  analyser, feature extraction, params mapping
  /store                  zustand store (working session)
  types.ts                shared domain types (SceneId, Voice, VoiceSettings, Conversion, VoiceDraft)
  queries.ts              TanStack Query hooks (useVoices, useSubmitAccessCode)
  elevenlabs.ts           server-side ElevenLabs client (voices + speech-to-speech)
  trial.ts trialIp.ts access.ts   access model (trial / IP backstop / code)
```

---

## 9. Commands

```bash
# install
pnpm install

# dev (frontend + next server)
pnpm dev

# typecheck / lint / format
pnpm typecheck
pnpm lint
pnpm format

# build
pnpm build
```

> Confirm package manager (`pnpm` assumed) and adjust scripts when scaffolding.

---

## 10. Conventions

- **TypeScript strict**, no `any` in committed code.
- Audio feature extraction is **pure functions** — no React, no Three.js — so it can be unit-tested.
- Scenes consume `AnimationParams` and own no audio logic.
- Secrets live in env only on the server. The browser never holds a key.
- Retro UI is **hand-built** in `/components/retro`; do not lean on a prebuilt 98.css clone as the whole deliverable (you may reference one for spacing, but the craft must be yours).
- Accessibility: the retro look should not break keyboard nav, focus rings, or reduced-motion. Respect `prefers-reduced-motion` by damping the canvas.
- Performance: cap the canvas at the display refresh, throttle analysis to ~60fps, dispose Three.js resources on scene switch.

---

## 11. UI/UX direction

The aesthetic is **Windows 95/98 desktop**, done with restraint and polish:

- Beveled buttons, title bars with the classic gradient, a taskbar with a Start button and clock.
- The visualizer lives inside a draggable "window"; the filter picker is a fake **Display Properties → Screen Saver** dialog.
- CRT touches (subtle scanlines, slight vignette) — tasteful, toggleable, off under reduced-motion.
- Type: a clean MS-Sans-style face for chrome; keep body text legible.
- Color: classic desktop teal as the canvas background, but the *visualization* palette comes from the voice.

The bar to clear: a designer should look at it and believe it was deliberately art-directed.

---

## 12. Build order (milestones)

1. **Skeleton** — Next.js + TS + Tailwind; retro Window/Button/TaskBar shells.
2. **Record + analyze** — mic capture, `AnalyserNode`, feature extraction → `AnimationParams`. Prove it with a debug readout.
3. **First scene** — Wavefield reacting live to the params.
4. **Server integration** — `/api/voices` + `/api/transform` calling ElevenLabs server-side; stream the converted clip back.
5. **Wire the loop** — record → transform → fetch result → re-analyze → animation changes.
6. **Filter picker UI** — the Screen Saver dialog; named presets ↔ voices/scenes.
7. **Polish** — Mystify scene, CRT, transitions, reduced-motion, export.
8. **Stretch** — Starfield, Nyan, Toasters; shareable export video.

A reviewer should find something impressive by milestone 5; everything after is depth.

---

## 13. Open decisions (flag, don't silently assume)

- ~~**Real-time vs offline conversion**~~ — **RESOLVED: v1 is offline** (record → send to ElevenLabs → get converted clip back → play with live visualization; a normal request/response, still network-dependent). Real-time streaming STS is explicitly out of scope for v1; revisit only as a stretch goal.
- ~~**Where converted audio is stored**~~ — **RESOLVED: not stored.** `/api/transform` streams the converted clip straight back in the response body and the browser plays it via an object URL. No disk/blob store, so it deploys to serverless hosts (Vercel) as well as a long-running server (Render), and the recording is never persisted.
- ~~**Agent in scope or not**~~ — **RESOLVED: out of scope.** The Anthropic-driven NL agent layer and the `suggest_filter` tool have been removed; filter selection is via named presets only.
- ~~**MCP server vs direct calls**~~ — **RESOLVED: direct calls.** With no LLM in the loop, the MCP server was indirection without a payoff, so it was removed; ElevenLabs is called directly from the Next.js server (`lib/elevenlabs.ts`). MCP exists to expose tools to an LLM host — not the right fit here.
- **How many scenes ship** — two is enough to be impressive; four is the ceiling.
- **ElevenLabs cost/limits** — confirm free-tier quota is enough for a portfolio demo, or gate transforms behind a soft limit.

When you resolve one of these, update this file. CLAUDE.md should always reflect the current intended design.