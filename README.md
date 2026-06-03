# VOICEPRINT.SCR

> _Record your voice. Watch it become a 1998 screensaver. Change the voice — watch the screensaver change with it._

A retro Windows 95/98 desktop that turns your voice into a live WebGL screensaver. Speak once, and the waveform, colors, and motion are all driven by **your** audio. Then run your voice through ElevenLabs filters — "radio announcer", "deep", "chipmunk" — and the screensaver visibly morphs to match the new voice. Each voice even gets its own screensaver and color identity.

It's a portfolio piece with two things to show off:

1. **Front-end craft** — a hand-built 95/98 desktop (no UI kit) married to real-time, audio-reactive Three.js.
2. **A real MCP server** — every ElevenLabs call goes through a standalone [Model Context Protocol](https://modelcontextprotocol.io) server, not a `fetch` buried in a component. The browser never sees an API key.

---

## The 30-second tour

```
🎙️  record your voice  ──►  📊  it's analyzed live  ──►  🌌  screensaver reacts
                                                              │
                          🎛️  pick a vibe (gender / age / accent)
                                                              │
                          🔌  MCP server ──► ElevenLabs voice changer
                                                              │
                          🔁  new voice ──► new colors, new motion, new scene
                                                              │
                          🎬  export it as a shareable voiceprint clip
```

The payoff: you hear a different voice and **see** the visualization change at the same time.

---

## Quick start

**You'll need:** Node ≥ 20 and pnpm 9 (`corepack enable pnpm`).

```bash
# 1. install everything (the app + the MCP server)
pnpm install

# 2. give the MCP server an ElevenLabs key
cp mcp-server/.env.example mcp-server/.env
#   then open mcp-server/.env and paste your ELEVENLABS_API_KEY

# 3. go
pnpm dev
```

Open **http://localhost:3000** and you'll boot straight into the desktop.

> No ElevenLabs key? The desktop, recording, and live visualization all work — only the voice _transform_ step needs a key. Grab a free one at [elevenlabs.io](https://elevenlabs.io).

---

## How to play with it

1. **Hit record** and say something. The screensaver starts dancing to your voice immediately.
2. The **Display Properties → Screen Saver** dialog pops open. Here you:
   - dial in a **vibe** with the Gender / Age / Accent / Vibe filters (they cascade — picking one narrows the rest, and the system matches you to a real ElevenLabs voice),
   - pick a **screensaver** (WAVEFIELD, MYSTIFY, STARFIELD, PIPES),
   - tweak **Stability / Similarity / Style**, then hit **Apply**.
3. Your clip gets transformed and plays back — the visualization takes on that voice's **color** and **scene**.
4. Use the **You / Voice A / Voice B / +** tabs to A/B them. Each voice remembers its own screensaver and palette, so flipping tabs flips the whole vibe.
5. Hit **🎬 Export clip** to download a `voiceprint.webm` of the live visualization — the most shareable artifact.

Bonus toggles: **CRT** scanlines and **Sounds** (synthesized 90s UI beeps). Everything respects `prefers-reduced-motion` and works on mobile.

---

## How it's wired

Three deliberately separate layers — the MCP boundary is real, not cosmetic:

```
Browser (Next.js + react-three-fiber)
  · 95/98 desktop, mic capture, Web Audio analysis → live Three.js scenes
        │  HTTP
Next.js server (API routes)
  · holds the keys, acts as the MCP *client*
        │  MCP (stdio)
MCP server (standalone Node process)
  · tools: list_voices, get_voice_settings, transform_voice, suggest_filter
  · the only place ElevenLabs is ever called
```

Audio moves around as **handles**, never giant base64 blobs — the MCP server writes converted clips to a temp store and hands back a URL.

Want the full design rationale? It all lives in **[CLAUDE.md](CLAUDE.md)**.

---

## Commands

```bash
pnpm dev          # run the app (spawns the MCP server for you)
pnpm build        # production build
pnpm mcp:dev      # run the MCP server standalone (stdio)

pnpm typecheck    # tsc, app + mcp-server
pnpm lint         # eslint, app + mcp-server
pnpm test         # vitest, app + mcp-server  (94 tests)
pnpm format       # prettier
```

---

## Environment variables

Live **only** on the server side — the browser never holds a key (CLAUDE.md §10). Set them in `mcp-server/.env`:

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs voice transformation (required for the transform step). |
| `AUDIO_TMP_DIR` | Where converted audio is written and served from by handle (optional; sensible default). |

---

## Project layout

```
app/            Next.js App Router (desktop page + /api routes)
components/
  retro/        hand-built 95/98 chrome (Window, Button, Dialog, TaskBar)
  scenes/       the four Three.js screensavers
  controls/     recorder, filter picker, sliders
lib/
  audio/        pure DSP — features → AnimationParams (no React, no Three)
  store/        zustand store
mcp-server/     the standalone MCP server (its own package)
```

The audio feature extraction is pure and unit-tested; scenes are dumb consumers of an `AnimationParams` object. Change the voice → change the params → change the picture.

---

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · Three.js + @react-three/fiber + drei · Zustand · Framer Motion · Vitest · `@modelcontextprotocol/sdk`. Full rationale in [CLAUDE.md §3](CLAUDE.md).
