const stories = document.querySelector("#stories");
const status = document.querySelector("#notes-status");
const formatDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
let current;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function createStory(note) {
  const story = element("article", "", "panel story");
  story.id = note.id;
  const label = [note.kind, note.ticker, formatDate.format(new Date(note.date))].filter(Boolean);
  const title = element("h3");
  const permalink = element("a", note.title);
  permalink.href = "#" + note.id;
  title.append(permalink);
  const body = element("dl");
  for (const [label, text] of [["What happened", note.facts], ["DeeDee’s read", note.read], ["What I’m watching", note.watch]]) {
    const row = element("div");
    row.append(element("dt", label), element("dd", text));
    body.append(row);
  }
  const sources = element("div", "", "sources");
  for (const source of note.sources) {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || /(?:^|\.)tkal\.news$|^tkalnews\.substack\.com$/i.test(url.hostname)) continue;
    const link = element("a", source.label);
    link.href = url.href;
    sources.append(link);
  }
  story.append(element("p", label.join(" · "), "eyebrow"), title, body, sources);
  return story;
}

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Desk feed unavailable");
  const data = await response.json();
  if (!data.notes?.length || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Invalid desk feed");
  return data;
}

function render(data) {
  const notes = data.notes.map(createStory);
  stories.replaceChildren(...notes);
  if (!current && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  current = data.updatedAt;
  status.textContent = "Last editorial update · " + formatDate.format(new Date(current));
}

async function refresh() {
  try {
    const data = await readJson("/.netlify/functions/deedee-notes");
    if (!current || Date.parse(data.updatedAt) > Date.parse(current)) render(data);
  } catch {
    if (current) return;
    try {
      render(await readJson("./notes.json"));
    } catch {
      status.textContent = "Desk notes are temporarily unavailable.";
    }
  }
}

await refresh();
setInterval(refresh, 300_000);
