// clawstbets.com on Cloudflare: static assets plus two small routes.
//   /api/deedee-notes  DeeDee desk feed (alias: /.netlify/functions/deedee-notes)
//   /api/track         first-party funnel beacons -> D1 (no cookies, IPs or user agents)
const NOTES_SOURCE = "https://raw.githubusercontent.com/tkal2k/clawstbets-site/refs/heads/deedee-data/notes.json";
const NOTES_PATHS = new Set(["/api/deedee-notes", "/.netlify/functions/deedee-notes"]);
const SLOTS = /^[a-z0-9_]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (NOTES_PATHS.has(pathname)) return notes();
    if (pathname === "/api/track") return track(request, env);
    if (pathname.startsWith("/api/") || pathname.startsWith("/.netlify/")) {
      return new Response("not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

async function notes() {
  try {
    const upstream = await fetch(NOTES_SOURCE, {
      signal: AbortSignal.timeout(6000),
      cf: { cacheTtl: 180, cacheEverything: true },
    });
    if (!upstream.ok) throw new Error("Notes source unavailable");
    const data = await upstream.json();
    if (!data.notes?.length || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Invalid notes");
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "Desk feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

async function track(request, env) {
  if (request.method === "GET") {
    // Daily rollup for the owner: /api/track?day=YYYY-MM-DD&key=<TRACK_READ_KEY>
    const url = new URL(request.url);
    if (!env.TRACK_READ_KEY || !(await sameSecret(url.searchParams.get("key") || "", env.TRACK_READ_KEY))) {
      return new Response("forbidden", { status: 403 });
    }
    const day = url.searchParams.get("day") || new Date().toISOString().slice(0, 10);
    if (!DAY.test(day)) return new Response("bad day", { status: 400 });
    const next = new Date(Date.parse(day + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
    const { results } = await env.DB.prepare(
      "SELECT ev, slot, v, COUNT(*) AS n FROM funnel WHERE t >= ?1 AND t < ?2 GROUP BY ev, slot, v",
    ).bind(day, next).all();
    const counts = {};
    for (const row of results) counts[`${row.ev}:${row.slot}:${row.v}`] = row.n;
    return Response.json({ day, counts }, { headers: { "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") return new Response("method", { status: 405 });
  let body;
  try { body = await request.json(); } catch { return new Response("bad", { status: 400 }); }
  const ev = body?.ev === "view" ? "view" : body?.ev === "click" ? "click" : null;
  const slot = String(body?.slot || "");
  const v = body?.v === "a" || body?.v === "b" ? body.v : "-";
  if (!ev || !SLOTS.test(slot)) return new Response("bad", { status: 400 });
  const ref = String(body?.ref || "").slice(0, 80).replace(/[^a-z0-9.\-]/gi, "");
  await env.DB.prepare("INSERT INTO funnel (t, ev, slot, v, ref) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(new Date().toISOString(), ev, slot, v, ref).run();
  return new Response(null, { status: 204 });
}

async function sameSecret(given, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, expected].map(s => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(a, b);
}
