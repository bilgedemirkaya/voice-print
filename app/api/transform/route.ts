import { NextResponse } from "next/server";
import { transformVoice, type VoiceSettings } from "@/lib/mcp-client";
import { extForMimeType, writeAudio } from "@/lib/store/audioFiles";
import { BYOK_HEADER, FREE_TRIAL_LIMIT, TRIAL_COOKIE } from "@/lib/trialConfig";
import { readTrialFromRequest, signTrialCount } from "@/lib/trial";

const TRIAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Browser → here → MCP client → transform_voice → ElevenLabs. The shared key never reaches the
// browser; a visitor's own key (BYOK) rides in a header, is used per-request, and is never stored.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userKey = request.headers.get(BYOK_HEADER)?.trim() || undefined;

    const form = await request.formData();
    const audio = form.get("audio");
    const targetVoiceId = form.get("targetVoiceId");
    const settingsRaw = form.get("settings");

    if (!(audio instanceof Blob) || typeof targetVoiceId !== "string" || targetVoiceId.length === 0) {
      return NextResponse.json(
        { error: "audio file and targetVoiceId are required" },
        { status: 400 },
      );
    }

    let settings: VoiceSettings | undefined;
    if (typeof settingsRaw === "string" && settingsRaw.length > 0) {
      try {
        settings = JSON.parse(settingsRaw) as VoiceSettings;
      } catch {
        return NextResponse.json({ error: "invalid settings JSON" }, { status: 400 });
      }
    }

    // Trial gate applies only to the shared key; BYOK requests skip it entirely.
    const used = userKey ? 0 : readTrialFromRequest(request);
    if (!userKey && used >= FREE_TRIAL_LIMIT) {
      return NextResponse.json(
        {
          error: "Free trial used up — add your own ElevenLabs key to keep transforming.",
          code: "trial_exhausted",
          remaining: 0,
        },
        { status: 402 },
      );
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const audioHandle = await writeAudio(buffer, extForMimeType(audio.type || "audio/webm"));

    const result = await transformVoice({ audioHandle, targetVoiceId, settings, apiKey: userKey });

    // Count this transform only now that it succeeded; failures don't burn a free try.
    const remaining = userKey ? null : Math.max(0, FREE_TRIAL_LIMIT - (used + 1));
    const response = NextResponse.json({ ...result, remaining, byok: Boolean(userKey) });
    if (!userKey) {
      response.cookies.set(TRIAL_COOKIE, signTrialCount(used + 1), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: TRIAL_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "transform failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
