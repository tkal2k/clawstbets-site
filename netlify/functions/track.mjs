// First-party funnel logger for clawstbets.com.
// Accepts {ev, slot, v, ts, ref} beacons from index.html and appends one row per event to a
// daily Netlify Blobs key. No cookies, no IPs, no user agents stored.
import { getStore } from "@netlify/blobs";

const SLOTS = /^[a-z0-9_]{1,40}$/;

export default async (req) => {
  if (req.method === "GET") {
    // Daily rollup for the owner: /api/track?day=YYYY-MM-DD&key=<TRACK_READ_KEY>
    const url = new URL(req.url);
    if (!process.env.TRACK_READ_KEY || url.searchParams.get("key") !== process.env.TRACK_READ_KEY) {
      return new Response("forbidden", { status: 403 });
    }
    const day = url.searchParams.get("day") || new Date().toISOString().slice(0, 10);
    const store = getStore("funnel");
    const { blobs } = await store.list({ prefix: `${day}/` });
    const counts = {};
    for (const b of blobs) {
      const row = await store.get(b.key, { type: "json" });
      if (!row) continue;
      const k = `${row.ev}:${row.slot}:${row.v}`;
      counts[k] = (counts[k] || 0) + 1;
    }
    return Response.json({ day, counts });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response("bad", { status: 400 }); }
  const ev = body.ev === "view" ? "view" : body.ev === "click" ? "click" : null;
  const slot = String(body.slot || "");
  const v = body.v === "a" || body.v === "b" ? body.v : "-";
  if (!ev || !SLOTS.test(slot)) return new Response("bad", { status: 400 });
  const ref = String(body.ref || "").slice(0, 80).replace(/[^a-z0-9.\-]/gi, "");
  const now = new Date();
  const key = `${now.toISOString().slice(0, 10)}/${now.getTime()}-${crypto.randomUUID().slice(0, 8)}`;
  await getStore("funnel").setJSON(key, { ev, slot, v, ref, t: now.toISOString() });
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/track" };
