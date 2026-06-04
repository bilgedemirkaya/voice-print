# VOICEPRINT.SCR

Record yourself, say a sentence, and a WebGL **screensaver springs to life, driven entirely by your voice.** Depending on your voice, the colors run hot and the motion spikes or it cools down and settles.

Open **Display Properties → Screen Saver** dialog and dial in a *vibe*; gender, age, accent, mood. Behind the scenes that picks a real ElevenLabs voice and **transforms your recording through it.** Depending on the pick, the screensaver **visibly transforms too**: new palette, new energy, a different waveform shape. You *hear* a new voice and *see* the visuals answer at the same instant.

Stack up a few voices, each one remembers its own screensaver and identity, so flipping between them flips the entire mood. When you found the one, **export it as a shareable "voiceprint"**; a video with sound, or a GIF.

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

> You need ElevenLabs to use voice transform feature on local. Grab a free key at [elevenlabs.io](https://elevenlabs.io).

---

## Features

1. The screensaver reacts to your voice immediately while recording.
2. Display Properties sets:
   - a mood with the Gender / Age / Accent / Vibe filters (they cascade — picking one narrows the rest, and the system matches you to a real ElevenLabs voice),
   - a **screensaver** — WAVEFIELD, MYSTIFY, STARFIELD, **NYAN** (a pixel cat that bobs to your voice), or **TOASTERS** (the After Dark flying toasters, wings flapping to your voice),
   - New voice's **Stability / Similarity / Style**.
3. Your clip gets transformed and plays back. The visualization takes on that voice's **color** and **scene**.
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


## Privacy

- **Your microphone recording is never stored on our server.** It stays in your browser and is streamed straight to ElevenLabs for the transform, then dropped from memory — we never write it to disk.
- **No accounts, no identity.** Usage is gated only by an anonymous signed cookie (the free-trial counter) and an optional per-IP count — never linked to who you are.
- **Converted clips are transient.** The transformed audio sits in a temporary folder behind a random, unguessable handle just long enough to play it back, and is auto-deleted within an hour (and on every restart). Nothing is retained long-term.
- **Analytics, if enabled, are cookieless.** Optional Cloudflare Web Analytics counts aggregate visits — no cookies, no personal data, no cross-site tracking.
- **Third party:** audio is processed by [ElevenLabs](https://elevenlabs.io) under their terms for the duration of the transform.

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

## Contributing

Ideas, bug reports, and PRs are very welcome — **we're always open to new screensavers, UX polish, and improvements.** Open an issue and let's build it. See **[CONTRIBUTING.md](CONTRIBUTING.md)** to get started — it includes a quick "add a screensaver" walkthrough.
