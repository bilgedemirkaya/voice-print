/** Free voice transforms a new visitor gets on the shared key before bring-your-own-key. */
export const FREE_TRIAL_LIMIT = 3;

/** Name of the signed cookie tracking how many free transforms a visitor has used. */
export const TRIAL_COOKIE = "vp_trial";

/** Header carrying the shared access code that unlocks the host's key, bypassing the trial. */
export const ACCESS_CODE_HEADER = "x-access-code";

/** Header carrying a visitor's own ElevenLabs key (BYOK), used per-request and never stored. */
export const BYOK_HEADER = "x-elevenlabs-key";
