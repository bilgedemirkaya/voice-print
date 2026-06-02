import { NextResponse } from "next/server";
import { listVoices } from "@/lib/mcp-client";

// Populates the voice picker via the MCP server's list_voices tool.
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ voices: await listVoices() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
