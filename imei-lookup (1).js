// functions/api/imei-lookup.js
// Cloudflare Pages Functions version — proxies IMEI/TAC lookups so the
// third-party API key never reaches the browser, and so the request
// doesn't hit CORS restrictions calling the provider directly from
// client-side JS.
//
// IMPORTANT — this file only works if it lives at exactly this path:
//   functions/api/imei-lookup.js
// Cloudflare Pages auto-maps that path to the URL /api/imei-lookup.
// (This is the Cloudflare equivalent of Vercel's api/imei-lookup.js —
// same job, different folder name and function signature, since
// Cloudflare Pages Functions use the Workers runtime, not Node.js.)
//
// SETUP:
// 1. Sign up for a free key at your chosen TAC provider
//    (e.g. HiCellTek — 100 free lookups/month at time of writing).
// 2. In Cloudflare Pages: Settings > Environment variables, add
//    IMEI_API_KEY = <your key> for the Production environment.
//    Never put the key directly in this file.
// 3. Push this file to GitHub at functions/api/imei-lookup.js — Cloudflare
//    redeploys automatically and the endpoint goes live at /api/imei-lookup.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const imei = url.searchParams.get('imei');

  if (!imei || !/^\d{14,15}$/.test(imei)) {
    return new Response(
      JSON.stringify({ error: 'Provide a valid 14-15 digit IMEI.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = env.IMEI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'IMEI_API_KEY not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Example shape — adjust the URL/params/response parsing to match
    // whichever provider you actually sign up with; providers differ.
    const providerUrl = `https://api.example-tac-provider.com/v1/lookup?imei=${encodeURIComponent(imei)}&key=${apiKey}`;

    const providerRes = await fetch(providerUrl);
    if (!providerRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Provider lookup failed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = await providerRes.json();

    // Normalize to the shape the frontend expects — adjust field names
    // to match your chosen provider's actual response.
    return new Response(
      JSON.stringify({
        brand: data.brand || data.manufacturer || null,
        model: data.model || data.name || null,
        bands: Array.isArray(data.bands) ? data.bands.join(', ') : (data.bands || null)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Lookup failed.', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
