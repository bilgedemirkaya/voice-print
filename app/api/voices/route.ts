import { NextResponse } from "next/server";
import { listVoices } from "@/lib/elevenlabs";
import { FREE_TRIAL_LIMIT } from "@/lib/trialConfig";
import { readTrialFromRequest } from "@/lib/trial";
import { isLocalDev } from "@/lib/access";

// Lists voices for the picker, and reports how many free transforms remain (read from the signed
// cookie) so the UI shows the real count on load instead of optimistically assuming the full quota.
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const voices = await listVoices();
    const remaining = isLocalDev()
      ? null
      : Math.max(0, FREE_TRIAL_LIMIT - readTrialFromRequest(request));
    return NextResponse.json({ voices, remaining });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
