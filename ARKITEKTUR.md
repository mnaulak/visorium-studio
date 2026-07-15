# Visorium Studio — arkitektur i korthet

## Vad det är
Statisk webbplats (HTML/CSS/vanilla JS, ingen byggprocess, inga npm-paket).
Serveras lokalt av `serve.py` på port 4173. Tre sidor: `index.html` (Företag/Privat
på samma sida), `kundresa.html`, `integritetspolicy.html`.

## Sidkarta
```
index.html ──┬─ mode-toggle (Företag / Privat, samma DOM, byter <section data-view>)
             ├─ AI-guide (ai-guide.js) – regelbaserad, körs helt i webbläsaren,
             │  inga externa AI-anrop eller nycklar
             ├─ Offertformulär → Formspree (POST) → FormSubmit (bekräftelsemejl)
             └─ Boka möte → Calendly (laddas först vid klick, se script.js)
kundresa.html ── fristående sida, länkar tillbaka till index.html (#kontakt, #paket)
integritetspolicy.html ── GDPR-information, länkas från formulär och cookie-banner
```

## Tredjepartstjänster (de enda externa anropen)
- **Formspree** – tar emot offertformuläret.
- **FormSubmit** – skickar automatiskt bekräftelsemejl.
- **Calendly** – bokningswidget, lazy-loaded vid klick (inte i `<head>`).
- Typsnitt är **självhostade** i `fonts/` sedan 2026-07-15 (tidigare Google Fonts).

## Beslut värda att komma ihåg (ADR-stil)
1. **Ingen backend, ingen databas.** Formspree/FormSubmit ersätter servern. Håller
   sajten enkel att drifta och tar bort hela klassen av backend-säkerhetsproblem
   (auth, secrets, SQL-injektion, sessions) eftersom det inte finns någon backend.
2. **Ingen build-process / inga npm-beroenden.** Inget dependency-scanning-problem
   eftersom det inte finns några paket att ha sårbarheter i.
3. **Typsnitt självhostas** (2026-07-15) istället för att laddas från Google Fonts,
   för att inga besökares IP-adresser ska skickas till Google innan samtycke.
4. **Calendly lazy-loadas på klick** (2026-07-15) istället för i `<head>`, av samma
   integritetsskäl plus snabbare förstasidladdning.
5. **Versionshantering infördes** (2026-07-15, `git init`) som enda "backup"-strategi
   för koden. Stora videofiler i `bilder/*.mp4` är medvetet undantagna (`.gitignore`)
   — de bör säkras separat (originalmaterial/molnbackup), inte i git.

## Drift / deploy
Statiska filer → kan läggas direkt på valfri statisk host (Netlify, Vercel, GitHub
Pages, vanligt webbhotell). HTTPS/TLS-certifikat sköts då automatiskt av hosten —
inget att hantera i koden.
