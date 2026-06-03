import { NextResponse } from "next/server";
import { listVoices } from "@/lib/elevenlabs";

// Populates the voice picker from ElevenLabs (GET /v1/voices), server-side — the key never leaks.
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ voices: await listVoices() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
