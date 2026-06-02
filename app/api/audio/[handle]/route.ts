import { NextResponse } from "next/server";

// Placeholder — serves converted audio by handle (GET). Implemented in M5.
// See CLAUDE.md §4, §8 and ROADMAP.md M5.
export function GET(): NextResponse {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
