import { annotate } from "./assets/vendor/rough-notation.esm.js";

const stories = document.querySelector("#stories");
const status = document.querySelector("#notes-status");
const paper = document.querySelector("#paper");
const doodleLayer = document.querySelector("#doodles");
const formatDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const formatReturn = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const quoteSymbol = /^[A-Z0-9_]+:[A-Z0-9._-]+$/;
const moods = new Set(["side-eye", "laugh", "sad", "gasp", "noted", "lip-lick", "naughty"]);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const RED = "#c8251f", BLUE = "#23409a";
let current;
let annotations = [];

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

/* ---------- deterministic randomness (seeded by text) ---------- */
function seeded(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const between = (rand, lo, hi) => lo + rand() * (hi - lo);

/* ---------- magazine cut-out ransom titles ---------- */
const FONTS = ["nb-f-serif", "nb-f-dmserif", "nb-f-anton", "nb-f-bebas", "nb-f-slab", "nb-f-type", "nb-f-marker"];
const COLORS = ["nb-c-white", "nb-c-news", "nb-c-black", "nb-c-gold", "nb-c-pink", "nb-c-red", "nb-c-dots", "nb-c-white", "nb-c-news"];

function tornEdge(rand) {
  const pts = [];
  const j = () => between(rand, 0, 9).toFixed(1);
  for (let x = 0; x <= 100; x += 25) pts.push(`${x}% ${j()}%`);
  for (let y = 25; y <= 100; y += 25) pts.push(`${100 - j()}% ${y}%`);
  for (let x = 75; x >= 0; x -= 25) pts.push(`${x}% ${100 - j()}%`);
  for (let y = 75; y >= 25; y -= 25) pts.push(`${j()}% ${y}%`);
  return `polygon(${pts.join(",")})`;
}

function ransom(target, text) {
  const rand = seeded(text);
  const clippings = element("span");
  clippings.setAttribute("aria-hidden", "true");
  clippings.style.display = "contents";
  let lastFont = "", lastColor = "", taped = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const wordBox = element("span", "", "nb-word");
    const chars = [...word];
    for (let i = 0; i < chars.length;) {
      const size = rand() < .16 && i + 1 < chars.length ? 2 : 1;
      const chunk = chars.slice(i, i + size).join("");
      i += size;
      let font = pick(rand, FONTS), color = pick(rand, COLORS);
      if (font === lastFont) font = pick(rand, FONTS);
      if (color === lastColor) color = pick(rand, COLORS);
      lastFont = font; lastColor = color;
      const clip = element("span", chunk, `nb-clip ${font} ${color}`);
      const padX = between(rand, .08, .2).toFixed(2), padT = between(rand, .06, .16).toFixed(2), padB = between(rand, .06, .18).toFixed(2);
      clip.style.padding = `${padT}em ${padX}em ${padB}em`;
      clip.style.fontSize = `${between(rand, .86, 1.16).toFixed(2)}em`;
      clip.style.transform = `translateY(${between(rand, -4, 4).toFixed(1)}px) rotate(${between(rand, -6, 6).toFixed(1)}deg)`;
      clip.style.clipPath = tornEdge(rand);
      if (/[a-z]/i.test(chunk) && taped < 2 && rand() < .09) { clip.classList.add("has-tape"); clip.style.clipPath = "none"; taped++; }
      wordBox.append(clip);
    }
    clippings.append(wordBox);
  }
  const real = element("span", text, "sr-only");
  target.setAttribute("aria-label", text);
  target.classList.add("nb-ransom");
  target.append(real, clippings);
  return target;
}


/* ---------- highlighter: yellow on % moves, pink on dates ---------- */
const MARKS = /([−-]?\d+(?:\.\d+)?%)|((?:Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)\.? \d{1,2}\b)/g;
function markedText(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const match of text.matchAll(MARKS)) {
    frag.append(text.slice(last, match.index));
    frag.append(element("mark", match[0], match[2] ? "nb-highlight nb-pink" : "nb-highlight"));
    last = match.index + match[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}
function paragraph(text) {
  const p = element("p");
  p.append(markedText(text));
  return p;
}

/* ---------- market index card ---------- */
function returns(label, value) {
  const box = element("div", "", "return");
  const figure = element("strong", formatReturn.format(value) + "%", value < 0 ? "down" : "up");
  box.append(element("span", label), figure);
  return { box, figure };
}

function liveQuote(symbol) {
  const widget = element("div", "", "tradingview-widget-container");
  const attribution = element("div", "", "tradingview-widget-copyright");
  const link = element("a", "Market data by TradingView");
  link.href = "https://www.tradingview.com/symbols/" + symbol.replace(":", "-") + "/";
  link.target = "_blank";
  link.rel = "noopener nofollow";
  attribution.append(link);
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
  script.async = true;
  script.textContent = JSON.stringify({ symbol, width: "100%", colorTheme: "light", isTransparent: false, locale: "en" });
  widget.append(element("div", "", "tradingview-widget-container__widget"), attribution, script);
  return widget;
}

function scratchNote(note) {
  const perf = note.performance;
  const better = perf.stockPct > perf.benchmarkPct;
  const p = element("p", "", "nb-scrawl");
  const scratch = element("span", better ? "worse" : "better", "nb-scratch");
  scratch.append(element("span", better ? "better" : "worse", "nb-fix"));
  p.append(note.ticker + " did ", scratch, " than " + perf.benchmark + " ");
  p.append(element("mark", formatReturn.format(perf.benchmarkPct) + "%", "nb-highlight"));
  return { p, scratch };
}

function marketCard(note, marks) {
  const card = element("aside", "", "market nb-index-card");
  card.setAttribute("aria-label", note.ticker + " stock performance");
  card.append(element("span", "", "nb-tape nb-tape-top"));
  card.append(element("h3", note.ticker + " stock performance", "nb-block"));
  const performance = note.performance;
  if (performance) {
    card.append(element("p", performance.window, "market-context"));
    const row = element("div", "", "return-row");
    const stock = returns(note.ticker, performance.stockPct);
    row.append(stock.box, returns(performance.benchmark, performance.benchmarkPct).box);
    card.append(row);
    marks.push([stock.figure, { type: "circle", color: RED, strokeWidth: 2, padding: [6, 10], iterations: 2 }]);
    if (performance.stockPct !== performance.benchmarkPct) {
      const { p, scratch } = scratchNote(note);
      card.append(p);
      marks.push([scratch.firstChild.parentElement, { type: "strike-through", color: BLUE, strokeWidth: 2, iterations: 2 }]);
    }
  }
  if (quoteSymbol.test(note.symbol ?? "")) {
    card.append(element("p", "Latest quotes · exchange delays may apply", "market-context"));
    const frame = element("div", "", "nb-taped");
    frame.append(element("span", "", "nb-tape nb-tape-left"));
    for (const symbol of [note.symbol, "NASDAQ:SOXX"]) frame.append(liveQuote(symbol));
    card.append(frame);
  }
  if (note.flowRemark) {
    const flow = element("div", "", "flow");
    const remark = element("p", note.flowRemark);
    flow.append(element("h4", "DeeDee on options flow", "nb-block"), remark);
    card.append(flow);
    marks.push([remark, { type: "bracket", brackets: ["left"], color: RED, strokeWidth: 2 }]);
  }
  return card;
}

/* ---------- the story ---------- */
function createStory(note, marks) {
  const story = element("article", "", "story");
  story.id = note.id;
  const label = [note.kind, note.ticker, formatDate.format(new Date(note.date))].filter(Boolean);
  const title = element("h3");
  const permalink = element("a", note.title);
  permalink.href = "#" + note.id;
  title.className = "nb-block nb-headline";
  title.append(permalink);
  story.append(element("p", label.join(" · "), "eyebrow"), title);
  const body = element("div", "", "blurb");
  const paragraphs = note.body ?? [note.facts, note.read, note.watch];
  const reactions = new Map((note.reactions ?? []).map(({ paragraph, mood }) => [paragraph, mood]));
  const watchIndex = paragraphs.length > 2 && !reactions.has(paragraphs.length - 1) ? paragraphs.length - 1 : -1;
  const stampRand = seeded(note.id);
  paragraphs.forEach((text, index) => {
    if (index === watchIndex) return;
    const mood = reactions.get(index);
    const copy = paragraph(text);
    if (!moods.has(mood)) {
      body.append(copy);
      return;
    }
    const beat = element("div", "", "reaction-beat");
    const stamp = element("div", "", "reaction-stamp");
    stamp.style.transform = `rotate(${between(stampRand, -7, 7).toFixed(1)}deg)`;
    const face = element("img");
    face.src = "stamps/" + mood + ".webp";
    face.alt = "";
    face.width = 116;
    face.height = 116;
    face.loading = "lazy";
    stamp.append(face);
    beat.append(stamp, copy);
    body.append(beat);
  });
  story.append(body);
  if (watchIndex >= 0) {
    const sticky = element("aside", "", "nb-sticky");
    sticky.setAttribute("aria-label", "Watch list");
    sticky.append(element("h4", "watch list", "nb-block nb-marker"), paragraph(paragraphs[watchIndex]));
    story.append(sticky);
  }
  const sources = element("div", "", "sources");
  for (const source of note.sources) {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || /(?:^|\.)tkal\.news$|^tkalnews\.substack\.com$/i.test(url.hostname)) continue;
    const link = element("a", source.label);
    link.href = url.href;
    sources.append(link);
  }
  story.append(sources);
  const layout = element("div", "", "issue");
  layout.append(story, marketCard(note, marks));
  return layout;
}

/* ---------- hand-drawn annotations (Rough Notation, MIT) ---------- */
let observer;
function annotateAll(marks) {
  annotations.forEach(a => a.remove());
  annotations = [];
  observer?.disconnect();
  const animate = !reducedMotion.matches;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.__nb?.show();
      observer.unobserve(entry.target);
    }
  }, { threshold: .6 });
  for (const [el, options] of marks) {
    const a = annotate(el, { animate, animationDuration: 700, ...options });
    el.__nb = a;
    annotations.push(a);
    observer.observe(el);
  }
}

/* ---------- margin doodles (own Rough.js drawings) ---------- */
const DOODLES = [
  ["anarchy-a", 58], ["candles-down", 64], ["mohawk-bear", 62], ["chip-x-eyes", 58], ["rocket-crash", 64],
  ["broken-heart-dollar", 56], ["spiked-wristband", 64], ["cassette", 64], ["sell-bubble", 70],
  ["star-red", 34], ["squiggle", 60], ["lightning-squiggle", 30], ["star", 38], ["arrow-down", 32],
];
function doodle(name, width, rand) {
  const img = element("img", "", "nb-doodle");
  img.src = `assets/doodles/${name}.svg`;
  img.alt = "";
  img.width = width;
  img.style.opacity = between(rand, .7, .9).toFixed(2);
  img.style.transform = `rotate(${between(rand, -14, 14).toFixed(1)}deg)`;
  return img;
}
function placeDoodles() {
  const rand = seeded("deedee-notebook");
  const height = paper.scrollHeight;
  const rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--margin-x")) || 96;
  doodleLayer.replaceChildren();
  let y = 30, i = 0;
  while (y < height - 90) {
    const [name, w] = DOODLES[i % DOODLES.length];
    const size = Math.min(w, rail - 42);
    const img = doodle(name, size, rand);
    img.style.left = `${36 + (rail - 36 - size) / 2 + between(rand, -3, 3)}px`;
    img.style.top = `${y}px`;
    doodleLayer.append(img);
    y += between(rand, 120, 170);
    i++;
  }
  const right = [["rocket-crash", 58], ["star-red", 30], ["chip-x-eyes", 52], ["squiggle", 56], ["sell-bubble", 62], ["star", 30]];
  const step = (height - 160) / right.length;
  right.forEach(([name, w], k) => {
    const img = doodle(name, w, rand);
    img.style.right = `${10 + between(rand, 0, 10)}px`;
    img.style.top = `${120 + k * step + between(rand, -20, 20)}px`;
    doodleLayer.append(img);
  });
  if (!paper.querySelector(".nb-doodle-strip")) {
    const strip = element("div", "", "nb-doodle-strip");
    strip.setAttribute("aria-hidden", "true");
    for (const name of ["anarchy-a", "candles-down", "chip-x-eyes", "cassette", "mohawk-bear"]) strip.append(doodle(name, 44, rand));
    paper.querySelector(".hero").before(strip);
  }
}

/* ---------- data (unchanged pipeline) ---------- */
async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Desk feed unavailable");
  const data = await response.json();
  if (!data.notes?.[0]?.body?.length || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Invalid desk feed");
  return data;
}

function render(data) {
  const selection = data.notes.find(note => location.hash === "#" + note.id) ?? data.notes[0];
  const marks = [];
  stories.replaceChildren(createStory(selection, marks));
  if (!current && location.hash) document.getElementById(selection.id)?.scrollIntoView();
  current = data;
  status.textContent = "Issue date · " + formatDate.format(new Date(selection.date));
  requestAnimationFrame(() => { placeDoodles(); annotateAll(marks); });
}

async function refresh() {
  const sources = current ? ["/api/deedee-notes"] : ["/api/deedee-notes", "./notes.json"];
  const responses = await Promise.allSettled(sources.map(readJson));
  const available = responses.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const latest = available.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (latest && (!current || Date.parse(latest.updatedAt) > Date.parse(current.updatedAt))) render(latest);
  if (!current) status.textContent = "The daily issue is temporarily unavailable.";
}

for (const heading of document.querySelectorAll("[data-ransom]")) {
  const text = heading.textContent.trim();
  heading.textContent = "";
  ransom(heading, text);
}
const kiss = document.querySelector(".nb-kiss");
if (kiss) document.querySelector("h1.nb-ransom")?.append(kiss);
window.addEventListener("hashchange", () => {
  if (current) render(current);
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (current) placeDoodles(); }, 200);
});
document.fonts?.ready.then(() => { if (current) placeDoodles(); });
await refresh();
setInterval(refresh, 300_000);
