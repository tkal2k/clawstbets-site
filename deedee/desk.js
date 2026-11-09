const stories = document.querySelector("#stories");
const status = document.querySelector("#notes-status");
const formatDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const formatReturn = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const quoteSymbol = /^[A-Z0-9_]+:[A-Z0-9._-]+$/;
const moods = new Set(["side-eye", "laugh", "sad", "gasp", "noted", "lip-lick", "naughty"]);
let current;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function returns(label, value) {
  const box = element("div", "", "return");
  box.append(element("span", label), element("strong", formatReturn.format(value) + "%", value < 0 ? "down" : "up"));
  return box;
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
  script.textContent = JSON.stringify({ symbol, width: "100%", colorTheme: "dark", isTransparent: false, locale: "en" });
  widget.append(element("div", "", "tradingview-widget-container__widget"), attribution, script);
  return widget;
}

function marketCard(note) {
  const card = element("aside", "", "panel market");
  card.setAttribute("aria-label", note.ticker + " stock performance");
  card.append(element("h3", note.ticker + " stock performance"));
  const performance = note.performance;
  if (performance) {
    card.append(element("p", performance.window, "market-context"));
    const row = element("div", "", "return-row");
    row.append(returns(note.ticker, performance.stockPct), returns(performance.benchmark, performance.benchmarkPct));
    card.append(row);
  }
  if (quoteSymbol.test(note.symbol ?? "")) {
    card.append(element("p", "Latest quotes · exchange delays may apply", "market-context"));
    for (const symbol of [note.symbol, "NASDAQ:SOXX"]) card.append(liveQuote(symbol));
  }
  if (note.flowRemark) {
    const flow = element("div", "", "flow");
    flow.append(element("h4", "DeeDee on options flow"), element("p", note.flowRemark));
    card.append(flow);
  }
  return card;
}

function createStory(note) {
  const story = element("article", "", "panel story");
  story.id = note.id;
  const label = [note.kind, note.ticker, formatDate.format(new Date(note.date))].filter(Boolean);
  const title = element("h3");
  const permalink = element("a", note.title);
  permalink.href = "#" + note.id;
  title.append(permalink);
  story.append(element("p", label.join(" · "), "eyebrow"), title);
  const body = element("div", "", "blurb");
  const paragraphs = note.body ?? [note.facts, note.read, note.watch];
  const reactions = new Map((note.reactions ?? []).map(({ paragraph, mood }) => [paragraph, mood]));
  paragraphs.forEach((paragraph, index) => {
    const mood = reactions.get(index);
    const copy = element("p", paragraph);
    if (!moods.has(mood)) {
      body.append(copy);
      return;
    }
    const beat = element("div", "", "reaction-beat");
    const stamp = element("div", "", "reaction-stamp");
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
  const sources = element("div", "", "sources");
  for (const source of note.sources) {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || /(?:^|\.)tkal\.news$|^tkalnews\.substack\.com$/i.test(url.hostname)) continue;
    const link = element("a", source.label);
    link.href = url.href;
    sources.append(link);
  }
  story.append(body, sources);
  const layout = element("div", "", "issue");
  layout.append(story, marketCard(note));
  return layout;
}

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Desk feed unavailable");
  const data = await response.json();
  if (!data.notes?.[0]?.body?.length || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Invalid desk feed");
  return data;
}

function render(data) {
  const selection = data.notes.find(note => location.hash === "#" + note.id) ?? data.notes[0];
  stories.replaceChildren(createStory(selection));
  if (!current && location.hash) document.getElementById(selection.id)?.scrollIntoView();
  current = data;
  status.textContent = "Issue date · " + formatDate.format(new Date(selection.date));
}

async function refresh() {
  const sources = current ? ["/.netlify/functions/deedee-notes"] : ["/.netlify/functions/deedee-notes", "./notes.json"];
  const responses = await Promise.allSettled(sources.map(readJson));
  const available = responses.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const latest = available.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (latest && (!current || Date.parse(latest.updatedAt) > Date.parse(current.updatedAt))) render(latest);
  if (!current) status.textContent = "The daily issue is temporarily unavailable.";
}

window.addEventListener("hashchange", () => {
  if (current) render(current);
});
await refresh();
setInterval(refresh, 300_000);
