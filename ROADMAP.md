# ROADMAP.md — VOICESCREEN.SCR

> Build plan for the retro-90s voice visualizer described in [CLAUDE.md](CLAUDE.md).
> Each milestone is **independently buildable and independently testable**. Ship in order; don't start a milestone until the previous one's exit criteria are green.

---

## How to use this file

Each milestone has the same shape:

- **Goal** — one sentence, what "done" means.
- **Deliverables** — the concrete files/features produced.
- **Test in isolation** — how to prove this milestone works *without relying on later work*. This is the part that matters: every milestone must be verifiable on its own.
- **Build prompt** — paste into Claude Code to implement the milestone.
- **Test prompt** — paste into Claude Code to write/run the tests and verify.
- **Exit criteria** — the checklist that gates the next milestone.

**Conventions for every milestone**
- TypeScript strict, no `any` in committed code (CLAUDE.md §10).
- Pure audio logic stays framework-free and unit-tested; scenes are dumb consumers of `AnimationParams`.
- Secrets only on the server / MCP server. Browser never holds a key.
- Run `pnpm typecheck && pnpm lint` before declaring a milestone done.
- Each milestone ends with a commit on its own branch (`m0-scaffold`, `m1-retro-ui`, …).

**Test stack**
- **Unit**: Vitest (pure functions: audio features, params mapping, MCP tool input validation).
- **Component**: Vitest + Testing Library (retro chrome, dialogs, controls).
- **MCP server**: standalone integration tests + the MCP Inspector (`@modelcontextprotocol/inspector`) for manual tool calls.
- **E2E (from M5 on)**: Playwright for the record→transform→visualize loop, with ElevenLabs mocked.
- **Visual/manual**: a `/debug` route that dumps live `AnimationParams`; a fake-audio injector so scenes are testable without a mic.

---

## Dependency graph

```
M0 Scaffold ─┬─> M1 Retro UI ─────────────┐
             │                            ├─> M6 Filter picker ─> M7 Polish ─> M8 Stretch
             └─> M2 Record+Analyze ─┬──────┤
                                    │      │
                 M4 MCP server ─────┼─> M5 Wire the loop
                                    │
             M3 First scene <───────┘ (needs M2's AnimationParams)
```

M3 and M4 can be built in parallel once M2 exists. M4 (MCP server) has **no frontend dependency** and can even start right after M0.

---

## M0 — Scaffold & tooling

**Goal:** A monorepo that installs, typechecks, lints, and runs an empty Next.js app + an empty MCP server package.

**Deliverables**
- pnpm workspace: root app (Next.js App Router + TS strict + Tailwind) and `/mcp-server` (own `package.json`).
- Zustand, `@react-three/fiber`, `@react-three/drei`, `three`, Framer Motion installed.
- Vitest configured at root with a sample passing test.
- ESLint + Prettier; scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`.
- Directory skeleton exactly as in CLAUDE.md §8 (empty placeholder files where needed).
- `.env.example` listing `ELEVENLABS_API_KEY` and the temp-store path.

**Test in isolation**
- `pnpm install` succeeds clean.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass (test = the sample Vitest test).
- `pnpm dev` serves a placeholder desktop page at `/`.
- `pnpm --filter mcp-server dev` starts the (stub) MCP server without crashing.


**Exit criteria**
- [ ] Install / typecheck / lint / test / build all pass.
- [ ] Both packages boot.
- [ ] Directory tree matches CLAUDE.md §8.

---

## M1 — Retro UI shell

**Goal:** Hand-built Windows 95/98 chrome — `Window`, `Button`, `Dialog`, `TaskBar` — composable on a teal desktop, keyboard-accessible.

**Deliverables**
- `/components/retro/{Window,Button,Dialog,TaskBar}.tsx` (CLAUDE.md §8, §11).
- A draggable `Window` with classic title-bar gradient, min/close controls.
- `TaskBar` with Start button + live clock.
- Beveled `Button` with pressed/focus states.
- `app/page.tsx` renders the desktop: teal background, one Window, the TaskBar.
- Respects `prefers-reduced-motion`; visible focus rings; tab order works.

**Test in isolation**
- Component tests: Button fires onClick + shows pressed state; Dialog traps focus and closes on Escape; Window renders title + children; TaskBar clock updates.
- Manual: desktop renders, Window drags, keyboard can reach and activate every control.
- No audio, no MCP, no Three.js needed — this milestone is pure UI.

**Build prompt**
```
Read CLAUDE.md §10 (conventions) and §11 (UI direction). Build the retro chrome
in /components/retro: Window (draggable, title-bar gradient, min/close),
Button (beveled, pressed + focus states), Dialog (modal, focus-trapped, Escape
to close), TaskBar (Start button + live clock). Hand-build the 95/98 styling
with Tailwind + a small CSS layer — no prebuilt 98.css kit as the deliverable.
Wire app/page.tsx to show a teal desktop with one Window and the TaskBar.
Honor prefers-reduced-motion, keep focus rings, and ensure full keyboard nav.
```

**Test prompt**
```
Write Vitest + Testing Library tests for Window, Button, Dialog, TaskBar:
- Button: onClick fires, pressed/focus classes toggle.
- Dialog: focus is trapped, Escape closes, returns focus to trigger.
- TaskBar: clock renders and re-renders on tick (fake timers).
- Window: renders title and children; close button calls onClose.
Add an accessibility check: every interactive element is tab-reachable and has a
visible focus style. Run pnpm test and pnpm typecheck. Then start pnpm dev and
confirm the desktop renders and the Window drags. Fix until green.
```

**Exit criteria**
- [ ] All four components have passing component tests.
- [ ] Keyboard nav + focus rings verified.
- [ ] Desktop page renders and Window is draggable.

---

## M2 — Record + analyze → AnimationParams

**Goal:** Capture mic audio, run Web Audio analysis, and emit the typed `AnimationParams` from CLAUDE.md §5 — with the feature math as **pure, unit-tested functions**.

**Deliverables**
- `/components/controls/Recorder.tsx` — mic capture via MediaRecorder, start/stop, playback.
- `/lib/audio/features.ts` — pure functions: RMS, band energies (low/mid/high), spectral centroid, zero-crossing rate. **No React, no Three.js.**
- `/lib/audio/params.ts` — pure mapping from raw features → `AnimationParams` (energy, bass, mid, treble, brightness, roughness, palette, waveform).
- `/lib/audio/analyser.ts` — wires an `AnalyserNode` to the pure functions at ~60fps (throttled).
- `/lib/store` — Zustand store holding current `AnimationParams`.
- A `/debug` route rendering live params as text/bars.

**Test in isolation**
- Unit tests on `features.ts` and `params.ts` with **synthetic buffers**: a pure sine → known RMS/centroid; silence → zeros; white noise → high ZCR; low-freq tone → high `bass`, low `treble`. These need no mic and no browser audio.
- Manual: `/debug` shows params responding to your voice (loud → energy up, high-pitched → brightness up).
- This milestone is testable with **zero ElevenLabs and zero scenes**.

**Build prompt**
```
Read CLAUDE.md §5 (voice→visual mapping) and §10. Implement audio capture and
analysis:
- /lib/audio/features.ts: pure functions computing RMS, low/mid/high band
  energies, spectral centroid, and zero-crossing rate from Float32Array /
  Uint8Array FFT + time-domain buffers. No React, no three.
- /lib/audio/params.ts: pure mapping features -> the AnimationParams type from
  CLAUDE.md §5 (including the derived 3-color palette from brightness).
- /lib/audio/analyser.ts: connect an AnalyserNode, throttle to ~60fps, push
  AnimationParams into the Zustand store in /lib/store.
- /components/controls/Recorder.tsx: MediaRecorder start/stop + local playback.
- /debug route: render live AnimationParams as labeled bars + the waveform.
Keep all DSP pure and exported so it can be unit-tested without a browser.
```

**Test prompt**
```
Write Vitest unit tests for /lib/audio/features.ts and /lib/audio/params.ts
using synthetic buffers (helpers to generate sine, silence, white noise,
low/high tones):
- RMS of a unit sine ≈ 0.707; RMS of silence = 0.
- Spectral centroid higher for a high tone than a low tone.
- Zero-crossing rate near-zero for DC, high for noise.
- params mapping clamps every field to 0..1 and produces a 3-color palette;
  brighter input shifts hue warmer per the spec.
Add a fake-audio helper so /debug can be driven without a mic. Run pnpm test
and pnpm typecheck. Then open /debug, speak, and confirm energy/brightness
react. Report numbers. Fix until green.
```

**Exit criteria**
- [ ] `features.ts` + `params.ts` fully unit-tested with synthetic signals.
- [ ] `AnimationParams` matches CLAUDE.md §5 exactly.
- [ ] `/debug` shows live params reacting to voice.

---

## M3 — First scene: WAVEFIELD

**Goal:** An r3f scene that visibly reacts to `AnimationParams` — a displaced mesh driven by the FFT/waveform (CLAUDE.md §5).

**Deliverables**
- `/components/scenes/Wavefield.tsx` — r3f mesh whose displacement maps to `waveform`/bands; palette from `AnimationParams.palette`; motion amplitude from `energy`.
- Mounts in the desktop Window's canvas.
- Caps at display refresh; disposes geometry/material on unmount (CLAUDE.md §10 performance).
- Damps motion under `prefers-reduced-motion`.

**Test in isolation**
- Drive the scene with the **fake-audio injector** from M2 (canned `AnimationParams` sequences) — no mic, no ElevenLabs needed.
- Test: feeding high-energy params produces larger displacement than low-energy (assert on a deterministic param→uniform mapping function, kept pure).
- Manual: scrub a scripted params timeline and watch palette + motion change; a "snapshot" param set always looks the same.
- Verify no WebGL context leak across mount/unmount (dispose called).

**Build prompt**
```
Read CLAUDE.md §5 (scenes) and §10 (performance/reduced-motion). Build
/components/scenes/Wavefield.tsx as a react-three-fiber scene that consumes
AnimationParams from the Zustand store: displace a plane/mesh by the waveform
and band energies, set colors from params.palette, scale motion by energy and
glitch by roughness. Cap the loop at display refresh, dispose all three.js
resources on unmount, and damp motion when prefers-reduced-motion is set.
Extract the params->uniforms mapping into a PURE function so it can be unit
tested. Mount the scene inside the desktop Window's canvas.
```

**Test prompt**
```
Unit-test the pure params->uniforms mapping: higher energy => larger
displacement amplitude; palette flows through to color uniforms; roughness
increases jitter term; values stay finite. Add an r3f test (or a headless
mount) asserting geometry/material .dispose() is called on unmount (no leak).
Use the M2 fake-audio injector to feed scripted AnimationParams and confirm the
scene re-renders. Run pnpm test + pnpm typecheck, then open the desktop and
verify the Wavefield reacts when you speak via /debug. Fix until green.
```

**Exit criteria**
- [ ] Pure params→uniforms mapping unit-tested.
- [ ] Scene reacts to scripted params; disposes cleanly on unmount.
- [ ] Reduced-motion path verified.

---

## M4 — MCP server (list_voices, transform_voice)

**Goal:** A standalone MCP server wrapping ElevenLabs, exposing `list_voices` and `transform_voice`, returning **handles not blobs** (CLAUDE.md §4, §6, §7). Buildable with **no frontend**.

**Deliverables**
- `/mcp-server/tools/{listVoices,transformVoice}.ts` with strict zod schemas (CLAUDE.md §7 table).
- ElevenLabs Voice Changer / Speech-to-Speech wired (verify endpoint names against current ElevenLabs docs first — CLAUDE.md §6).
- Converted audio written to the temp store; tool returns `{ resultHandle, durationMs, voiceId }`.
- `/mcp-server/index.ts` registers tools over stdio.
- `/mcp-server/README.md` documenting each tool schema.

**Test in isolation**
- Unit-test zod input schemas (reject missing/invalid fields; accept valid).
- Integration test with the **ElevenLabs client mocked**: `transform_voice` writes a file to the temp store and returns a valid handle + metadata; `list_voices` returns the mapped `{id,name,labels}` shape.
- Manual: run `@modelcontextprotocol/inspector` against the stdio server, call `list_voices` (real key) and `transform_voice` on a sample WAV; confirm a handle comes back and the file exists.
- Completely independent of the browser — this is its own deliverable.

**Build prompt**
```
Read CLAUDE.md §4, §6, §7 and VERIFY current ElevenLabs endpoint/model names
against their live docs before coding. In /mcp-server build an
@modelcontextprotocol/sdk stdio server exposing two tools with strict zod
schemas:
- list_voices: {} -> [{id,name,labels}]
- transform_voice: {audioHandle, targetVoiceId, settings?} ->
  {resultHandle, durationMs, voiceId}
Wrap the ElevenLabs Voice Changer/Speech-to-Speech API. Read the key from the
MCP server's own env only. Write converted audio to the temp store (AUDIO_TMP_DIR)
and return a HANDLE + metadata — never raw/base64 audio over MCP. Document each
tool's schema in /mcp-server/README.md.
```

**Test prompt**
```
Write tests for the MCP server:
- zod schema unit tests: invalid inputs rejected, valid inputs pass.
- integration tests with the ElevenLabs client mocked: transform_voice writes a
  temp file and returns a well-formed handle + durationMs + voiceId; list_voices
  maps the API response to {id,name,labels}; the API key is read from env and
  never returned in any tool output.
Then give me exact commands to run @modelcontextprotocol/inspector against the
stdio server so I can manually call list_voices (real key) and transform_voice
on a sample WAV. Run the automated tests + typecheck. Fix until green.
```

**Exit criteria**
- [ ] Tool schemas unit-tested; tools integration-tested with mocked ElevenLabs.
- [ ] Returns handles + metadata, never raw audio; key never leaks.
- [ ] Verified manually via MCP Inspector.
- [ ] README documents both tool schemas.

---

## M5 — Wire the loop (the "wow" moment)

**Goal:** End-to-end: record → Next.js API → MCP client → `transform_voice` → fetch result by handle → re-analyze → **animation visibly changes** (CLAUDE.md §4, §12).

**Deliverables**
- `/lib/mcp-client` — wraps an MCP client used by API routes.
- `/app/api/transform` — receives recorded audio, calls the MCP client, returns the result handle.
- `/app/api/audio/[handle]` — serves audio by handle (GET).
- Frontend flow: record → upload → transform → fetch converted clip → feed analyser → scene updates.
- Loading/error states in the UI.

**Test in isolation**
- E2E (Playwright) with ElevenLabs **mocked at the MCP server**: simulate a recording, trigger transform, assert the converted clip loads and the store's `AnimationParams` change from pre- to post-transform.
- Integration test on the API routes (handle round-trips: store a file, fetch it back).
- Manual: record real voice, hit transform with a real voice id, hear the new voice and see the Wavefield palette/motion shift.

**Build prompt**
```
Read CLAUDE.md §4 (architecture) and §12 (milestone 5). Wire the full loop:
- /lib/mcp-client: an MCP client the API routes use to call the M4 server.
- /app/api/transform: accept the recorded audio (store it, get an audioHandle),
  call transform_voice via the MCP client, return {resultHandle, ...}.
- /app/api/audio/[handle]: stream stored audio by handle.
- Frontend: after record, POST to /api/transform, fetch the converted clip from
  /api/audio/[handle], pipe it through the M2 analyser so AnimationParams update
  and the Wavefield changes. Add loading + error states. Browser never sees a key.
```

**Test prompt**
```
Write a Playwright E2E test with ElevenLabs mocked inside the MCP server:
inject a fake recording, click transform, assert (a) the converted audio loads
from /api/audio/[handle] and (b) AnimationParams in the store differ before vs
after transform (palette or energy changes). Add API integration tests proving
the audio handle round-trips (store then GET returns the same bytes/length).
Run pnpm test, the E2E suite, and typecheck. Then walk me through a manual run
with a real voice id and tell me what to look/listen for. Fix until green.
```

**Exit criteria**
- [ ] E2E passes with mocked ElevenLabs; params change post-transform.
- [ ] Audio handle round-trips through the API.
- [ ] Manual run shows new voice + visibly different animation. **(This is the demo bar from CLAUDE.md §12.)**

---

## M6 — Filter picker UI (Screen Saver dialog)

**Goal:** A fake **Display Properties → Screen Saver** dialog where you pick a named "screensaver" scene + a target voice + voice settings, then apply the conversion (CLAUDE.md §2 iterated idea, §6, §11).

**Deliverables**
- `/components/controls/FilterPicker.tsx` rendered inside the retro `Dialog`.
- Named scene list ("WAVEFIELD", "MYSTIFY", …) → sets the active scene in the store; unbuilt scenes show an honest placeholder (real scenes land in M7/M8).
- Target-voice dropdown populated from `/api/voices` (`list_voices`).
- Advanced sliders: stability, similarity, style → write `voiceSettings` to the store.
- An explicit **Apply** button drives the M5 loop with the chosen voice + settings.

> **Decision (deviates from the original brief):** transforms fire on **Apply**, not debounced-on-every-slider-change. Each ElevenLabs conversion costs real credits (100+), so auto-transforming on every tweak would burn quota. Sliders/scene/voice update state instantly; Apply spends credits.

**Test in isolation**
- Component test (fetch + store stubbed): loads voices and defaults the target voice; selecting a scene sets `activeScene`; a slider updates `voiceSettings`; **Apply** is disabled until a clip is recorded, then POSTs to `/api/transform` with the chosen voice + settings and stores the converted URL; quota errors render a friendly message.
- No real API needed — `/api/voices` and `/api/transform` are stubbed.
- Manual: record, open the dialog, pick a voice + scene, tune sliders, Apply → confirm the converted voice + the scene/palette change.

**Build prompt**
```
Read CLAUDE.md §2 (Screen Saver framing), §6 (settings sliders), §11 (dialog as
Display Properties). Build /components/controls/FilterPicker.tsx inside the retro
Dialog: a named scene list that sets the active scene, a target-voice dropdown
from /api/voices, and stability/similarity/style sliders that write voiceSettings
to the store. Drive the M5 loop from an explicit Apply button (not debounced
auto-transform — conversions cost credits). Style it as a faithful Display
Properties → Screen Saver dialog.
```

**Test prompt**
```
Write component tests for FilterPicker (fetch + store stubbed):
- loads voices from /api/voices and defaults the target voice.
- selecting a scene sets activeScene; a slider updates voiceSettings.
- Apply is disabled until a clip is recorded; once recorded it POSTs to
  /api/transform with the chosen voiceId + settings and stores the converted URL.
- quota errors surface a friendly message.
Run pnpm test + typecheck. Then manually record, open the dialog, pick a voice +
scene, tune sliders, Apply, and confirm voice + scene + palette change. Fix until green.
```

**Exit criteria**
- [ ] Scene selection + voice + sliders update store state (tested).
- [ ] Apply drives a transform with the chosen voice + settings (tested).
- [ ] Manual: applying a voice changes the converted audio + the scene reacts.

---

## M7 — Polish

**Goal:** Second scene + the finishing craft that makes a designer believe it was art-directed (CLAUDE.md §5, §11, §10).

**Deliverables**
- `/components/scenes/Mystify.tsx` — bouncing polylines with afterimage trails (CLAUDE.md §5).
- CRT layer: subtle scanlines + vignette, toggleable, **off under reduced-motion**.
- Framer Motion window/dialog open/close transitions (UI only, not the canvas).
- Reduced-motion path damps the canvas globally.
- Export: looping video or generated "About this voice" card (CLAUDE.md §2).

**Test in isolation**
- Unit-test Mystify's pure param→geometry mapping (vertex jitter scales with energy; palette from brightness).
- Toggle tests: CRT on/off; CRT forced off when `prefers-reduced-motion`.
- Snapshot/manual: a fixed param set renders a stable Mystify frame.
- Export tested with a canned params loop → produces a file/card artifact.

**Build prompt**
```
Read CLAUDE.md §5 (Mystify spec), §10 (reduced-motion, performance), §11 (CRT,
transitions). Add /components/scenes/Mystify.tsx (bouncing polylines, afterimage
trails, vertex jitter by energy, palette by brightness — pure param->geometry
mapping extracted for testing). Add a toggleable CRT overlay (scanlines +
vignette) that is forced off under prefers-reduced-motion. Add Framer Motion
open/close transitions to Window and Dialog (UI only). Implement the export
(looping video or retro "About this voice" card per CLAUDE.md §2).
```

**Test prompt**
```
Write tests:
- Mystify pure mapping: vertex jitter scales with energy, colors from palette,
  values finite.
- CRT toggle on/off works; CRT is disabled when prefers-reduced-motion matches.
- export produces a non-empty artifact from a canned AnimationParams loop.
Run pnpm test + typecheck. Then manually verify: CRT looks tasteful and toggles,
reduced-motion damps the canvas and kills CRT, Mystify reacts, and export saves a
file. Fix until green.
```

**Exit criteria**
- [ ] Mystify reacts and is unit-tested.
- [ ] CRT toggles and respects reduced-motion.
- [ ] Export produces an artifact.

---

## M8 — Stretch: more scenes (Starfield + Pipes)

**Goal:** Add the remaining retro scenes so the screensaver picker has depth (CLAUDE.md §5). Two scenes already impress; this takes it toward the four-scene ceiling.

**Deliverables**
- `/components/scenes/Starfield.tsx` — warp-speed star streaks; speed by `energy`, color by band split (CLAUDE.md §5).
- `/components/scenes/Pipes.tsx` — growing 3D pipe network; growth rate by `bass` (CLAUDE.md §5).
- Both registered as named presets in the M6 Screen Saver picker.

**Test in isolation**
- Reuse the M3 harness: feed scripted `AnimationParams` and assert each scene reacts (extract a pure param→geometry/uniform mapping and unit-test it).
- Dispose checks: geometry/material `.dispose()` is called on unmount and on scene switch — no WebGL leak.
- Manual: switch to Starfield and Pipes from the picker and confirm each reacts to voice and respects reduced-motion.
- No ElevenLabs and no mic needed — scenes are driven by canned params.

**Build prompt**
```
Read CLAUDE.md §5 (Starfield + Pipes specs) and §10 (performance/reduced-motion).
Add /components/scenes/Starfield.tsx (warp-speed star streaks: speed by energy,
color by band split) and /components/scenes/Pipes.tsx (growing 3D pipe network:
growth rate by bass). Reuse the M3 pattern: extract a pure params->geometry/uniform
mapping for testing, cap the loop at display refresh, dispose all three.js
resources on unmount, and damp motion under prefers-reduced-motion. Register both
as named presets in the M6 Screen Saver picker.
```

**Test prompt**
```
For Starfield and Pipes, reuse the M3 harness:
- unit-test the pure params->geometry mapping (star speed scales with energy;
  pipe growth scales with bass; palette flows through; values stay finite).
- assert .dispose() is called on unmount and on scene switch (no leak).
- feed scripted AnimationParams and confirm each scene re-renders.
Run pnpm test + typecheck. Then manually pick each new preset and confirm it
reacts to voice and respects reduced-motion. Fix until green.
```

**Exit criteria**
- [ ] Starfield + Pipes react to scripted params (pure mappings unit-tested).
- [ ] Both dispose cleanly on unmount / scene switch.
- [ ] Both selectable as presets and respect reduced-motion.

---

## Definition of done (whole project)

- A reviewer hits the demo bar from CLAUDE.md §12 by M5: record once, apply a filter, **hear a new voice and see the animation change**.
- The MCP server stands alone — runnable in any MCP host (Claude Desktop / Inspector), documented, schema-strict.
- FE craft reads as art-directed (CLAUDE.md §11); reduced-motion + keyboard nav intact.
- All milestones' tests pass; `pnpm typecheck && pnpm lint && pnpm test` green from root.

> When any **Open decision** in CLAUDE.md §13 is resolved during a milestone, update CLAUDE.md in the same commit.
