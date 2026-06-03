// Server-only: signs/verifies the per-visitor free-trial counter with an HMAC so the client
// can't forge a lower count. Stateless (no DB), so it works on serverless. node:crypto keeps
// this off any client bundle. Clearing cookies resets the trial — acceptable as a soft gate;
// add a per-IP store (e.g. Upstash) if you need protection against that.
import { createHmac, timingSafeEqual } from "node:crypto";
import { TRIAL_COOKIE } from "./trialConfig";

const SECRET = process.env.TRIAL_COOKIE_SECRET || "voiceprint-dev-trial-secret";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Produce the signed cookie value for a given used-count. */
export function signTrialCount(count: number): string {
  const value = String(Math.max(0, Math.trunc(count)));
  return `${value}.${sign(value)}`;
}

/** Verify a signed cookie value and return the used-count, or 0 if missing/tampered. */
export function readTrialCount(cookieValue: string | undefined): number {
  if (!cookieValue) return 0;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return 0;
  const value = cookieValue.slice(0, dot);
  const provided = Buffer.from(cookieValue.slice(dot + 1));
  const expected = Buffer.from(sign(value));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Read + verify the trial cookie straight off a request. */
export function readTrialFromRequest(request: Request): number {
  const header = request.headers.get("cookie");
  if (!header) return 0;
  const entry = header.split(/;\s*/).find((c) => c.startsWith(`${TRIAL_COOKIE}=`));
  if (!entry) return 0;
  return readTrialCount(decodeURIComponent(entry.slice(TRIAL_COOKIE.length + 1)));
}
