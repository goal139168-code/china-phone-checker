// netlify/functions/imei-lookup.js
// Netlify Functions version — proxies IMEI/TAC lookups to ImeiCheck.com's
// free modelBrandName endpoint, so the API key never reaches the browser.
//
// CONFIRMED WORKING (tested Aug 2026) — real request/response shape:
//   GET https://alpha.imeicheck.com/api/modelBrandName?imei=...&key=...&format=json
//   -> { "status": "succes", "object": { "brand": "...", "name": "...", "model": "..." }, ... }
//
// IMPORTANT: this endpoint only returns brand/model — it does NOT return
// network band data. So this function returns brand + model, and the
// frontend JS re-uses the same MODEL_DB lookup that powers the dropdown
// checker to get band info for that model. One IMEI lookup effectively
// auto-fills the dropdown rather than being a second, separate database.
//
// SETUP:
// 1. In Netlify: Site configuration > Environment variables, add
//    IMEI_API_KEY = <your ImeiCheck.com personal key>. Never put the key
//    directly in this file or anywhere in the frontend code.
// 2. Push this file to GitHub at netlify/functions/imei-lookup.js —
//    Netlify auto-detects it and deploys it, no extra config needed.
// 3. netlify.toml (provided alongside this) redirects /api/imei-lookup to
//    this function, so the frontend's fetch('/api/imei-lookup?imei=...')
//    call doesn't need to change.

export default async (req, context) => {
  const url = new URL(req.url);
  const imei = url.searchParams.get('imei');

  if (!imei || !/^\d{14,15}$/.test(imei)) {
    return new Response(
      JSON.stringify({ error: 'Provide a valid 14-15 digit IMEI.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = Netlify.env.get('IMEI_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'IMEI_API_KEY not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const providerUrl = `https://alpha.imeicheck.com/api/modelBrandName?imei=${encodeURIComponent(imei)}&key=${apiKey}&format=json`;

    const providerRes = await fetch(providerUrl);
    if (!providerRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Provider lookup failed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = await providerRes.json();

    if (data.status !== 'succes' || !data.object) {
      return new Response(
        JSON.stringify({ error: 'IMEI not recognized by provider.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // brand/model only — no band data from this provider. The frontend
    // matches this brand/model against MODEL_DB itself to get bands.
    return new Response(
      JSON.stringify({
        brand: data.object.brand || null,
        model: data.object.name || data.object.model || null,
        rawModelCode: data.object.model || null
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Lookup failed.', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
