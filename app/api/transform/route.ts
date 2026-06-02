import { NextResponse } from "next/server";
import { transformVoice, type VoiceSettings } from "@/lib/mcp-client";
import { extForMimeType, writeAudio } from "@/lib/store/audioFiles";

// Browser → here → MCP client → transform_voice → ElevenLabs. The key never reaches the browser.
export async function POST(request: Request): Promise<NextResponse> {
  try {
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

    const buffer = Buffer.from(await audio.arrayBuffer());
    const audioHandle = await writeAudio(buffer, extForMimeType(audio.type || "audio/webm"));

    const result = await transformVoice({ audioHandle, targetVoiceId, settings });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "transform failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
