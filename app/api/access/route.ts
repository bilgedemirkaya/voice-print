import { NextResponse } from "next/server";
import { isValidAccessCode } from "@/lib/access";

// Validates a friend's access code without ever echoing the real one back.
export async function POST(request: Request): Promise<NextResponse> {
  let code: unknown;
  try {
    ({ code } = (await request.json()) as { code?: unknown });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: isValidAccessCode(typeof code === "string" ? code : null) });
}
