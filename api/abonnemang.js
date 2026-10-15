// Appens värde-popup: en kund med databasen vill köpa abonnemanget.
// Mejl till Linus är huvudkanalen; hubbspeglingen flaggar kundkortet.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ fel: "endast POST" });
  const { bolag, epost, orgnr, meddelande, honung } = req.body ?? {};
  if (honung) return res.status(200).json({ ok: true });

  const b = String(bolag ?? "").trim().slice(0, 200);
  const e = String(epost ?? "").trim();
  const onr = String(orgnr ?? "").replace(/\D/g, "");
  const m = String(meddelande ?? "").trim().slice(0, 2000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) {
    return res.status(400).json({ fel: "Ange en giltig e-postadress." });
  }

  const nyckel = process.env.RESEND_API_KEY;
  if (!nyckel) return res.status(500).json({ fel: "mejlkopplingen är inte konfigurerad" });
  const svar = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${nyckel}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "SPEKT Företagsdata <leverans@spekt.se>",
      to: ["linus@spekt.se"],
      reply_to: e,
      subject: `Vill köpa abonnemang: ${b || e}`,
      text:
        `En kund med databasen vill köpa uppdateringsabonnemanget (2 000 kr/år).\n\n` +
        `Bolag: ${b || "(ej angivet)"}\n` +
        (onr.length === 10 ? `Orgnr: ${onr.slice(0, 6)}-${onr.slice(6)}\n` : "") +
        `E-post: ${e}\n\n${m || "(inget meddelande)"}\n\n` +
        `— skickat från appens uppdaterings-popup`,
    }),
  });
  if (!svar.ok) {
    return res.status(502).json({ fel: "Kunde inte skicka — mejla linus@spekt.se direkt." });
  }

  let hubb = "hoppad — HUB_API_KEY saknas";
  const hubNyckel = process.env.HUB_API_KEY;
  if (hubNyckel) {
    try {
      const hubSvar = await fetch(
        "https://yfofpybglztzonompndv.supabase.co/functions/v1/hub-api",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${hubNyckel}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "vill_kopa_abonnemang",
            bolag: b, epost: e, orgnr: onr, meddelande: m,
          }),
        },
      );
      hubb = hubSvar.ok ? "ok" : `fel ${hubSvar.status}: ${(await hubSvar.text()).slice(0, 200)}`;
    } catch (fel) {
      hubb = `fel: ${String(fel).slice(0, 200)}`;
    }
  }
  return res.status(200).json({ ok: true, hubb });
}
