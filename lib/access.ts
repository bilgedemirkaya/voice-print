// Access control for the deployed demo (all server-side — the real code never ships to the client):
//   • local dev is always unlimited (use the host's own key, no prompt),
//   • a friend who knows the shared access code can use the host's key without a personal token,
//   • a visitor can bring their own ElevenLabs key,
//   • otherwise the free-trial gate in lib/trial.ts applies.
//
// The code itself is read from ACCESS_CODE only — never hardcoded — so it stays a secret in env
// (like a discount code). If ACCESS_CODE is unset, no code unlocks (the BYOK + trial paths remain).

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
