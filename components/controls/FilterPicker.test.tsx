import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_VOICE_SETTINGS, useAudioStore } from "@/lib/store/audioStore";

// Avoid pulling next/dynamic + three into the test; we only need the scene metadata.
vi.mock("@/components/scenes/registry", () => ({
  SCENES: [
    { id: "wavefield", name: "WAVEFIELD", implemented: true },
    { id: "mystify", name: "MYSTIFY", implemented: false },
    { id: "starfield", name: "STARFIELD", implemented: false },
    { id: "pipes", name: "PIPES", implemented: false },
  ],
  SceneView: () => null,
}));

import { FilterPicker } from "./FilterPicker";

const VOICES = [
  { id: "v1", name: "Robotic", labels: {} },
  { id: "v2", name: "Narrator", labels: {} },
];

let transformInit: RequestInit | undefined;
let transformResponse: () => Response;

function resetStore() {
  useAudioStore.setState({
    activeScene: "wavefield",
    targetVoiceId: "",
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    recordedBlob: null,
    conversions: [],
    transforming: false,
    transformError: null,
    crtEnabled: true,
    soundEnabled: true,
    dirty: false,
    voices: [],
    voicesStatus: "idle",
    voicesError: null,
  });
}

beforeEach(() => {
  resetStore();
  transformInit = undefined;
  transformResponse = () =>
    new Response(JSON.stringify({ resultHandle: "out.mp3", durationMs: 1000, voiceId: "v1" }), {
      status: 200,
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
      return new Response("nope", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FilterPicker", () => {
  it("loads voices and defaults the target voice", async () => {
    render(<FilterPicker />);
    expect(await screen.findByRole("option", { name: "Robotic" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Narrator" })).toBeInTheDocument();
    await waitFor(() => expect(useAudioStore.getState().targetVoiceId).toBe("v1"));
  });

  it("selecting a screensaver sets the active scene and enables Apply", async () => {
    const user = userEvent.setup();
    render(<FilterPicker />);
    await waitFor(() => expect(useAudioStore.getState().targetVoiceId).toBe("v1"));

    await user.click(screen.getByRole("button", { name: /MYSTIFY/ }));

    expect(useAudioStore.getState().activeScene).toBe("mystify");
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("a slider updates voiceSettings", async () => {
    render(<FilterPicker />);
    const stability = await screen.findByRole("slider", { name: /Stability/ });
    fireEvent.change(stability, { target: { value: "0.8" } });
    expect(useAudioStore.getState().voiceSettings.stability).toBe(0.8);
  });

  it("disables Apply with no changes, enables it once a setting changes (no recording needed)", async () => {
    render(<FilterPicker />);
    await waitFor(() => expect(useAudioStore.getState().targetVoiceId).toBe("v1"));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    fireEvent.change(screen.getByRole("slider", { name: /Stability/ }), {
      target: { value: "0.8" },
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("Apply transforms with the chosen voice + settings and stores the converted URL", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({
      recordedBlob: new Blob(["rec"], { type: "audio/webm" }),
      voiceSettings: { stability: 0.7, similarity_boost: 0.9, style: 0.2 },
      dirty: true,
    });
    render(<FilterPicker />);
    await waitFor(() => expect(useAudioStore.getState().targetVoiceId).toBe("v1"));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(useAudioStore.getState().conversions).toEqual([
        { voiceId: "v1", voiceName: "Robo", url: "/api/audio/out.mp3" },
      ]),
    );
    const body = transformInit?.body as FormData;
    expect(body.get("targetVoiceId")).toBe("v1");
    expect(JSON.parse(String(body.get("settings")))).toMatchObject({ stability: 0.7 });
  });

  it("shows a friendly message on quota errors", async () => {
    const user = userEvent.setup();
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }), dirty: true });
    transformResponse = () =>
      new Response(
        JSON.stringify({
          error:
            'ElevenLabs speech-to-speech failed (401): {"detail":{"code":"quota_exceeded","message":"over quota"}}',
        }),
        { status: 500 },
      );
    render(<FilterPicker />);
    await waitFor(() => expect(useAudioStore.getState().targetVoiceId).toBe("v1"));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText(/Out of ElevenLabs credits/i)).toBeInTheDocument();
  });

  it("closes the dialog via onApplied when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    useAudioStore.setState({ recordedBlob: new Blob(["rec"], { type: "audio/webm" }), dirty: true });
    render(<FilterPicker onApplied={onApplied} />);
    await waitFor(() => expect(useAudioStore.getState().targetVoiceId).toBe("v1"));

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("toggles the CRT effect", async () => {
    const user = userEvent.setup();
    render(<FilterPicker />);
    const checkbox = await screen.findByRole("checkbox", { name: /CRT/ });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(useAudioStore.getState().crtEnabled).toBe(false);
  });

  it("toggles sounds", async () => {
    const user = userEvent.setup();
    render(<FilterPicker />);
    const checkbox = await screen.findByRole("checkbox", { name: /sounds/i });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(useAudioStore.getState().soundEnabled).toBe(false);
  });
});
