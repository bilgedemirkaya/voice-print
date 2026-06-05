import { describe, expect, it } from "vitest";
import { ORIGINAL_TAKE_ID, useAudioStore } from "./audioStore";
import { DEFAULT_VOICE_SETTINGS } from "@/lib/types";

const palette = ["#1", "#2", "#3"] as [string, string, string];

describe("audioStore.reset", () => {
  it("wipes the session (recording, takes, draft, tuning) but keeps display + access prefs", () => {
    useAudioStore.setState({
      recordedBlob: new Blob(["x"], { type: "audio/webm" }),
      conversions: [{ voiceId: "v1", voiceName: "A", url: "/a.mp3", sceneId: "mystify", palette }],
      selectedTakeId: "v1",
      draft: { voiceId: "v2", voiceName: "B", sceneId: "axolotl", palette },
      voicePalette: palette,
      dirty: true,
      transformError: "boom",
      playingLabel: "A",
      voiceSettings: { stability: 0.1, similarity_boost: 0.2, style: 0.3 },
      // preferences that should survive a reset:
      originalScene: "starfield",
      crtEnabled: false,
      accessCode: "SESAME",
      trialRemaining: 5,
    });

    useAudioStore.getState().reset();
    const s = useAudioStore.getState();

    // session wiped
    expect(s.recordedBlob).toBeNull();
    expect(s.conversions).toEqual([]);
    expect(s.selectedTakeId).toBe(ORIGINAL_TAKE_ID);
    expect(s.draft).toBeNull();
    expect(s.voicePalette).toBeNull();
    expect(s.dirty).toBe(false);
    expect(s.transformError).toBeNull();
    expect(s.playingLabel).toBeNull();
    expect(s.voiceSettings).toEqual(DEFAULT_VOICE_SETTINGS);

    // preferences preserved
    expect(s.originalScene).toBe("starfield");
    expect(s.crtEnabled).toBe(false);
    expect(s.accessCode).toBe("SESAME");
    expect(s.trialRemaining).toBe(5);
  });
});
