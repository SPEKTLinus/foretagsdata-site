// Integritetssidans formulär: borttagning ur databasen, invändning eller
// registerutdrag → mejl till Linus via Resend. Borttagningar läggs sedan i
// ~/nystartade_bolag/foretagsdata_borttagna.txt, som paketeraren läser vid
// varje release. Kräver RESEND_API_KEY i Vercel-projektet.
const ARENDEN = {
  ta_bort: "Ta bort företaget ur databasen",
  invandning: "Invändning mot behandling",
  fraga: "Begäran om registerutdrag",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ fel: "endast POST" });
  }
  const { arende, orgnr, epost, meddelande, honung } = req.body ?? {};

  // honungsfältet är osynligt för människor — bottar som fyller i det får "ok"
  if (honung) return res.status(200).json({ ok: true });

  const a = Object.hasOwn(ARENDEN, arende) ? arende : "ta_bort";
  const onr = String(orgnr ?? "").replace(/\D/g, "");
  const e = String(epost ?? "").trim();
  const m = String(meddelande ?? "").trim().slice(0, 2000);
  const giltigEpost = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
  if (a === "ta_bort" && onr.length !== 10) {
    return res.status(400).json({ fel: "Ange organisationsnumret — tio siffror." });
  }
  if (a !== "ta_bort" && !giltigEpost) {
    return res.status(400).json({ fel: "Ange din e-post så att vi kan svara." });
  }

  const nyckel = process.env.RESEND_API_KEY;
  if (!nyckel) return res.status(500).json({ fel: "mejlkopplingen är inte konfigurerad" });

  const orgText = onr.length === 10 ? `${onr.slice(0, 6)}-${onr.slice(6)}` : "(inget orgnr)";
  const idag = new Date().toISOString().slice(0, 10);
  const svar = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nyckel}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SPEKT Företagsdata <leverans@spekt.se>",
      to: ["linus@spekt.se"],
      ...(giltigEpost ? { reply_to: e } : {}),
      subject: `Integritet: ${ARENDEN[a]} ${orgText}`,
      text:
        `Ärende: ${ARENDEN[a]}\n` +
        `Orgnr: ${orgText}\n` +
        `E-post: ${giltigEpost ? e : "(ingen)"}\n\n` +
        `${m || "(inget meddelande)"}\n\n` +
        (onr.length === 10
          ? `Lägg till i ~/nystartade_bolag/foretagsdata_borttagna.txt:\n${onr}  # ${idag} ${ARENDEN[a].toLowerCase()}\n\n`
          : "") +
        `Svara inom en månad (dataskyddsförordningen art. 12).\n` +
        `— skickat från foretagsdata.spekt.se/integritet.html`,
    }),
  });

  if (!svar.ok) {
    return res.status(502).json({ fel: "Det gick inte att skicka — prova igen eller mejla linus@spekt.se." });
  }
  return res.status(200).json({ ok: true });
}
