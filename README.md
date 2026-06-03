# VOICEPRINT.SCR

> _Record your voice. Watch it become a 1998 screensaver. Select the voice, watch the screensaver change with it._

<p align="center">
  <video src="docs/demo.webm" controls muted loop width="680"></video>
</p>


---

## What is this?

Record yourself, say a sentence, and a WebGL **screensaver springs to life, driven entirely by your voice.** Depending on your voice, the colors run hot and the motion spikes or it cools down and settles.

Open **Display Properties → Screen Saver** dialog and dial in a *vibe*; gender, age, accent, mood. Behind the scenes that picks a real ElevenLabs voice and **transforms your recording through it.** Depending on the pick, the screensaver **visibly transforms too**: new palette, new energy, a different waveform shape. You *hear* a new voice and *see* the visuals answer at the same instant.

Stack up a few voices, each one remembers its own screensaver and identity, so flipping between them flips the entire mood. When you found the one, **export it as a shareable "voiceprint"** — a video with sound, or a GIF — and post it.

---

## Quick start

**You'll need:** Node ≥ 20 and pnpm 9 (`corepack enable pnpm`).

```bash
# 1. install
pnpm install

# 2. add your ElevenLabs key (read server-side only, never sent to the browser)
cp .env.example .env.local
#   then open .env.local and paste your ELEVENLABS_API_KEY

# 3. go
pnpm dev
```

Open **http://localhost:3000** and you'll boot straight into the desktop.

> No ElevenLabs key? The desktop, recording, and live visualization all work — only the voice _transform_ step needs one. Grab a free key at [elevenlabs.io](https://elevenlabs.io).

---

## How to play with it

1. **Hit record** and say something. The screensaver starts dancing to your voice immediately.
2. The **Display Properties → Screen Saver** dialog pops open. Here you:
   - dial in a **vibe** with the Gender / Age / Accent / Vibe filters (they cascade — picking one narrows the rest, and the system matches you to a real ElevenLabs voice),
   - pick a **screensaver** — WAVEFIELD, MYSTIFY, STARFIELD, **NYAN** (a pixel cat that bobs to your voice), or **TOASTERS** (the After Dark flying toasters, wings flapping to your voice),
   - tune **Stability / Similarity / Style**, then hit **Apply**.
3. Your clip gets transformed and plays back — the visualization takes on that voice's **color** and **scene**.
4. Use the **You / Voice A / Voice B / +** tabs to A/B them. Each voice keeps its own screensaver and palette, so flipping tabs flips the whole vibe.
5. In the player, pick a format — **Video + sound** (`voiceprint.webm`) or **GIF** (`voiceprint.gif`) — and hit **🎬 Export** to download your shareable voiceprint of the live visuals.

Bonus toggles: **CRT** scanlines and **Sounds** (synthesized 90s UI beeps).

---

## Access: local, free trial, code, or your own key

So the public demo doesn't drain one ElevenLabs account, transforms are gated — with several ways through:

- **Running locally** (`pnpm dev`) → **unlimited**, no prompt; it just uses your key in `.env.local`.
- **New visitors** get a couple of **free transforms** on the shared key. The count is tracked in a **signed, httpOnly cookie** (server-verified, so it can't be forged), with an **optional per-IP backstop** (Upstash Redis) that survives cookie-clearing.
- **Friends with the access code** enter it once for **unlimited** transforms on the host's key. The code is read from the `ACCESS_CODE` env var only — never committed — so it stays a shared secret (think discount code).
- **Anyone else** can paste their **own ElevenLabs key**, kept **in the browser only** (sessionStorage), sent per-request, and **never stored or logged** on the server.

All of this is configurable — see the env vars below.

---

## How it's wired

A clean client/server split — the browser never holds a key:

```
Browser (Next.js + react-three-fiber)
  · 95/98 desktop, mic capture, Web Audio analysis → live Three.js scenes
        │  HTTP (multipart upload)
Next.js server (API routes)
  · holds the key, enforces access (local / trial / code / BYOK)
  · calls ElevenLabs server-side, stores converted audio by handle
        │  REST
ElevenLabs (voice list + speech-to-speech)
```

Converted audio is served back by **handle** (`/api/audio/[handle]`), never shuttled around as giant base64 blobs. All audio analysis (FFT → `AnimationParams`) is pure, client-side, and unit-tested.

---

## Commands

```bash
pnpm dev          # run the app
pnpm build        # production build
pnpm start        # serve the production build

pnpm typecheck    # tsc
pnpm lint         # eslint
pnpm test         # vitest (92 tests)
pnpm format       # prettier
```

---

## Environment variables

All of these go in `.env.local` (gitignored) and are read **server-side only** (CLAUDE.md §10); just the key is required.

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | The shared key powering voice transforms. **Required** to transform. |
| `AUDIO_TMP_DIR` | Where converted audio is written/served by handle (optional; sensible default). |
| `ACCESS_CODE` | Shared code that unlocks unlimited transforms for friends. Unset = no code unlocks (BYOK + trial still work). |
| `TRIAL_COOKIE_SECRET` | Signs the free-trial cookie. Set a random value in prod (dev default otherwise). |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional per-IP backstop. Blank = cookie-only. Free DB at [Upstash](https://console.upstash.com). |
| `TRIAL_IP_DAILY_CAP` | Max free transforms per IP per day (default 10). |

---

## Project layout

```
app/            Next.js App Router (desktop page + /api routes)
components/
  retro/        hand-built 95/98 chrome (Window, Button, Dialog, TaskBar)
  scenes/       the six screensavers (WebGL + 2D canvas), each a pure-style fn + renderer
  controls/     recorder, filter picker, sliders, export
lib/
  audio/         pure DSP — features → AnimationParams (no React, no Three)
  store/         zustand store
  elevenlabs.ts  server-side ElevenLabs client (voices + speech-to-speech)
  trial.ts       signed-cookie free-trial gate;  trialIp.ts  per-IP Upstash backstop
```

The audio feature extraction is pure and unit-tested; scenes are dumb consumers of an `AnimationParams` object. Change the voice → change the params → change the picture.

---

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · Three.js + @react-three/fiber + drei · Zustand · Framer Motion · Vitest.
