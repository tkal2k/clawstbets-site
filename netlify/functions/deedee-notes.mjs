const source = "https://raw.githubusercontent.com/tkal2k/clawstbets-site/refs/heads/deedee-data/notes.json";

export default async function handler() {
  try {
    const upstream = await fetch(source, { signal: AbortSignal.timeout(6000) });
    if (!upstream.ok) throw new Error("Notes source unavailable");
    const data = await upstream.json();
    if (!data.notes?.length || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Invalid notes");
    return Response.json(data, {
      headers: {
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=180, stale-while-revalidate=300",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return Response.json({ error: "Desk feed unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
