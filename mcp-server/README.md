# voicescreen-mcp

A standalone [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
ElevenLabs voice operations as tools. It is the integration boundary for VOICESCREEN.SCR: the
Next.js app is the MCP **client**, this process is the MCP **server**, and the ElevenLabs API key
lives here only — never in the browser (see [CLAUDE.md](../CLAUDE.md) §4, §6, §7).

Tools return **handles** into a shared on-disk audio store, never raw/base64 audio over the wire.

## Setup

```bash
cp .env.example .env       # then paste your ElevenLabs API key into ELEVENLABS_API_KEY
pnpm --filter mcp-server dev   # boots over stdio; logs "ready" to stderr
```

| Env var | Required | Purpose |
|---|---|---|
| `ELEVENLABS_API_KEY` | yes (for live calls) | Auth for the ElevenLabs REST API (`xi-api-key`). |
| `AUDIO_TMP_DIR` | no | Where converted audio is written/served. Defaults to `<os-tmp>/voicescreen-audio`. |

The server boots without a key (so a host can list its tools); calls that need it fail with a
clear "ELEVENLABS_API_KEY is not set" error.

## Tools

### `list_voices`
- **Input:** _(none)_
- **Output:** `{ voices: { id: string; name: string; labels: Record<string,string> }[] }`
- Populates the filter picker. Wraps `GET /v1/voices`.

### `get_voice_settings`
- **Input:** `{ voiceId: string }`
- **Output:** `{ stability?, similarity_boost?, style?, use_speaker_boost?, speed? }` (all numbers 0..1 except `speed` 0.5..2 and the boolean)
- Seeds the advanced sliders. Wraps `GET /v1/voices/{voice_id}/settings`.

### `transform_voice`
- **Input:** `{ audioHandle: string, targetVoiceId: string, settings?: VoiceSettings }`
- **Output:** `{ resultHandle: string, durationMs: number, voiceId: string }`
- The main op: reads the source audio from the store by `audioHandle`, runs ElevenLabs
  Speech-to-Speech (`POST /v1/speech-to-speech/{voice_id}`, model `eleven_english_sts_v2`,
  `output_format=mp3_44100_128`), writes the mp3 result to the store, and returns its handle.
  `durationMs` is approximate (derived from the 128 kbps output size).

## Audio handle store

Handles are opaque file names (`<uuid>.<ext>`) inside `AUDIO_TMP_DIR`; they are validated against
`^[A-Za-z0-9._-]+$` to prevent path traversal. The Next.js app reads results back via
`/api/audio/[handle]` (M5).

## Manual testing with the MCP Inspector

```bash
# from the repo root, with mcp-server/.env populated:
pnpm --filter mcp-server exec npx @modelcontextprotocol/inspector tsx index.ts
```

Then call `list_voices`. To exercise `transform_voice`, drop a clip into `AUDIO_TMP_DIR`
(e.g. `input.webm`) and call it with `{ "audioHandle": "input.webm", "targetVoiceId": "<id>" }`.
