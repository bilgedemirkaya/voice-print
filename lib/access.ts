// Access control for the deployed demo (all server-side — the real code never ships to the client):
//   • local dev is always unlimited (use the host's own key, no prompt),
//   • a friend who knows the shared access code can use the host's key without a personal token,
//   • a visitor can bring their own ElevenLabs key,
//   • otherwise the free-trial gate in lib/trial.ts applies.
//
// The code itself is read from ACCESS_CODE only — never hardcoded — so it stays a secret in env
// (like a discount code). If ACCESS_CODE is unset, no code unlocks (the BYOK + trial paths remain).

import { ACCESS_CODE_HEADER, BYOK_HEADER } from "@/lib/trialConfig";

/** `next dev` sets NODE_ENV=development; tests run as "test", production as "production". */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function expectedCode(): string {
  return (process.env.ACCESS_CODE ?? "").trim().toLowerCase();
}

/** Case-insensitive match against the configured access code; false when none is configured. */
export function isValidAccessCode(code: string | null | undefined): boolean {
  const expected = expectedCode();
  return Boolean(expected && code && code.trim().toLowerCase() === expected);
}

export type AccessResolution = {
  /** Running on `next dev` — always uses the host key, unlimited. */
  local: boolean;
  /** The visitor's own ElevenLabs key (BYOK) from the request, or undefined to use the host key. */
  userKey: string | undefined;
  /** Skip the free-trial gate entirely (local dev, a valid shared code, or BYOK). */
  bypassTrial: boolean;
};

/**
 * Resolve how a request is allowed to transform: local dev and a valid shared code both unlock the
 * host key; a visitor may bring their own. Any of these bypasses the free-trial gate. (Local dev
 * ignores a stray BYOK header so it always uses the host key.)
 */
export function resolveAccess(request: Request): AccessResolution {
  const userKey = request.headers.get(BYOK_HEADER)?.trim() || undefined;
  const local = isLocalDev();
  const codeUnlock = local || isValidAccessCode(request.headers.get(ACCESS_CODE_HEADER));
  return { local, userKey, bypassTrial: codeUnlock || Boolean(userKey) };
}
