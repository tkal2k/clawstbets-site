// clawstbets.com on Cloudflare: static assets plus a few small routes.
//   /api/deedee-notes   DeeDee desk feed (alias: /.netlify/functions/deedee-notes)
//   /api/track          first-party funnel beacons -> D1 (no cookies, IPs or user agents)
//   /deedee/, /deedee/<issue-id>   desk pages with the issue server-rendered for search and AI crawlers
//   /sitemap.xml, /llms.txt, /deedee/feed.xml   generated from the live desk feed
// Everything else is a static asset and never runs this code (see run_worker_first).
const SITE = "https://clawstbets.com";
const NOTES_SOURCE = "https://raw.githubusercontent.com/tkal2k/clawstbets-site/refs/heads/deedee-data/notes.json";
const NOTES_PATHS = new Set(["/api/deedee-notes", "/.netlify/functions/deedee-notes"]);
const ISSUE_PATH = /^\/deedee\/(20\d\d-\d\d-\d\d-[a-z0-9]+(?:-[a-z0-9]+)*)(\/?)$/;
const SHARE_IMAGE = `${SITE}/deedee/assets/dd-share.jpg`;
const SLOTS = /^[a-z0-9_]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ORIGINS = new Set([SITE, "https://www.clawstbets.com"]);

// Static pages worth indexing, with the canonical (extensionless) path. Keep in sync with _headers.
const PAGES = [
  { path: "/", title: "ClawStBets: free daily leans and a graded public record", note: "Free daily sports leans, a public graded record, and a paid card only when the edge clears. Every staked play is graded against the closing line." },
  { path: "/ledger", title: "Full public ledger", note: "Every graded staked bet, row by row, with the unsized leans listed separately." },
  { path: "/the-claw-machine", title: "The Claw Machine: live model board", note: "Model probability vs the de-vigged market for each play, graded against the close." },
  { path: "/nfl-postmortem", title: "NFL post-mortem", note: "Weekly NFL pick'em and The Spread Sheet graded against the NFL.com experts." },
  { path: "/deedee/", title: "DeeDee's Daily DD", note: "Daily AI and chip-stock commentary from DeeDee, ClawStreetBets' fictional goth analyst: one stock, one story, the move against SOXX and the next thing to watch." },
  { path: "/faq", title: "FAQ", note: "How ClawStBets picks, grades and publishes." },
  { path: "/terms", title: "Terms of service", note: "" },
  { path: "/privacy", title: "Privacy policy", note: "" },
  { path: "/refund", title: "Refund policy", note: "" },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (NOTES_PATHS.has(pathname)) return notesResponse(request);
    if (pathname === "/api/track") return track(request, env);
    if (pathname.startsWith("/api/") || pathname.startsWith("/.netlify/")) return notFound();
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("method", { status: 405, headers: { Allow: "GET, HEAD" } });
    if (pathname === "/sitemap.xml") return sitemap(env, url);
    if (pathname === "/llms.txt") return llms(env, url);
    if (pathname === "/deedee/feed.xml") return rss(env, url);
    if (pathname === "/deedee/") return deskPage(request, env, null);
    const issue = ISSUE_PATH.exec(pathname);
    if (issue) {
      if (issue[2]) return Response.redirect(`${SITE}/deedee/${issue[1]}`, 301);
      return deskPage(request, env, issue[1]);
    }
    return env.ASSETS.fetch(request);
  },
};

// ---------- feed ----------
async function loadFeed(env, url) {
  try {
    const upstream = await fetch(NOTES_SOURCE, {
      signal: AbortSignal.timeout(6000),
      cf: { cacheTtl: 180, cacheEverything: true },
    });
    if (!upstream.ok) throw new Error("Notes source unavailable");
    const data = await upstream.json();
    if (validFeed(data)) return data;
  } catch {}
  try {  // the bundled backup copy on main
    const backup = await env.ASSETS.fetch(new Request(new URL("/deedee/notes.json", url)));
    const data = backup.ok ? await backup.json() : null;
    if (validFeed(data)) return data;
  } catch {}
  return null;
}

function validFeed(data) {
  return Boolean(data?.notes?.length) && Number.isFinite(Date.parse(data.updatedAt));
}

async function notesResponse(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method", { status: 405 });
  try {
    const upstream = await fetch(NOTES_SOURCE, {
      signal: AbortSignal.timeout(6000),
      cf: { cacheTtl: 180, cacheEverything: true },
    });
    if (!upstream.ok) throw new Error("Notes source unavailable");
    const data = await upstream.json();
    if (!validFeed(data)) throw new Error("Invalid notes");
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } });
  } catch {
    return Response.json({ error: "Desk feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

// ---------- desk pages ----------
async function deskPage(request, env, id) {
  const url = new URL(request.url);
  const shell = await env.ASSETS.fetch(new Request(new URL("/deedee/", url)));
  const feed = await loadFeed(env, url);
  if (!feed) return id ? notFound() : shell;  // the page still renders client-side from its backup copy
  const notes = feed.notes.filter(n => n?.id && n?.title && Array.isArray(n.body));
  const note = id ? notes.find(n => n.id === id) : notes[0];
  if (!note) return notFound();

  const canonical = id ? `${SITE}/deedee/${note.id}` : `${SITE}/deedee/`;
  const title = id ? `${note.title} · DeeDee’s Daily DD` : "DeeDee’s Daily DD · AI and chip stocks, explained · ClawStreetBets";
  const description = id
    ? clip(note.body[0], 155)
    : `Today: ${note.title} DeeDee covers one AI or chip stock a day: what moved, why, and the next thing to watch.`;
  const jsonld = id ? articleLd(note, canonical, description) : deskLd(notes);

  const setContent = value => ({ element(el) { el.setAttribute("content", value); } });
  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', setContent(description))
    .on('meta[property="og:title"]', setContent(id ? note.title : "DeeDee’s Daily DD"))
    .on('meta[property="og:description"]', setContent(description))
    .on('meta[property="og:url"]', setContent(canonical))
    .on('meta[property="og:type"]', setContent(id ? "article" : "website"))
    .on('meta[name="twitter:title"]', setContent(id ? note.title : "DeeDee’s Daily DD"))
    .on('meta[name="twitter:description"]', setContent(description))
    .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", canonical); } })
    .on("head", { element(el) {
      el.append(`<link rel="alternate" type="application/rss+xml" title="DeeDee’s Daily DD" href="${SITE}/deedee/feed.xml">`, { html: true });
      if (id) el.append(`<meta property="article:published_time" content="${esc(note.date)}">`, { html: true });
      el.append(`<script type="application/ld+json">${ldJson(jsonld)}</script>`, { html: true });
    } })
    .on("#notes-status", { element(el) { el.setInnerContent(`Issue date · ${longDate(note.date)}`); } })
    .on("#stories", { element(el) { el.setInnerContent(issueHtml(note), { html: true }); } })
    .on("section#notes", { element(el) { el.after(archiveHtml(notes, note.id), { html: true }); } })
    .transform(shell);
  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "public, max-age=120");
  headers.delete("ETag");
  return new Response(request.method === "HEAD" ? null : rewritten.body, { status: 200, headers });
}

function issueHtml(note) {
  const perf = note.performance ?? {};
  const label = [note.kind, note.ticker, longDate(note.date)].filter(Boolean).map(esc).join(" · ");
  const paragraphs = note.body.map(p => `<p>${esc(p)}</p>`).join("");
  const sources = (note.sources ?? [])
    .filter(s => /^https:\/\//.test(s?.url ?? ""))
    .map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join("");
  const move = Number.isFinite(perf.stockPct) && Number.isFinite(perf.benchmarkPct)
    ? `<p class="ssr-perf"><strong>${esc(note.ticker)} ${signed(perf.stockPct)}</strong> vs ${esc(perf.benchmark)} ${signed(perf.benchmarkPct)} · ${esc(perf.window)}</p>`
    : "";
  return `<article class="story ssr-story" id="${esc(note.id)}">`
    + `<header class="issue-banner"><p class="eyebrow">${label}</p>`
    + `<h3 class="nb-headline"><a href="/deedee/${esc(note.id)}">${esc(note.title)}</a></h3></header>`
    + `<div class="blurb">${paragraphs}</div>${move}`
    + (note.flowRemark ? `<p class="ssr-flow"><em>Options desk:</em> ${esc(note.flowRemark)}</p>` : "")
    + (sources ? `<h4>Sources</h4><ul class="ssr-sources">${sources}</ul>` : "")
    + `<p class="ssr-disclaimer">DeeDee is a fictional commentator. Not financial advice.</p></article>`;
}

function archiveHtml(notes, currentId) {
  const items = notes.slice(0, 60).map(n => n.id === currentId
    ? `<li><span aria-current="page">${esc(longDate(n.date))} · ${esc(n.ticker)} · ${esc(n.title)}</span></li>`
    : `<li><a href="/deedee/${esc(n.id)}">${esc(longDate(n.date))} · ${esc(n.ticker)} · ${esc(n.title)}</a></li>`).join("");
  return `<nav class="nb-archive" aria-label="Past issues"><h2 class="nb-block">Past issues</h2><ul>${items}</ul></nav>`;
}

function articleLd(note, canonical, description) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: note.title,
    description,
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: note.date,
    image: SHARE_IMAGE,
    articleSection: note.kind,
    keywords: [note.ticker, note.symbol, note.kind, "AI stocks", "semiconductors"].filter(Boolean),
    isAccessibleForFree: true,
    author: { "@type": "Organization", name: "ClawStreetBets (DeeDee, a fictional commentator)", url: `${SITE}/deedee/` },
    publisher: { "@type": "Organization", name: "ClawStreetBets", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/favicon-180.png` } },
    isPartOf: { "@type": "Blog", name: "DeeDee’s Daily DD", url: `${SITE}/deedee/` },
    citation: (note.sources ?? []).map(s => s.url).filter(u => /^https:\/\//.test(u ?? "")),
  };
}

function deskLd(notes) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "DeeDee’s Daily DD",
    url: `${SITE}/deedee/`,
    description: "Daily AI and chip-stock commentary: one stock, one story, the move against SOXX and the next thing to watch. Not financial advice.",
    publisher: { "@type": "Organization", name: "ClawStreetBets", url: SITE },
    blogPost: notes.slice(0, 30).map(n => ({ "@type": "BlogPosting", headline: n.title, url: `${SITE}/deedee/${n.id}`, datePublished: n.date })),
  };
}

// ---------- discovery files ----------
async function sitemap(env, url) {
  const feed = await loadFeed(env, url);
  const notes = feed?.notes?.filter(n => n?.id) ?? [];
  const latest = notes[0]?.date;
  const rows = PAGES.map(p => urlEntry(`${SITE}${p.path}`, p.path === "/deedee/" ? latest : null));
  for (const n of notes) rows.push(urlEntry(`${SITE}/deedee/${n.id}`, n.date));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}

function urlEntry(loc, lastmod) {
  return `  <url><loc>${esc(loc)}</loc>${lastmod && DAY.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
}

async function llms(env, url) {
  const feed = await loadFeed(env, url);
  const notes = feed?.notes?.filter(n => n?.id && Array.isArray(n.body)) ?? [];
  const lines = [
    "# ClawStreetBets (clawstbets.com)",
    "",
    "> Free daily sports leans with a public, graded betting record, plus DeeDee's Daily DD: short daily commentary on one AI or semiconductor stock. Entertainment and education only; not financial or betting advice. 21+.",
    "",
    "Every staked play on the sports side is graded against the closing line and listed on the public ledger. DeeDee is a fictional illustrated analyst; her desk links primary sources (company releases, filings, price history) for every issue.",
    "",
    "## Main pages",
    ...PAGES.filter(p => p.note).map(p => `- [${p.title}](${SITE}${p.path}): ${p.note}`),
    "",
    "## DeeDee's Daily DD: recent issues",
    ...notes.slice(0, 30).map(n => `- [${n.title}](${SITE}/deedee/${n.id}): ${n.date} · ${n.ticker} · ${clip(n.body[0], 160)}`),
    "",
    "## Machine-readable",
    `- [Sitemap](${SITE}/sitemap.xml)`,
    `- [DeeDee RSS feed, full text](${SITE}/deedee/feed.xml)`,
    "",
    "## Policies",
    `- [Terms](${SITE}/terms) · [Privacy](${SITE}/privacy) · [Refunds](${SITE}/refund)`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}

async function rss(env, url) {
  const feed = await loadFeed(env, url);
  const notes = feed?.notes?.filter(n => n?.id && Array.isArray(n.body)) ?? [];
  const items = notes.slice(0, 30).map(n => {
    const link = `${SITE}/deedee/${n.id}`;
    const html = n.body.map(p => `<p>${esc(p)}</p>`).join("");
    return `<item><title>${esc(n.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>`
      + `<pubDate>${new Date(`${n.date}T20:00:00Z`).toUTCString()}</pubDate><category>${esc(n.ticker)}</category>`
      + `<description>${esc(clip(n.body[0], 300))}</description><content:encoded><![CDATA[${html.replaceAll("]]>", "]]&gt;")}]]></content:encoded></item>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel>`
    + `<title>DeeDee’s Daily DD</title><link>${SITE}/deedee/</link><atom:link href="${SITE}/deedee/feed.xml" rel="self" type="application/rss+xml"/>`
    + `<description>One AI or chip stock a day: what moved, why, and the next thing to watch. Not financial advice.</description><language>en-us</language>\n${items}\n</channel></rss>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}

// ---------- funnel tracker ----------
async function track(request, env) {
  const noindex = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };
  if (request.method === "GET") {
    // Daily rollup for the owner: /api/track?day=YYYY-MM-DD&key=<TRACK_READ_KEY>
    const url = new URL(request.url);
    if (!env.TRACK_READ_KEY || !(await sameSecret(url.searchParams.get("key") || "", env.TRACK_READ_KEY))) {
      return new Response("forbidden", { status: 403, headers: noindex });
    }
    const day = url.searchParams.get("day") || new Date().toISOString().slice(0, 10);
    if (!DAY.test(day)) return new Response("bad day", { status: 400, headers: noindex });
    const next = new Date(Date.parse(day + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
    const { results } = await env.DB.prepare(
      "SELECT ev, slot, v, COUNT(*) AS n FROM funnel WHERE t >= ?1 AND t < ?2 GROUP BY ev, slot, v",
    ).bind(day, next).all();
    const counts = {};
    for (const row of results) counts[`${row.ev}:${row.slot}:${row.v}`] = row.n;
    return Response.json({ day, counts }, { headers: noindex });
  }
  if (request.method !== "POST") return new Response("method", { status: 405, headers: noindex });
  // Beacons come only from our own pages: same-origin browsers always send Origin on POST.
  if (!ALLOWED_ORIGINS.has(request.headers.get("Origin") || "")) return new Response(null, { status: 403, headers: noindex });
  if (Number(request.headers.get("Content-Length") || 0) > 1024) return new Response("too big", { status: 413, headers: noindex });
  let body;
  try { body = JSON.parse((await request.text()).slice(0, 1024)); } catch { return new Response("bad", { status: 400, headers: noindex }); }
  const ev = body?.ev === "view" ? "view" : body?.ev === "click" ? "click" : null;
  const slot = String(body?.slot || "");
  const v = body?.v === "a" || body?.v === "b" ? body.v : "-";
  if (!ev || !SLOTS.test(slot)) return new Response("bad", { status: 400, headers: noindex });
  const ref = String(body?.ref || "").slice(0, 80).replace(/[^a-z0-9.\-]/gi, "");
  await env.DB.prepare("INSERT INTO funnel (t, ev, slot, v, ref) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(new Date().toISOString(), ev, slot, v, ref).run();
  return new Response(null, { status: 204, headers: noindex });
}

// ---------- helpers ----------
function notFound() {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found · ClawStreetBets</title>`
    + `<p>That page isn’t here. Try <a href="/">ClawStreetBets</a> or <a href="/deedee/">DeeDee’s Daily DD</a>.</p>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } },
  );
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function ldJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function clip(text, max) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length) + "…";
}

function longDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function signed(n) {
  return `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
}

async function sameSecret(given, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, expected].map(s => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(a, b);
}
