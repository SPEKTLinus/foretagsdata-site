// Provutgåvans registrering: appen skickar e-post + installations-ID vid första
// start. Linus får ett mejl (bara vid första försöket) och provaren speglas till
// Business hub (action foretagsdata_prov_registrera). Hubben äger startdatumet:
// samma e-post på en ny installation fortsätter det gamla provet, inte ett nytt.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ fel: "endast POST" });
  const { epost, bolag, installations_id, plattform, appversion, forsta } = req.body ?? {};

  const e = String(epost ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) {
    return res.status(400).json({ fel: "Ange en giltig e-postadress." });
  }
  const b = String(bolag ?? "").trim().slice(0, 200);
  const id = String(installations_id ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  const plat = ["Mac", "Windows"].includes(plattform) ? plattform : "okänd";
  const ver = String(appversion ?? "").slice(0, 20);

  // hubben: registrera provaren och hämta det gällande startdatumet
  let hubb = "hoppad — HUB_API_KEY saknas";
  let provStart = null;
  const hubNyckel = process.env.HUB_API_KEY;
  if (hubNyckel) {
    try {
      const svar = await fetch(
        "https://yfofpybglztzonompndv.supabase.co/functions/v1/hub-api",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${hubNyckel}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "foretagsdata_prov_registrera",
            epost: e, bolag: b, installations_id: id, plattform: plat, appversion: ver,
          }),
        },
      );
      const data = await svar.json().catch(() => ({}));
      if (svar.ok) {
        hubb = "ok";
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(data.prov_start ?? ""))) provStart = data.prov_start;
      } else {
        hubb = `fel ${svar.status}: ${String(data.error ?? data.fel ?? "").slice(0, 160)}`;
      }
    } catch (fel) {
      hubb = `fel: ${String(fel).slice(0, 160)}`;
    }
  }

  // Linus får veta direkt — bara första försöket, appen gör om tysta försök
  if (forsta === true && process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SPEKT Företagsdata <leverans@spekt.se>",
          to: ["linus@spekt.se"],
          reply_to: e,
          subject: `Ny provanvändare: ${b || e}`,
          text:
            `Någon har startat provperioden (14 dagar) av SPEKT Företagsdata.\n\n` +
            `E-post: ${e}\nBolag: ${b || "(ej angivet)"}\nPlattform: ${plat}\n` +
            `Appversion: ${ver || "?"}\nInstallations-ID: ${id || "?"}\n\n` +
            `Hubben: ${hubb}\n\n— skickat från appens provregistrering`,
        }),
      });
    } catch { /* mejlet är grädde — provet startar ändå */ }
  }

  return res.status(200).json({ ok: true, prov_start: provStart, hubb });
}
