// Appens databasuppdatering: tunn proxy till hubbens foretagsdata-uppdatering.
// Appen pratar alltid med foretagsdata.spekt.se — flyttar backenden någonsin
// igen pekas bara den här filen om, utan att skeppade appar behöver byggas om.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ fel: "endast POST" });
  const kod = String(req.body?.kod ?? "").trim();
  if (kod.length < 8 || kod.length > 64) {
    return res.status(404).json({ status: "okand", fel: "ogiltig uppdateringskod" });
  }
  try {
    const svar = await fetch(
      "https://yfofpybglztzonompndv.supabase.co/functions/v1/foretagsdata-uppdatering",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kod }),
      },
    );
    const data = await svar.json().catch(() => ({ status: "fel", fel: "ogiltigt svar" }));
    return res.status(svar.status).json(data);
  } catch {
    return res.status(502).json({ status: "fel", fel: "uppdateringstjänsten svarar inte" });
  }
}
