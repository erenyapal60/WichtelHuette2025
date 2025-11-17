import express from "express";
import fs from "fs";
import crypto from "crypto";

const app = express();

app.use(express.json());
app.use(express.static("public"));


// Teilnehmer eintragen
app.post("/add", (req, res) => {
  const { name } = req.body;

  let data = [];
  if (fs.existsSync("data.json")) {
    data = JSON.parse(fs.readFileSync("data.json"));
  }

  data.push({ name });

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

  res.send("Erfolgreich eingetragen!");
});


// AUSLOSUNG
app.get("/draw", (req, res) => {
  if (!fs.existsSync("data.json")) {
    return res.send("Keine Teilnehmer gefunden.");
  }

  const participants = JSON.parse(fs.readFileSync("data.json"));

  if (participants.length < 2) {
    return res.send("Zu wenige Teilnehmer.");
  }

  const names = participants.map(p => p.name);

  // Permutation ohne Self-Match erzeugen
  let perm = [...names];
  let valid = false;

  while (!valid) {
    perm.sort(() => Math.random() - 0.5);
    valid = perm.every((p, i) => p !== names[i]);
  }

  // Geheimen Link pro Person generieren
  const assignments = participants.map((p, i) => {
    const id = crypto.randomBytes(8).toString("hex");
    return {
      name: p.name,
      target: perm[i],
      link: `/wichtel/${id}`,
      id: id
    };
  });

  fs.writeFileSync("wichtel.json", JSON.stringify(assignments, null, 2));

  res.send("Auslosung abgeschlossen! Gehe zu /links für alle geheimen Links.");
});


// Übersicht der Links
app.get("/links", (req, res) => {
  if (!fs.existsSync("wichtel.json")) {
    return res.send("Noch keine Auslosung durchgeführt.");
  }

  const data = JSON.parse(fs.readFileSync("wichtel.json"));

  let html = "<h1>Geheime Wichtel-Links</h1><ul>";

  for (const p of data) {
    html += `<li>${p.name}: <a href="${p.link}" target="_blank">${p.link}</a></li>`;
  }

  html += "</ul>";

  res.send(html);
});


// Geheim-Link Seite
app.get("/wichtel/:id", (req, res) => {
  if (!fs.existsSync("wichtel.json")) {
    return res.send("Keine Auslosung gefunden.");
  }

  const data = JSON.parse(fs.readFileSync("wichtel.json"));
  const entry = data.find(e => e.id === req.params.id);

  if (!entry) {
    return res.send("Ungültiger Link.");
  }

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
 

// PORT für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});
