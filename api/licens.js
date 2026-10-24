// Appens licensaktivering: tunn proxy till hubbens foretagsdata-licens.
// Appen pratar alltid med foretagsdata.spekt.se — flyttar backenden pekas
// bara den här filen om, utan att skeppade appar behöver byggas om.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ status: "fel", fel: "endast POST" });
  try {
    const svar = await fetch(
      "https://yfofpybglztzonompndv.supabase.co/functions/v1/foretagsdata-licens",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body ?? {}),
      },
    );
    const data = await svar.json().catch(() => ({ status: "fel", fel: "ogiltigt svar" }));
    return res.status(svar.status).json(data);
  } catch {
    return res.status(502).json({ status: "fel", fel: "licenstjänsten svarar inte" });
  }
}
