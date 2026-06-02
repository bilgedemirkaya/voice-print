# VOICESCREEN.SCR

A retro-90s Microsoft-screensaver-style **voice visualizer**: record your voice once, watch a WebGL audio-reactive "screensaver" respond to it, then apply ElevenLabs voice filters (via a custom **MCP server**) and watch the animation visibly change.

- **What & why:** [CLAUDE.md](CLAUDE.md) — the design source of truth.
- **Build plan & milestones:** [ROADMAP.md](ROADMAP.md).
- **Current status:** **M0 (scaffold) complete.** The app boots, the MCP server boots, and the full toolchain (typecheck/lint/test/build) is green. Features land milestone by milestone starting at M1.

---

## Prerequisites

- **Node.js ≥ 20** (developed on Node 22).
- **pnpm 9** — this repo pins it via `packageManager`. The easiest way to get it:

  ```bash
  corepack enable pnpm
  ```

  Corepack ships with Node, so no separate install is needed. Verify with `pnpm -v` (should print `9.x`).

---

## Quick start

```bash
# 1. install all workspace dependencies (root app + mcp-server)
pnpm install

# 2. (optional) create your local env file — only needed once ElevenLabs is wired in M4
cp .env.example .env
#   then fill in ELEVENLABS_API_KEY

# 3. start the app
pnpm dev
```

Open **http://localhost:3000** — you should see the teal desktop placeholder ("VOICESCREEN.SCR"). The real retro UI arrives in M1.

---

## Where the commands live

There is no standalone scripts file — commands are defined in the `"scripts"` section of each `package.json`:

- Root app + workspace: [package.json](package.json)
- MCP server: [mcp-server/package.json](mcp-server/package.json)

You invoke them with `pnpm <name>`.

### Root scripts (run from the project root)

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server at http://localhost:3000 (hot reload). |
| `pnpm build` | Production build of the Next.js app. |
| `pnpm start` | Serve the production build (run `pnpm build` first). |
| `pnpm typecheck` | `tsc --noEmit` for the app **and** the MCP server. |
| `pnpm lint` | ESLint for the app **and** the MCP server. |
| `pnpm format` | Format the repo with Prettier (`format:check` to only check). |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Run Vitest in watch mode. |
| `pnpm mcp:dev` | Shortcut for the MCP server dev script below. |

### MCP server scripts (standalone, see [CLAUDE.md §7](CLAUDE.md))

Run via the workspace filter so you don't have to `cd`:

```bash
pnpm --filter mcp-server dev        # boot the stdio MCP server (tsx watch); logs "ready"
pnpm --filter mcp-server start      # boot once without watch
pnpm --filter mcp-server build      # compile to mcp-server/dist
pnpm --filter mcp-server typecheck  # tsc --noEmit
pnpm --filter mcp-server lint       # eslint
```

The MCP server talks the MCP protocol over **stdio**, so it logs to **stderr** (`stdout` is the protocol channel) and waits for a client. In M0 it registers **zero tools** — `list_voices` / `transform_voice` arrive in M4. Press `Ctrl-C` to stop it.

---

## How to test (M0)

Everything below should pass on a clean checkout. This is the M0 exit criteria from [ROADMAP.md](ROADMAP.md).

```bash
pnpm install        # ✓ installs cleanly
pnpm typecheck      # ✓ no type errors (app + mcp-server)
pnpm lint           # ✓ no lint errors (app + mcp-server)
pnpm test           # ✓ 1 passing sample test (tests/sanity.test.ts)
pnpm build          # ✓ builds; routes: / , /api/audio/[handle] , /api/transform
```

**Manual smoke checks:**

1. **App boots** — `pnpm dev`, open http://localhost:3000, see the teal desktop placeholder.
2. **MCP server boots** — `pnpm --filter mcp-server dev`, confirm it prints `[mcp-server] ready` to the terminal (stderr), then `Ctrl-C`.

As features land, each milestone adds its own tests; `pnpm test` is the single command that runs the whole suite. See the per-milestone **Test prompts** in [ROADMAP.md](ROADMAP.md).

---

## Project structure

```
/app                      Next.js App Router
  /(desktop)/page.tsx     the desktop entry (served at /)
  /api/audio/[handle]     serve converted audio by handle (GET) — implemented in M5
  /api/transform          record → MCP → ElevenLabs (POST)     — implemented in M5
  layout.tsx, globals.css
/components
  /retro                  hand-built 95/98 chrome (M1)
  /scenes                 react-three-fiber scenes (M3, M7, M8)
  /controls               recorder, filter picker, sliders (M2, M6)
/lib
  /audio                  analyser + feature extraction → AnimationParams (M2)
  /mcp-client             MCP client used by API routes (M5)
  /store                  Zustand store (M2)
/mcp-server               standalone MCP server, own package.json (M4)
  index.ts                stdio bootstrap (stub today)
  /tools                  one file per MCP tool (M4)
/tests                    Vitest setup + suites
```

Empty feature folders currently hold a `.gitkeep`; they fill in as milestones complete.

---

## Environment variables

Copy `.env.example` → `.env` and fill in as needed. **Secrets are server-side only — the browser never holds a key** (CLAUDE.md §10).

| Variable | Used by | Purpose |
|---|---|---|
| `ELEVENLABS_API_KEY` | MCP server | ElevenLabs voice transformation (needed from M4). |
| `AUDIO_TMP_DIR` | MCP server / API | Where converted audio is written and served from by handle. |

---

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · Three.js + @react-three/fiber + drei · Zustand · Framer Motion · Vitest · `@modelcontextprotocol/sdk`. Full rationale in [CLAUDE.md §3](CLAUDE.md).
