import { NextResponse } from "next/server";

// Placeholder — record → MCP client → transform_voice (POST). Implemented in M5.
// See CLAUDE.md §4, §8 and ROADMAP.md M5.
export function POST(): NextResponse {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
