import { NextResponse } from "next/server";
import { speechToSpeech, type VoiceSettings } from "@/lib/elevenlabs";
import { writeAudio } from "@/lib/store/audioFiles";
import { ACCESS_CODE_HEADER, BYOK_HEADER, FREE_TRIAL_LIMIT, TRIAL_COOKIE } from "@/lib/trialConfig";
import { readTrialFromRequest, signTrialCount } from "@/lib/trial";
import { bumpIp, isIpRateLimited } from "@/lib/trialIp";
import { isLocalDev, isValidAccessCode } from "@/lib/access";

const TRIAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Browser → here → ElevenLabs (server-side). The host's key always stays server-side. Trial is
// skipped when: local dev, a valid shared access code (uses the host key), or the visitor brought
// their own key (used per-request, never stored). Otherwise the free-trial gate (signed cookie +
// optional per-IP backstop) applies.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userKey = request.headers.get(BYOK_HEADER)?.trim() || undefined;
    // Local dev always uses the host key — ignore any stray BYOK header left in the browser.
    const local = isLocalDev();
    const codeUnlock = local || isValidAccessCode(request.headers.get(ACCESS_CODE_HEADER));
    const bypassTrial = codeUnlock || Boolean(userKey);

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

    const used = bypassTrial ? 0 : readTrialFromRequest(request);
    if (!bypassTrial) {
      if (used >= FREE_TRIAL_LIMIT) {
        return NextResponse.json(
          {
            error: "Free trial used up — enter an access code or your own ElevenLabs key to continue.",
            code: "trial_exhausted",
            remaining: 0,
          },
          { status: 402 },
        );
      }
      // Per-IP hard backstop (survives cookie-clearing); no-op unless Upstash is configured.
      if (await isIpRateLimited(request)) {
        return NextResponse.json(
          {
            error: "This network has used today's free transforms — enter an access code or your own key.",
            code: "ip_rate_limited",
            remaining: 0,
          },
          { status: 429 },
        );
      }
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    // apiKey present → BYOK (visitor's key); undefined → host key (local / valid code / trial).
    const converted = await speechToSpeech({
      voiceId: targetVoiceId,
      audio: buffer,
      audioContentType: audio.type || "audio/webm",
      settings,
      apiKey: local ? undefined : userKey,
    });
    const resultHandle = await writeAudio(converted.audio, "mp3");
    const result = { resultHandle, durationMs: converted.durationMsApprox, voiceId: targetVoiceId };

    // Count this transform only now that it succeeded; failures don't burn a free try.
    const remaining = bypassTrial ? null : Math.max(0, FREE_TRIAL_LIMIT - (used + 1));
    const response = NextResponse.json({ ...result, remaining, unlimited: bypassTrial });
    if (!bypassTrial) {
      await bumpIp(request);
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
