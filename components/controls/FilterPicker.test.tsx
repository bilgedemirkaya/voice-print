import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ORIGINAL_TAKE_ID, selectActiveScene, useAudioStore } from "@/lib/store/audioStore";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/types";
import { FREE_TRIAL_LIMIT } from "@/lib/trialConfig";

// Avoid pulling next/dynamic + three into the test; we only need the scene metadata.
vi.mock("@/components/scenes/registry", () => ({
  SCENES: [
    { id: "wavefield", name: "WAVEFIELD", implemented: true },
    { id: "mystify", name: "MYSTIFY", implemented: false },
    { id: "starfield", name: "STARFIELD", implemented: false },
  ],
  SceneView: () => null,
}));

import { FilterPicker } from "./FilterPicker";

const VOICES = [
  { id: "v1", name: "Robotic", labels: { gender: "male", age: "young", accent: "american" } },
  { id: "v2", name: "Narrator", labels: { gender: "female", age: "middle_aged", accent: "british" } },
];

const palette = ["#111", "#222", "#333"] as [string, string, string];

let transformInit: RequestInit | undefined;
let transformResponse: () => Response;

/** Each render gets its own QueryClient so voices/transform caches don't leak between tests. */
function renderWithClient(ui: ReactNode): RenderResult {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function resetStore() {
  if (typeof window !== "undefined") window.sessionStorage.clear();
  useAudioStore.setState({
    originalScene: "wavefield",
    conversions: [],
    selectedTakeId: ORIGINAL_TAKE_ID,
    draft: null,
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    recordedBlob: null,
    dirty: false,
    transformError: null,
    soundEnabled: true,
    voicePalette: null,
    accessCode: null,
    userApiKey: null,
    trialRemaining: null,
  });
}

beforeEach(() => {
  resetStore();
  transformInit = undefined;
  // Success streams the converted audio back as the body, with trial info in headers.
  transformResponse = () =>
    new Response(new Blob(["CONVERTED"], { type: "audio/mpeg" }), {
      status: 200,
      headers: { "X-Voice-Id": "v1", "X-Trial-Remaining": "1" },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/voices")) {
        return new Response(JSON.stringify({ voices: VOICES }), { status: 200 });
      }
      if (url.includes("/api/transform")) {
        transformInit = init;
        return transformResponse();
      }
      if (url.includes("/api/access")) {
        const body = init?.body ? (JSON.parse(String(init.body)) as { code?: string }) : {};
        return new Response(JSON.stringify({ ok: (body.code ?? "").toUpperCase() === "GOODCODE" }), {
          status: 200,
        });
      }
      return new Response("nope", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const activeScene = () => selectActiveScene(useAudioStore.getState());
const draftVoiceId = () => useAudioStore.getState().draft?.voiceId;
const sceneOf = (voiceId: string) =>
  useAudioStore.getState().conversions.find((c) => c.voiceId === voiceId)?.sceneId;

describe("FilterPicker", () => {
  it("loads voices and exposes cascading label filters", async () => {
    renderWithClient(<FilterPicker />);
    expect(await screen.findByRole("option", { name: "female" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "male" })).toBeInTheDocument();
  });

  it("picking a voice by a label filter starts a draft and sets a voice palette", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }) }); // voice filters need a recording
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "female" });

    await user.selectOptions(screen.getByRole("combobox", { name: /Gender/i }), "female");

    expect(draftVoiceId()).toBe("v2");
    expect(useAudioStore.getState().voicePalette).not.toBeNull();
  });

  it("selecting a screensaver sets the active scene", async () => {
    const user = userEvent.setup();
    renderWithClient(<FilterPicker />);
    await screen.findByRole("button", { name: /MYSTIFY/ });

    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));

    expect(activeScene()).toBe("mystify");
  });

  it("changing the screensaver re-skins only the selected take, live", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      conversions: [
        { voiceId: "v1", voiceName: "Robotic", url: "/a.mp3", sceneId: "wavefield", palette },
        { voiceId: "v2", voiceName: "Narrator", url: "/b.mp3", sceneId: "starfield", palette },
      ],
      selectedTakeId: "v2", // the take selected in the gallery — the dialog edits it
    });
    renderWithClient(<FilterPicker />);
    await screen.findByRole("button", { name: /MYSTIFY/ });

    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));

    expect(sceneOf("v2")).toBe("mystify"); // selected one updated
    expect(sceneOf("v1")).toBe("wavefield"); // others untouched
  });

  it("configuring a different voice does NOT overwrite the selected take's scene (the bug)", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      recordedBlob: new Blob(["rec"], { type: "audio/webm" }),
      conversions: [
        { voiceId: "v1", voiceName: "Robotic", url: "/a.mp3", sceneId: "wavefield", palette },
      ],
      selectedTakeId: "v1", // viewing v1…
    });
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "female" });

    // …configure a *different* voice (v2), then pick a new screensaver for it
    await user.selectOptions(screen.getByRole("combobox", { name: /Gender/i }), "female");
    expect(draftVoiceId()).toBe("v2");
    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));

    // the new scene rides on the draft only; v1 is left exactly as it was
    expect(sceneOf("v1")).toBe("wavefield");
    expect(useAudioStore.getState().draft?.sceneId).toBe("mystify");
    expect(activeScene()).toBe("mystify");
  });

  it("adding a voice while 'You' is selected does not change You's screensaver", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      conversions: [
        { voiceId: "v1", voiceName: "Robotic", url: "/a.mp3", sceneId: "wavefield", palette },
      ],
      selectedTakeId: ORIGINAL_TAKE_ID, // viewing "You"…
      originalScene: "axolotl",
    });
    // "+ Add a voice" starts a draft for a new voice before the dialog opens (see page.tsx)
    useAudioStore.getState().setDraftVoice("v2", "Narrator", palette);
    renderWithClient(<FilterPicker />);
    await screen.findByRole("button", { name: /MYSTIFY/ });

    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));

    expect(useAudioStore.getState().originalScene).toBe("axolotl"); // You untouched
    expect(sceneOf("v1")).toBe("wavefield"); // existing take untouched
    expect(useAudioStore.getState().draft?.sceneId).toBe("mystify"); // rides on the draft
  });

  it("a voice filter never changes the screensaver, even when it lands on the selected take's voice", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      recordedBlob: new Blob(["rec"], { type: "audio/webm" }),
      conversions: [
        { voiceId: "v1", voiceName: "Robotic", url: "/a.mp3", sceneId: "axolotl", palette },
      ],
      selectedTakeId: "v1", // a male take whose own scene is Axolotl…
      draft: { voiceId: "v2", voiceName: "Narrator", sceneId: "mystify", palette }, // …composing v2 w/ Mystify
    });
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "male" });

    // Switching gender → male jumps off v2 and lands on v1 (the selected take's own voice).
    await user.selectOptions(screen.getByRole("combobox", { name: /Gender/i }), "male");

    expect(draftVoiceId()).toBe("v1"); // the voice followed the filter…
    expect(activeScene()).toBe("mystify"); // …but the screensaver stayed put (not v1's Axolotl)
    expect(sceneOf("v1")).toBe("axolotl"); // and the existing take is untouched
  });

  it("changing a voice filter leaves the chosen screensaver alone", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      originalScene: "starfield", // the user deliberately picked Starfield
      recordedBlob: new Blob(["rec"], { type: "audio/webm" }),
    });
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "female" });

    await user.selectOptions(screen.getByRole("combobox", { name: /Gender/i }), "female");

    expect(draftVoiceId()).toBe("v2"); // the voice changed…
    expect(activeScene()).toBe("starfield"); // …the screensaver did not
  });

  it("a new recording captures the on-screen scene as the 'You' scene", () => {
    useAudioStore.setState({
      conversions: [
        { voiceId: "v1", voiceName: "Robotic", url: "/a.mp3", sceneId: "starfield", palette },
      ],
      selectedTakeId: "v1", // Starfield is on screen while recording
      originalScene: "axolotl",
    });
    useAudioStore.getState().setRecordedBlob(new Blob(["x"], { type: "audio/webm" }));
    expect(useAudioStore.getState().originalScene).toBe("starfield");
    expect(useAudioStore.getState().selectedTakeId).toBe(ORIGINAL_TAKE_ID);
  });

  it("editing the screensaver with no voice targeted re-skins 'You', not a voice take", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      selectedTakeId: ORIGINAL_TAKE_ID, // "You" selected → no transform target
      originalScene: "axolotl",
      conversions: [
        { voiceId: "v1", voiceName: "Robotic", url: "/a.mp3", sceneId: "starfield", palette },
      ],
    });
    renderWithClient(<FilterPicker />);
    await screen.findByRole("button", { name: /MYSTIFY/ });

    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));

    expect(useAudioStore.getState().originalScene).toBe("mystify"); // You's own scene updated
    expect(sceneOf("v1")).toBe("starfield"); // the voice take is untouched
  });

  it("a slider updates voiceSettings", async () => {
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }) }); // settings need a recording
    renderWithClient(<FilterPicker />);
    const stability = await screen.findByRole("slider", { name: /Stability/ });
    fireEvent.change(stability, { target: { value: "0.8" } });
    expect(useAudioStore.getState().voiceSettings.stability).toBe(0.8);
  });

  it("gates voice filters + settings until a recording exists", async () => {
    renderWithClient(<FilterPicker />); // beforeEach leaves recordedBlob null
    // screensavers are always selectable…
    expect(await screen.findByRole("button", { name: /WAVEFIELD/ })).toBeEnabled();
    // …but a voice filter transforms a recording, so it (and the settings) stay disabled without one
    expect(screen.getByRole("combobox", { name: /Gender/i })).toBeDisabled();
    expect(screen.getByRole("slider", { name: /Stability/ })).toBeDisabled();
  });

  it("disables Apply with nothing to apply (no recording, no scene change)", async () => {
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "female" });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("changing only the screensaver enables Apply and confirms it without a transform request", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    renderWithClient(<FilterPicker onApplied={onApplied} />); // no recording → nothing to transform
    await screen.findByRole("button", { name: /MYSTIFY/ });

    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));
    expect(activeScene()).toBe("mystify"); // applied live to the main window
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeEnabled();

    await user.click(apply);
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(transformInit).toBeUndefined(); // never hit ElevenLabs
  });

  it("after recording, defaults a target voice so Apply is ready", async () => {
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }) });
    renderWithClient(<FilterPicker />);
    await waitFor(() => expect(draftVoiceId()).toBe("v1"));
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("Apply transforms with the chosen voice + settings and stores the converted take", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      recordedBlob: new Blob(["rec"], { type: "audio/webm" }),
      voiceSettings: { stability: 0.7, similarity_boost: 0.9, style: 0.2 },
    });
    renderWithClient(<FilterPicker />);
    await waitFor(() => expect(draftVoiceId()).toBe("v1"));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(useAudioStore.getState().conversions).toHaveLength(1));
    expect(useAudioStore.getState().conversions[0]).toMatchObject({
      voiceId: "v1",
      voiceName: "Robotic",
      url: "blob:mock", // the converted audio, played from an object URL (no server storage)
      sceneId: "wavefield", // the draft scene, seeded from the on-screen "You" scene
    });
    expect(useAudioStore.getState().trialRemaining).toBe(1); // from the X-Trial-Remaining header
    const body = transformInit?.body as FormData;
    expect(body.get("targetVoiceId")).toBe("v1");
    expect(JSON.parse(String(body.get("settings")))).toMatchObject({ stability: 0.7 });
  });

  it("shows a friendly message on quota errors", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }) });
    transformResponse = () =>
      new Response(
        JSON.stringify({
          error:
            'ElevenLabs speech-to-speech failed (401): {"detail":{"code":"quota_exceeded","message":"over quota"}}',
        }),
        { status: 500 },
      );
    renderWithClient(<FilterPicker />);
    await waitFor(() => expect(draftVoiceId()).toBe("v1"));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText(/Out of ElevenLabs credits/i)).toBeInTheDocument();
  });

  it("closes the dialog via onApplied when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }) });
    renderWithClient(<FilterPicker onApplied={onApplied} />);
    await waitFor(() => expect(draftVoiceId()).toBe("v1"));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("toggles sounds", async () => {
    const user = userEvent.setup();
    renderWithClient(<FilterPicker />);
    const checkbox = await screen.findByRole("checkbox", { name: /sounds/i });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(useAudioStore.getState().soundEnabled).toBe(false);
  });

  it("shows the free-trial counter and unlocks with a valid access code", async () => {
    const user = userEvent.setup();
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "female" });

    expect(
      screen.getByText(`Free voices left: ${FREE_TRIAL_LIMIT} / ${FREE_TRIAL_LIMIT}`),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Access code"), "GOODCODE");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(useAudioStore.getState().accessCode).toBe("GOODCODE"));
    expect(screen.getByText(/Access code accepted/i)).toBeInTheDocument();
  });

  it("lets a visitor save their own ElevenLabs key", async () => {
    const user = userEvent.setup();
    renderWithClient(<FilterPicker />);
    await screen.findByRole("option", { name: "female" });

    await user.type(screen.getByLabelText("ElevenLabs API key"), "xi-mine");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    expect(useAudioStore.getState().userApiKey).toBe("xi-mine");
    expect(screen.getByText(/Using your own ElevenLabs key/i)).toBeInTheDocument();
  });
});
