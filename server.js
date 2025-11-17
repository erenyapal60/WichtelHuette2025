import express from "express";
import fs from "fs";
import crypto from "crypto";

const app = express();

app.use(express.json());
app.use(express.static("public"));


// Teilnehmer eintragen
app.post("/add", (req, res) => {
  let { name } = req.body;

  // 1. Trim
  name = name.trim();

  // 2. Mindestlänge
  if (name.length < 3) {
    return res.send("Bitte einen gültigen Namen eingeben (mindestens 3 Buchstaben).");
  }

  // 3. Nur Buchstaben, Leerzeichen, Bindestrich
  if (!/^[A-Za-zÄÖÜäöüß\- ]+$/.test(name)) {
    return res.send("Der Name enthält ungültige Zeichen!");
  }

  // 4. Datei laden
  let data = [];
  if (fs.existsSync("data_pending.json")) {
    data = JSON.parse(fs.readFileSync("data_pending.json"));
  }

  // 5. Normalisieren für Vergleich (lowercase)
  const lower = name.toLowerCase();

  if (data.some(e => e.name.toLowerCase() === lower)) {
    return res.send("Dieser Name wurde bereits eingetragen!");
  }

  // 6. Eintrag speichern (wartend)
  data.push({ name, status: "pending" });

  fs.writeFileSync("data_pending.json", JSON.stringify(data, null, 2));

  res.send("Danke! Dein Name wurde eingetragen und wartet auf Freigabe.");
});



app.get("/draw", (req, res) => {
  if (!fs.existsSync("data.json")) {
    return res.send("Keine Teilnehmer gefunden.");
  }

  const participants = JSON.parse(fs.readFileSync("data.json"));

  if (participants.length < 2) {
    return res.send("Zu wenige Teilnehmer.");
  }

  const names = participants.map(p => p.name);

  // Permutation erzeugen
  let perm = [...names];
  let valid = false;

  while (!valid) {
    perm.sort(() => Math.random() - 0.5);
    valid = perm.every((p, i) => p !== names[i]);
  }

  // Geheimen Link + PIN generieren
  const assignments = participants.map((p, i) => {
    const id = crypto.randomBytes(8).toString("hex");
    const pin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-stellige PIN

    return {
      name: p.name,
      target: perm[i],
      link: `/wichtel/${id}`,
      pin: pin,
      id: id
    };
  });

  fs.writeFileSync("wichtel.json", JSON.stringify(assignments, null, 2));

  res.send("Auslosung abgeschlossen! Gehe zu /links für die Links und PINs.");
});



app.get("/links", (req, res) => {
  if (!fs.existsSync("wichtel.json")) {
    return res.send("Noch keine Auslosung durchgeführt.");
  }

  const data = JSON.parse(fs.readFileSync("wichtel.json"));

  let html = `
    <h1>Geheime Wichtel-Links</h1>
    <ul>
  `;

  for (const p of data) {
    html += `
      <li>
        ${p.name}: 
        <a href="${p.link}" target="_blank">${p.link}</a> 
        – PIN: <strong>${p.pin}</strong>
      </li>
    `;
  }

  html += "</ul>";

  res.send(html);
});



app.get("/wichtel/:id", (req, res) => {
  if (!fs.existsSync("wichtel.json")) {
    return res.send("Keine Auslosung gefunden.");
  }

  const data = JSON.parse(fs.readFileSync("wichtel.json"));
  const entry = data.find(e => e.id === req.params.id);

  if (!entry) {
    return res.send("Ungültiger Link.");
  }

  // Wenn noch keine PIN eingegeben → PIN-Form anzeigen
  if (!req.query.pin) {
    return res.send(`
      <h1>Wichtel – PIN eingeben</h1>
      <form>
        <input name="pin" placeholder="4-stellige PIN" maxlength="4" />
        <button type="submit">Anzeigen</button>
      </form>
    `);
  }

  // PIN prüfen
  if (req.query.pin !== entry.pin) {
    return res.send("<h2>Falsche PIN!</h2>");
  }

  // Wenn korrekt → Ergebnis
  res.send(`
    <h1>Hallo ${entry.name}</h1>
    <p>Du beschenkst: <strong>${entry.target}</strong></p>
  `);
});



// ALLES LÖSCHEN (Teilnehmer + Auslosung)
app.get("/reset", (req, res) => {
  try {
    if (fs.existsSync("data.json")) fs.unlinkSync("data.json");
    if (fs.existsSync("wichtel.json")) fs.unlinkSync("wichtel.json");

    res.send("Alles gelöscht! Neue Eintragungen können jetzt gemacht werden.");
  } catch (err) {
    console.error(err);
    res.send("Fehler beim Zurücksetzen.");
  }
});

// ADMIN ÜBERSICHT
app.get("/admin", (req, res) => {
  if (!fs.existsSync("data_pending.json")) {
    return res.send("<h1>Keine Anfragen</h1>");
  }

  const pending = JSON.parse(fs.readFileSync("data_pending.json"));

  let html = "<h1>Admin – Freigabe</h1><ul>";

  for (let p of pending) {
    html += `
      <li>
        ${p.name}
        – <a href="/approve?name=${encodeURIComponent(p.name)}">✔ akzeptieren</a>
        – <a href="/reject?name=${encodeURIComponent(p.name)}">❌ ablehnen</a>
      </li>
    `;
  }

  html += "</ul>";

  res.send(html);
});


app.get("/approve", (req, res) => {
  const name = req.query.name;

  let pending = JSON.parse(fs.readFileSync("data_pending.json"));
  let accepted = [];

  if (fs.existsSync("data.json")) {
    accepted = JSON.parse(fs.readFileSync("data.json"));
  }

  const entry = pending.find(e => e.name === name);

  if (!entry) return res.send("Nicht gefunden.");

  // in akzeptierte Liste verschieben
  accepted.push({ name: entry.name });

  // pending entfernen
  pending = pending.filter(e => e.name !== name);

  fs.writeFileSync("data.json", JSON.stringify(accepted, null, 2));
  fs.writeFileSync("data_pending.json", JSON.stringify(pending, null, 2));

  res.redirect("/admin");
});



app.get("/reject", (req, res) => {
  const name = req.query.name;

  let pending = JSON.parse(fs.readFileSync("data_pending.json"));

  // Person entfernen
  pending = pending.filter(e => e.name !== name);

  fs.writeFileSync("data_pending.json", JSON.stringify(pending, null, 2));

  res.redirect("/admin");
});

 

// PORT für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});
