// Beställnings-/kontaktformuläret: postar till Resend så kunden aldrig
// behöver en egen mejlklient. Kräver RESEND_API_KEY i Vercel-projektet.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ fel: "endast POST" });
  }
  const { bolag, orgnr, bestallare, epost, plattform, uppdateringar, meddelande, honung } =
    req.body ?? {};

  // honungsfältet är osynligt för människor — bottar som fyller i det får "ok"
  if (honung) return res.status(200).json({ ok: true });

  const b = String(bolag ?? "").trim();
  const onr = String(orgnr ?? "").replace(/\D/g, "");
  const best = String(bestallare ?? "").trim();
  const e = String(epost ?? "").trim();
  const plat = ["Mac", "Windows"].includes(plattform) ? plattform : "Mac";
  const upp = uppdateringar === true;
  const m = String(meddelande ?? "").trim().slice(0, 5000);
  if (!b || b.length > 200) {
    return res.status(400).json({ fel: "Ange bolagsnamn." });
  }
  if (onr.length !== 10) {
    return res.status(400).json({ fel: "Ange organisationsnumret — tio siffror." });
  }
  if (!best || best.length > 200) {
    return res.status(400).json({ fel: "Ange vem som beställer." });
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
      subject: `Beställning: ${b} (${onr.slice(0, 6)}-${onr.slice(6)})`,
      text:
        `Bolag: ${b}\n` +
        `Orgnr: ${onr.slice(0, 6)}-${onr.slice(6)}\n` +
        `Beställare: ${best}\n` +
        `E-post: ${e}\n` +
        `Plattform: ${plat}\n` +
        `Uppdateringar 2 000 kr/år: ${upp ? "JA" : "nej"}\n\n` +
        `${m || "(inget meddelande)"}\n\n` +
        `— skickat från formuläret på foretagsdata.spekt.se`,
    }),
  });

  if (!svar.ok) {
    return res.status(502).json({ fel: "Mejlet kunde inte skickas — prova igen eller mejla linus@spekt.se." });
  }

  // spegla beställningen till Business hub (foretagsdata_kunder, status "beställd").
  // Mejlet är huvudkanalen — ett hubbfel får aldrig fälla beställningen, men
  // utfallet rapporteras i svaret så det går att felsöka.
  let hubb = "hoppad — HUB_API_KEY saknas";
  const hubNyckel = process.env.HUB_API_KEY;
  if (hubNyckel) {
    try {
      const hubSvar = await fetch(
        "https://pcdrqbyxrgsfzykpocid.supabase.co/functions/v1/hub-api",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hubNyckel}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "add_foretagsdata_bestallning",
            bolag: b,
            orgnr: onr,
            bestallare: best,
            epost: e,
            plattform: plat,
            uppdateringar: upp,
            meddelande: m,
          }),
        },
      );
      hubb = hubSvar.ok
        ? "ok"
        : `fel ${hubSvar.status}: ${(await hubSvar.text()).slice(0, 200)}`;
    } catch (fel) {
      hubb = `fel: ${String(fel).slice(0, 200)}`;
    }
  }
  return res.status(200).json({ ok: true, hubb });
}
