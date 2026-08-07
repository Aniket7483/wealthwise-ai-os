// Server-only Yahoo Finance access layer.
//
// Yahoo now rate-limits anonymous calls hard (HTTP 429). This module keeps a
// cached cookie + crumb session, rotates hosts, retries with backoff and caches
// responses in-memory so a page render never fans out dozens of cold requests.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HOSTS = ["query2", "query1"] as const;

type Session = { cookie: string; crumb: string; at: number };

let session: Session | null = null;
let sessionPromise: Promise<Session | null> | null = null;

const SESSION_TTL = 20 * 60 * 1000;

async function createSession(): Promise<Session | null> {
  try {
    const res = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
    const raw =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie") ?? ""];
    const cookie = raw
      .filter(Boolean)
      .map((c) => c.split(";")[0])
      .join("; ");
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Accept: "text/plain", ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 32 || crumb.includes("<")) return null;
    return { cookie, crumb, at: Date.now() };
  } catch {
    return null;
  }
}

async function getSession(force = false): Promise<Session | null> {
  if (!force && session && Date.now() - session.at < SESSION_TTL) return session;
  if (!sessionPromise) {
    sessionPromise = createSession().then((s) => {
      session = s;
      sessionPromise = null;
      return s;
    });
  }
  return sessionPromise;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a Yahoo Finance JSON endpoint with crumb auth, host rotation and backoff. */
export async function yahooJson<T>(
  path: string,
  params: Record<string, string> = {},
  attempts = 3,
): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const s = await getSession(attempt > 0);
    const host = HOSTS[attempt % HOSTS.length];
    const search = new URLSearchParams(params);
    if (s?.crumb) search.set("crumb", s.crumb);
    try {
      const res = await fetch(`https://${host}.finance.yahoo.com${path}?${search.toString()}`, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          ...(s?.cookie ? { Cookie: s.cookie } : {}),
        },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
      if (attempt < attempts - 1) await sleep(250 * (attempt + 1));
    } catch {
      if (attempt < attempts - 1) await sleep(250 * (attempt + 1));
    }
  }
  return null;
}

/* --------------------------- in-memory TTL cache --------------------------- */

type Entry = { value: unknown; expires: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 600;

/** Cache-aside helper that also de-duplicates concurrent identical requests. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const promise = load()
    .then((value) => {
      if (cache.size > MAX_ENTRIES) cache.clear();
      cache.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/** Run an async map with bounded concurrency so we never burst the provider. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

export const YAHOO_UA = UA;
