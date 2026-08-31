// Beställnings-/kontaktformuläret: postar till Resend så kunden aldrig
// behöver en egen mejlklient. Kräver RESEND_API_KEY i Vercel-projektet.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ fel: "endast POST" });
  }
  const { bolag, epost, meddelande, honung } = req.body ?? {};

  // honungsfältet är osynligt för människor — bottar som fyller i det får "ok"
  if (honung) return res.status(200).json({ ok: true });

  const b = String(bolag ?? "").trim();
  const e = String(epost ?? "").trim();
  const m = String(meddelande ?? "").trim().slice(0, 5000);
  if (!b || b.length > 200) {
    return res.status(400).json({ fel: "Ange bolagsnamn." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) {
    return res.status(400).json({ fel: "Ange en giltig e-postadress." });
  }

  const nyckel = process.env.RESEND_API_KEY;
  if (!nyckel) return res.status(500).json({ fel: "mejlkopplingen är inte konfigurerad" });

  const svar = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nyckel}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SPEKT Företagsdata <leverans@spekt.se>",
      to: ["linus@spekt.se"],
      reply_to: e,
      subject: `Beställning/kontakt: ${b}`,
      text:
        `Bolag: ${b}\nE-post: ${e}\n\n${m || "(inget meddelande)"}\n\n` +
        `— skickat från formuläret på foretagsdata.spekt.se`,
    }),
  });

  if (!svar.ok) {
    return res.status(502).json({ fel: "Mejlet kunde inte skickas — prova igen eller mejla linus@spekt.se." });
  }
  return res.status(200).json({ ok: true });
}
