// Appens nedladdningar: tunn proxy till hubbens foretagsdata-uppdatering.
// Appen pratar alltid med foretagsdata.spekt.se — flyttar backenden någonsin
// igen pekas bara den här filen om, utan att skeppade appar behöver byggas om.
//
// Legitimation: installations-ID (iid, från appens licens) eller — för appar
// före 1.4.0 — kundens uppdateringskod (kod). vad=publik-mac/-win kräver ingen
// legitimation (appen för alla innehåller bara demodatabasen).
export default async function handler(req, res) {
  // POST med JSON (appen) eller GET med query (Tauris uppdaterare)
  const kalla = req.method === "GET" ? req.query : req.method === "POST" ? req.body : null;
  if (!kalla) return res.status(405).json({ fel: "endast GET/POST" });
  const kod = String(kalla?.kod ?? "").trim();
  const iid = String(kalla?.iid ?? "").trim().toLowerCase();
  const vad = String(kalla?.vad ?? "data").trim();

  const publik = vad === "publik-mac" || vad === "publik-win";
  const giltigIid = /^[a-f0-9]{32,64}$/.test(iid);
  const giltigKod = kod.length >= 8 && kod.length <= 64;
  if (!publik && !giltigIid && !giltigKod) {
    return res
      .status(vad === "app" ? 403 : 404)
      .json({ status: "okand", fel: "okänd licens" });
  }
  try {
    const svar = await fetch(
      "https://yfofpybglztzonompndv.supabase.co/functions/v1/foretagsdata-uppdatering",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kod, iid, vad }),
      },
    );
    const data = await svar.json().catch(() => ({ status: "fel", fel: "ogiltigt svar" }));
    return res.status(svar.status).json(data);
  } catch {
    return res.status(502).json({ status: "fel", fel: "uppdateringstjänsten svarar inte" });
  }
}
