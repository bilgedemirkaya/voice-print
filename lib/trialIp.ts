// Optional per-IP backstop using Upstash Redis (REST, no SDK). This is the hard cap that survives
// cookie-clearing — the signed cookie in lib/trial.ts is the per-browser soft gate / UX counter.
// Disabled (every call no-ops) unless UPSTASH_REDIS_REST_URL + _TOKEN are set, so local dev and
// cookie-only deploys keep working. Counts reset daily; failures never block a real request.
// node:fetch keeps this server-side; env is read at call time so it's configurable per-request.

const WINDOW_SECONDS = 60 * 60 * 24; // per-IP quota resets daily

function upstash(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function ipDailyCap(): number {
  const n = Number.parseInt(process.env.TRIAL_IP_DAILY_CAP ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

function dayKey(ip: string): string {
  return `vp:trial:ip:${ip}:${new Date().toISOString().slice(0, 10)}`;
}

async function command(cfg: { url: string; token: string }, parts: Array<string | number>): Promise<unknown> {
  const path = parts.map((part) => encodeURIComponent(String(part))).join("/");
  const res = await fetch(`${cfg.url}/${path}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result ?? null;
}

/** True when this request's IP has hit today's cap. Best-effort: false when disabled or on error. */
export async function isIpRateLimited(request: Request): Promise<boolean> {
  const cfg = upstash();
  const ip = clientIp(request);
  if (!cfg || !ip) return false;
  try {
    const raw = await command(cfg, ["GET", dayKey(ip)]);
    const count = raw == null ? 0 : Number(raw) || 0;
    return count >= ipDailyCap();
  } catch {
    return false;
  }
}

/** Count one successful transform against this IP's daily quota (best-effort, never throws). */
export async function bumpIp(request: Request): Promise<void> {
  const cfg = upstash();
  const ip = clientIp(request);
  if (!cfg || !ip) return;
  try {
    const key = dayKey(ip);
    const count = Number(await command(cfg, ["INCR", key]));
    if (count === 1) await command(cfg, ["EXPIRE", key, WINDOW_SECONDS]);
  } catch {
    // ignore — the backstop must never break a real request
  }
}
