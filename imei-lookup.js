// api/imei-lookup.js
// Vercel serverless function — proxies IMEI/TAC lookups so the third-party
// API key never reaches the browser, and so the request doesn't hit CORS
// restrictions calling the provider directly from client-side JS.
//
// SETUP:
// 1. Sign up for a free key at whichever TAC provider you choose
//    (e.g. HiCellTek — 100 free lookups/month at time of writing).
// 2. In your Vercel project: Settings > Environment Variables, add
//    IMEI_API_KEY = <your key>. Never put the key in this file or in
//    any client-side code.
// 3. Deploy. This function will be live at /api/imei-lookup automatically —
//    Vercel treats anything in /api as a serverless function, no extra config.
//
// This CANNOT run on SBI — SBI only serves static HTML/CSS/JS, it has no
// server-side execution, so there's nowhere to hide the API key. That's
// exactly why the IMEI path lives on the hosted version of this tool
// (Vercel/Netlify), while the SBI-pasted version stays dropdown-only.

export default async function handler(req, res) {
  const { imei } = req.query;

  if (!imei || !/^\d{14,15}$/.test(imei)) {
    return res.status(400).json({ error: 'Provide a valid 14-15 digit IMEI.' });
  }

  const apiKey = process.env.IMEI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'IMEI_API_KEY not configured on the server.' });
  }

  try {
    // Example shape — adjust the URL/params/response parsing to match
    // whichever provider you actually sign up with; providers differ.
    const providerUrl = `https://api.example-tac-provider.com/v1/lookup?imei=${encodeURIComponent(imei)}&key=${apiKey}`;

    const providerRes = await fetch(providerUrl);
    if (!providerRes.ok) {
      return res.status(502).json({ error: 'Provider lookup failed.' });
    }
    const data = await providerRes.json();

    // Normalize to the shape the frontend expects — adjust field names
    // to match your chosen provider's actual response.
    return res.status(200).json({
      brand: data.brand || data.manufacturer || null,
      model: data.model || data.name || null,
      bands: Array.isArray(data.bands) ? data.bands.join(', ') : (data.bands || null)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lookup failed.', detail: String(err) });
  }
}
